/**
 * Users-per-second benchmark.
 *
 * Three roles, one file, three processes. Nothing shares an event loop with the
 * code being measured.
 *
 *   bun bench.ts mock   MockTelegramServer only — Telegram's stand-in. Serves the
 *                       bot's outgoing API calls and accepts incoming updates over
 *                       HTTP so an external loader can drive it. Update delivery
 *                       goes through the class's own `_postUpdate`.
 *   bun bench.ts bot    Gramstax bot only. Never talks to the loader.
 *   bun bench.ts run    Orchestrator: starts the mock, refuses to continue unless
 *                       the mock answers, starts the bot, drives k6 once per queue
 *                       setting, prints the comparison, exits.
 *
 * Load path, matching how Telegram actually reaches a bot:
 *
 *   k6 (users) -> POST /bot<token>/__bench/intake -> mock -> webhook -> Gramstax bot
 *                                                          -> ctx.reply -> sendMessage -> mock
 *
 * k6 is the only user generator. It measures the whole round trip, including the
 * reply back through the Bot API.
 */
import {spawn} from "node:child_process"
import {mkdtempSync, readFileSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"

const SELF = import.meta.filename
const ROLE = process.argv[2] ?? `run`
const TOKEN = `bench-token`
const SECRET = `bench-secret`

// ---------------------------------------------------------------------------
// role: mock
// ---------------------------------------------------------------------------

async function roleMock(): Promise<void> {
  const {MockTelegramServer} = await import(`../src/mock/telegram-server`)

  const mock = new MockTelegramServer({
    log: false as const,
    handlers: {
      sendMessage: () => {
        counters.replies += 1
        return {ok: true, result: {message_id: 1, date: Math.floor(Date.now() / 1000), chat: {id: 0, type: `private`}}}
      },
      "__bench/intake": ({request}: {request: {json: () => Promise<unknown>}}) => {
        return (async () => {
          const body = (await request.json().catch(() => undefined)) as {update?: Record<string, unknown>} | undefined
          const update = body?.update
          if (update === undefined || typeof update.update_id !== `number`) {
            return {ok: false, description: `intake requires {update: {update_id: number}}`}
          }
          counters.intake += 1
          try {
            await mock._postUpdate(update, {responseTimeoutMs: 30_000})
            counters.forwarded += 1
            return {ok: true, result: {forwarded: true}}
          } catch (error) {
            counters.failed += 1
            return {ok: false, description: String(error)}
          }
        })()
      },
      "__bench/stats": () => ({ok: true, result: {...counters, webhookUrl: mock.webhookUrl === `` ? null : mock.webhookUrl}})
    }
  })

  await mock.start()
  process.stdout.write(`${mock.apiRoot}\n`)
}

// ---------------------------------------------------------------------------
// role: bot
// ---------------------------------------------------------------------------

async function roleBot(): Promise<void> {
  const {Ctx, Gramstax, TemplateManager} = await import(`../src`)

  class BenchPage extends Ctx {
    static data = Ctx.buildData({name: `bench`})
    static template = `<g-base><g-message>pong {{echo}}</g-message></g-base>`

    async handleFreeText(): Promise<void> {
      await this.render(null, {echo: this.msg?.text ?? `empty`})
    }
  }

  class BenchBot extends Gramstax {
    override _pageLoads() {
      return this._buildEmptyPages()
    }
  }

  const apiRoot = process.env.BENCH_API_ROOT ?? ``
  if (apiRoot === ``) {
    throw new Error(`BENCH_API_ROOT is required (the mock's apiRoot)`)
  }
  const port = Number(process.env.BENCH_BOT_PORT ?? `0`)
  const queueEnabled = process.env.BENCH_QUEUE === `1`

  const dir = mkdtempSync(join(tmpdir(), `gramstax-bench-`))
  const manager = new TemplateManager({path: [dir]})
  manager.compile(`bench`, BenchPage.template as string)

  const queue = {enabled: queueEnabled, workerCount: Number(process.env.BENCH_WORKERS ?? `8`), perChatConcurrency: Number(process.env.BENCH_PER_CHAT ?? `1`), maxQueueSize: 50_000}
  const webhook = {url: `http://127.0.0.1:${port}/bench-hook`, secretToken: SECRET}

  const bot = new BenchBot({
    token: TOKEN,
    deploy: `webhook`,
    log: false as const,
    templateManager: manager,
    botConfig: {client: {apiRoot}},
    optionsDeploy: {webhook: {...webhook, queue}}
  })
  bot._pageSorts(BenchPage, bot.pages, 0)

  process.stdout.write(`READY ${port} queue=${queueEnabled ? `on` : `off`}\n`)

  const shutdown = async (): Promise<void> => {
    await bot.stop().catch(() => undefined)
    rmSync(dir, {recursive: true, force: true})
    process.exit(0)
  }
  process.on(`SIGINT`, () => void shutdown())
  process.on(`SIGTERM`, () => void shutdown())
}

// ---------------------------------------------------------------------------
// role: run
// ---------------------------------------------------------------------------

const counters = {intake: 0, forwarded: 0, failed: 0, replies: 0}

type Spawned = {child: ReturnType<typeof spawn>; stop: () => void}

function launch(role: string, env: Record<string, string>): Spawned {
  const child = spawn(`bun`, [SELF, role], {stdio: ["ignore", "pipe", "pipe"], env: {...process.env, ...env}})
  const stop = (): void => {
    child.kill()
    child.stdout?.destroy()
    child.stderr?.destroy()
  }
  return {child, stop}
}

async function readLine(child: Spawned["child"], timeoutMs: number, match: RegExp, what: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    let buffer = ``
    let stderr = ``
    child.stderr?.on(`data`, (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    const cleanup = (): void => {
      clearTimeout(timer)
      child.stdout?.off(`data`, onData)
    }
    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString()
      const lines = buffer.split(`\n`)
      buffer = lines.pop() ?? ``
      for (const line of lines) {
        if (match.test(line)) {
          cleanup()
          resolve(line.trim())
          return
        }
      }
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`${what} did not report within ${timeoutMs}ms\n${stderr.slice(-1200)}`))
    }, timeoutMs)
    child.stdout?.on(`data`, onData)
  })
}

async function ask(apiRoot: string, method: string): Promise<Record<string, number | string | null>> {
  const response = await fetch(`${apiRoot}/bot${TOKEN}/${method}`, {method: `POST`})
  const body = (await response.json()) as {result?: Record<string, number | string | null>}
  return body.result ?? {}
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function assertMockAlive(apiRoot: string): Promise<void> {
  try {
    const stats = await ask(apiRoot, `__bench/stats`)
    if (stats === null || typeof stats !== `object`) {
      throw new Error(`stats endpoint returned no result object`)
    }
  } catch (error) {
    throw new Error(`MockTelegramServer is not serving at ${apiRoot}: ${String(error)}`)
  }
}

async function runK6(apiRoot: string, env: Record<string, string>): Promise<{offered: number; p95: number}> {
  const dir = mkdtempSync(join(tmpdir(), `k6-bench-`))
  const summaryPath = join(dir, `summary.json`)
  try {
    await new Promise<void>((resolve, reject) => {
      const k6 = spawn(`k6`, [`run`, `--quiet`, `--summary-export`, summaryPath, join(import.meta.dir, `k6`, `intake-load.js`)], {
        stdio: ["ignore", "ignore", "pipe"],
        env: {...process.env, INTAKE_URL: `${apiRoot}/bot${TOKEN}/__bench/intake`, ...env}
      })
      let stderr = ``
      const onStderr = (chunk: Buffer): void => {
        stderr += chunk.toString()
      }
      k6.stderr?.on(`data`, onStderr)
      k6.on(`error`, reject)
      k6.on(`close`, (code) => {
        k6.stderr?.off(`data`, onStderr)
        k6.stderr?.destroy()
        if (code !== 0) {
          reject(new Error(`k6 exited ${code}\n${stderr.slice(-1200)}`))
          return
        }
        resolve()
      })
    })
    const summary = JSON.parse(readFileSync(summaryPath, `utf8`)) as {metrics: {http_reqs: {rate: number}; http_req_duration: {"p(95)": number}}}
    return {offered: summary.metrics.http_reqs.rate, p95: summary.metrics.http_req_duration["p(95)"]}
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

async function measure(apiRoot: string, queueEnabled: boolean): Promise<{offered: number; handled: number; p95: number; failed: number}> {
  const port = 34_000 + Math.floor(Math.random() * 3_000)
  const bot = launch(`bot`, {
    BENCH_API_ROOT: apiRoot,
    BENCH_BOT_PORT: String(port),
    BENCH_QUEUE: queueEnabled ? `1` : `0`,
    BENCH_WORKERS: process.env.BENCH_WORKERS ?? `8`,
    BENCH_PER_CHAT: process.env.BENCH_PER_CHAT ?? `1`
  })
  try {
    await readLine(bot.child, 30_000, /^READY/, `bot`)

    const before = await ask(apiRoot, `__bench/stats`)
    const k6 = await runK6(apiRoot, {
      RATE: process.env.RATE ?? `50`,
      DURATION: process.env.DURATION ?? `20s`,
      VUS: process.env.VUS ?? `50`,
      MAX_VUS: process.env.MAX_VUS ?? `400`
    })
    const after = await ask(apiRoot, `__bench/stats`)

    const seconds = Number((process.env.DURATION ?? `20s`).replace(/[^0-9.]/g, ``)) || 1
    return {
      offered: k6.offered,
      handled: ((after.replies as number) - (before.replies as number)) / seconds,
      p95: k6.p95,
      failed: (after.failed as number) - (before.failed as number)
    }
  } finally {
    bot.stop()
    await sleep(300)
  }
}

async function roleRun(): Promise<void> {
  const RATE = process.env.RATE ?? `50`
  const DURATION = process.env.DURATION ?? `20s`

  const mock = launch(`mock`, {})
  let apiRoot: string
  try {
    apiRoot = await readLine(mock.child, 30_000, /^http/, `MockTelegramServer`)
  } catch (error) {
    mock.stop()
    throw error
  }

  try {
    await assertMockAlive(apiRoot)
    console.log(`mock alive at ${apiRoot}`)

    const off = await measure(apiRoot, false)
    const on = await measure(apiRoot, true)

    console.log(`\ntarget ${RATE} users/s for ${DURATION}  (workers=${process.env.BENCH_WORKERS ?? `8`} perChat=${process.env.BENCH_PER_CHAT ?? `1`})`)
    console.log(`queue     | offered/s | handled/s | p95 ms | failures`)
    console.log(`----------+-----------+-----------+--------+---------`)
    for (const [label, r] of [
      ["off", off],
      ["on", on]
    ] as Array<[string, typeof off]>) {
      console.log(`${label.padEnd(9)} | ${r.offered.toFixed(1).padStart(9)} | ${r.handled.toFixed(1).padStart(9)} | ${r.p95.toFixed(0).padStart(6)} | ${String(r.failed).padStart(8)}`)
    }
    console.log(`\nhandled/s: queue ${off.handled > 0 ? (on.handled / off.handled).toFixed(2) : `n/a`}x vs sequential`)
  } finally {
    mock.stop()
    await sleep(300)
  }
}

if (ROLE === `mock`) {
  await roleMock()
} else if (ROLE === `bot`) {
  await roleBot()
} else if (ROLE === `run`) {
  await roleRun()
} else {
  throw new Error(`unknown role "${ROLE}" (expected mock, bot, or run)`)
}

// Only the orchestrator exits once its work is done. The `mock` and `bot` roles
// are servers and must stay resident until their parent kills them.
if (ROLE === `run`) {
  process.exit(0)
}
