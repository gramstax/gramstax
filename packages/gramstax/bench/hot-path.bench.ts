/**
 * Hot-path microbenchmark — compiled template render, route dispatch, keyboard build.
 *
 * Runner: mitata (`bench`/`group`/`run`). Each bench measures one isolatable
 * framework unit with small data; every measured result goes through
 * `do_not_optimize`; allocation-heavy benches use `.gc(`inner`)`.
 *
 * - `render`: `TemplateManager.getGMessage` on a pre-compiled template
 *   (1 call, small interpolation data) — the compiled-function hot path
 *   behind `Ctx.render`. Plus `getGKeyboard` label render (1 call).
 * - `keyboard`: grammy `InlineKeyboard` build from static labels, and
 *   labels-to-markup end-to-end (`getGKeyboard` + `InlineKeyboard` build) —
 *   the path behind `Ctx.inlineKeyboard`.
 * - `dispatch`: one text update through grammy `bot.handleUpdate` into
 *   `Gramstax._pageRoutes`, landing in a no-op `handleFreeText`
 *   (in-process `deploy: "test"` bot, no session routes, no network, no
 *   settle sleep — the closest isolatable dispatch unit; the handler only
 *   bumps a counter, so the number is routing cost, not app logic).
 *
 * Run: bun packages/gramstax/bench/hot-path.bench.ts
 *
 * Knobs (all optional):
 * - `BENCH_N` — buttons per keyboard (default `4`, clamped `1..32`)
 * - `BENCH_FILTER` — regex passed to mitata `run({filter})`
 *
 * @internal
 */

import {mkdtempSync, rmSync} from "node:fs"
import {arch, cpus, platform, tmpdir, totalmem} from "node:os"
import {join} from "node:path"
import {InlineKeyboard} from "grammy"
import type {Update} from "grammy/types"
import {bench, do_not_optimize, group, run} from "mitata"
import {Ctx, Gramstax, TemplateManager} from "../src"

const PAGE = `hotpath`
const TOKEN = `bench-token`
const WARMUP_ROUNDS = 50

let dispatchHits = 0
let nextUpdateId = 1

function benchButtons(): number {
  const raw = Number(process.env.BENCH_N ?? `4`)
  if (!Number.isFinite(raw)) {
    return 4
  }
  return Math.min(32, Math.max(1, Math.floor(raw)))
}

const BUTTONS = benchButtons()

function keyboardLabelSource(): string {
  const parts: Array<string> = []
  for (let i = 0; i < BUTTONS; i++) {
    parts.push(`Btn${i} {{suffix}}`)
  }
  return parts.join(`, `)
}

const HOT_TEMPLATE = `<g-base><g-message>pong {{echo}}</g-message><g-keyboard>${keyboardLabelSource()}</g-keyboard></g-base>`

const STATIC_LABELS: ReadonlyArray<string> = Array.from({length: BUTTONS}, (_, i) => `Btn${i}`)

// ---------------------------------------------------------------------------
// Minimal bench bot (no-op free-text handler: dispatch cost only, no render)
// ---------------------------------------------------------------------------

class BenchPage extends Ctx {
  static data = Ctx.buildData({name: PAGE})

  async handleFreeText(): Promise<void> {
    dispatchHits += 1
  }

  static template = HOT_TEMPLATE
}

class BenchBot extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages()
  }
}

function setupBot(): {bot: BenchBot; dir: string} {
  const dir = mkdtempSync(join(tmpdir(), `gramstax-hotpath-`))
  const templateManager = new TemplateManager({path: [dir]})
  templateManager._compile(PAGE, HOT_TEMPLATE)
  const bot = new BenchBot({token: TOKEN, deploy: `test`, log: false, templateManager})
  bot._pageSorts(BenchPage, bot.pages, 0)
  return {bot, dir}
}

function buildUpdate(updateId: number): Update {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: {id: 9001, type: `private`, first_name: `Bench`},
      from: {id: 9001, is_bot: false, first_name: `Bench`},
      text: `hello`
    }
  }
}

// ---------------------------------------------------------------------------
// Env + runner helpers
// ---------------------------------------------------------------------------

function printEnv(): void {
  const cpuList = cpus()
  const model = cpuList[0]?.model ?? `unknown`
  console.log(`# gramstax hot-path microbenchmark (mitata)`)
  console.log(``)
  console.log(`Run: bun packages/gramstax/bench/hot-path.bench.ts`)
  console.log(`Env: ${platform()} ${arch()} | CPU: ${model} x${cpuList.length} | RAM: ${(totalmem() / 1024 ** 3).toFixed(1)} GiB | bun ${Bun.version}`)
  console.log(`Config: buttons=${BUTTONS} (BENCH_N) | filter=${process.env.BENCH_FILTER ?? `none`} (BENCH_FILTER)`)
  console.log(``)
}

function runBench(): Promise<unknown> {
  const filter = process.env.BENCH_FILTER
  if (filter === undefined || filter === ``) {
    return run()
  }
  return run({filter: new RegExp(filter)})
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function main(): Promise<void> {
  printEnv()
  const {bot, dir} = setupBot()
  try {
    const templateManager = bot.templateManager
    if (templateManager === undefined) {
      throw new Error(`bench bot has no templateManager`)
    }
    const e2e = bot.e2e
    if (e2e === undefined) {
      throw new Error(`bench bot has no e2e helper (deploy test expected)`)
    }

    // Warmup: stabilize JIT on the compiled template fns + verify wiring.
    for (let i = 0; i < WARMUP_ROUNDS; i++) {
      do_not_optimize(templateManager.getGMessage(PAGE, `default`, `default`, {echo: `bench-echo`}))
      do_not_optimize(templateManager.getGKeyboard(PAGE, `default`, `default`, `inline`, {suffix: `S`}))
    }
    const hitsBefore = dispatchHits
    await e2e.sendText(`hello`)
    do_not_optimize(await bot.bot.handleUpdate(buildUpdate(nextUpdateId++)))
    if (dispatchHits !== hitsBefore + 2) {
      throw new Error(`dispatch wiring check failed: expected 2 hits, got ${dispatchHits - hitsBefore}`)
    }
    console.log(`Wiring OK: 1 template, ${BUTTONS} keyboard buttons, dispatch lands in handleFreeText.`)
    console.log(``)

    group(`render (compiled template, 1 call)`, () => {
      bench(`render: getGMessage interpolation`, () => {
        do_not_optimize(templateManager.getGMessage(PAGE, `default`, `default`, {echo: `bench-echo`}))
      })
      bench(`render: getGKeyboard inline labels (${BUTTONS} labels)`, () => {
        do_not_optimize(templateManager.getGKeyboard(PAGE, `default`, `default`, `inline`, {suffix: `S`}))
      })
    })

    group(`keyboard build (grammy InlineKeyboard)`, () => {
      bench(`keyboard: build ${BUTTONS} buttons / 2 cols`, () => {
        const kb = new InlineKeyboard()
        for (let i = 0; i < STATIC_LABELS.length; i++) {
          kb.text(STATIC_LABELS[i] ?? `?`, `d${i}`)
          if (i % 2 === 1) {
            kb.row()
          }
        }
        do_not_optimize(kb)
      }).gc(`inner`)
      bench(`keyboard: labels->markup end-to-end (${BUTTONS} labels)`, () => {
        const labels = templateManager.getGKeyboard(PAGE, `default`, `default`, `inline`, {suffix: `S`})
        const kb = new InlineKeyboard()
        for (let i = 0; i < labels.length; i++) {
          kb.text(labels[i] ?? `?`, `d${i}`)
          if (i % 2 === 1) {
            kb.row()
          }
        }
        do_not_optimize(kb)
      }).gc(`inner`)
    })

    group(`dispatch (text update -> handleFreeText, no-op handler)`, () => {
      bench(`dispatch: handleUpdate 1 update (no session, no network)`, async () => {
        do_not_optimize(await bot.bot.handleUpdate(buildUpdate(nextUpdateId++)))
        do_not_optimize(dispatchHits)
      })
    })

    await runBench()
  } finally {
    await bot.stop().catch(() => undefined)
    rmSync(dir, {recursive: true, force: true})
  }
  console.log(`Done.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
