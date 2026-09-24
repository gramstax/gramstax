/**
 * Shared harness for the concurrent real-user bench files.
 *
 * Mode-independent half of `concurrent.bench.ts` (since split): bench bot /
 * page / template, update construction, token-echo correlation, latency
 * percentile + rep-aggregation helpers, mock + bot builders, env-knob
 * parsing, table printing. Each `*.bench.ts` in this directory imports from
 * here and adds exactly one deploy mode plus its `main()`.
 *
 * @internal
 */

import {mkdtempSync, rmSync} from "node:fs"
import {arch, cpus, platform, tmpdir, totalmem} from "node:os"
import {join} from "node:path"
import {Ctx, Gramstax, MockTelegramServer, TemplateManager} from "../src"
import type {ITMockTelegramRequestRecord, ITWebhookQueueConfig} from "../src"

export const CONCURRENCY: ReadonlyArray<number> = process.env.BENCH_CONC?.split(`,`).map(Number).filter((n) => n > 0) ?? [10, 50, 200]
export const MESSAGES_PER_USER = Number(process.env.BENCH_MSG ?? `5`)
export const BENCH_REPS = Math.max(1, Number(process.env.BENCH_REPS ?? `3`))
export const BENCH_WARMUP = Math.max(0, Number(process.env.BENCH_WARMUP ?? `1`))
export const BENCH_MOCK_RTT_MS = Math.max(0, Number(process.env.BENCH_MOCK_RTT_MS ?? `0`))
export const DRAIN_TIMEOUT_MS = 90_000
export const READY_TIMEOUT_MS = 15_000
export const POLL_STEP_MS = 10
export const USER_ID_BASE = 500_000
export const TOKEN = `bench-token`

export type BenchMode = `polling` | `webhook` | `webhook-queue`

export type LevelResult = {
  mode: BenchMode
  conc: number
  total: number
  errors: number
  throughput: number | null
  p50: number | null
  p99: number | null
  durationMs: number
  note: string | null
}

export type LevelAggregate = {
  mode: BenchMode
  conc: number
  total: number
  reps: number
  throughputMean: number | null
  throughputMin: number | null
  throughputMax: number | null
  p50Mean: number | null
  p50Min: number | null
  p50Max: number | null
  p99Mean: number | null
  p99Min: number | null
  p99Max: number | null
  errorsMean: number
  durationMsMean: number
  note: string | null
}

// ---------------------------------------------------------------------------
// Minimal bench bot (thin handler: render one small template reply)
// ---------------------------------------------------------------------------

export const BENCH_PAGE = `bench`
export const BENCH_TEMPLATE = `<g-base><g-message>pong {{echo}}</g-message></g-base>`

export class BenchPage extends Ctx {
  static data = Ctx.buildData({name: BENCH_PAGE})

  async handleFreeText(): Promise<void> {
    const echo = this.msg?.text ?? `empty`
    await this.render(null, {echo})
  }

  static template = BENCH_TEMPLATE
}

export class BenchBot extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages()
  }
}

export function registerBenchPage(bot: BenchBot): void {
  const templateManager = bot.templateManager
  if (templateManager === undefined) {
    throw new Error(`BenchBot has no templateManager`)
  }
  templateManager._compile(BENCH_PAGE, BENCH_TEMPLATE)
  bot._pageSorts(BenchPage, bot.pages, 0)
}

export function botParams(token: string, deploy: string, apiRoot: string, templateManager: TemplateManager, webhookQueue?: ITWebhookQueueConfig) {
  return {
    token,
    deploy,
    log: false as const,
    templateManager,
    botConfig: {
      client: {
        apiRoot
      }
    },
    ...(webhookQueue === undefined ? {} : {webhookQueue})
  }
}

export function makeTemplateManager(): {manager: TemplateManager; dir: string} {
  const dir = mkdtempSync(join(tmpdir(), `gramstax-bench-`))
  return {manager: new TemplateManager({path: [dir]}), dir}
}

export function cleanupTemplateDir(dir: string): void {
  rmSync(dir, {recursive: true, force: true})
}

// ---------------------------------------------------------------------------
// Update construction + latency helpers
// ---------------------------------------------------------------------------

export function tokenFor(uid: number, seq: number): string {
  return `bench-${uid}-${seq}`
}

export function buildUpdate(updateId: number, uid: number, seq: number): Record<string, unknown> {
  const chatId = USER_ID_BASE + uid
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: {id: chatId, type: `private`, first_name: `Bench`},
      from: {id: chatId, is_bot: false, first_name: `Bench`, language_code: `en`},
      text: tokenFor(uid, seq)
    }
  }
}

export function percentile(sorted: Array<number>, p: number): number | null {
  if (sorted.length === 0) {
    return null
  }
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] ?? null
}

export function summarize(latencies: Array<number>, total: number, durationMs: number): Omit<LevelResult, `mode` | `conc` | `total` | `errors` | `durationMs` | `note`> {
  const sorted = [...latencies].sort((a, b) => a - b)
  const seconds = durationMs / 1000
  return {
    throughput: seconds > 0 ? total / seconds : null,
    p50: percentile(sorted, 0.5),
    p99: percentile(sorted, 0.99)
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export function nowMs(): number {
  return performance.now()
}

export function maybeGc(): void {
  if (typeof Bun !== `undefined` && typeof Bun.gc === `function`) {
    Bun.gc()
  }
}

export function mockRttHandlers(): Record<string, (payload: {method: string; request: Request}) => Promise<{ok: boolean; result: unknown}> | {ok: boolean; result: unknown}> {
  if (BENCH_MOCK_RTT_MS <= 0) {
    return {}
  }
  return {
    sendMessage: () => {
      return (async () => {
        await sleep(BENCH_MOCK_RTT_MS)
        return {ok: true, result: {message_id: 1, date: Math.floor(Date.now() / 1000), chat: {id: 0, type: `private`}}}
      })()
    }
  }
}

export function mean(values: Array<number>): number | null {
  if (values.length === 0) {
    return null
  }
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function minOf(values: Array<number>): number | null {
  return values.length === 0 ? null : Math.min(...values)
}

export function maxOf(values: Array<number>): number | null {
  return values.length === 0 ? null : Math.max(...values)
}

export function aggregateLevel(mode: BenchMode, conc: number, total: number, reps: Array<LevelResult>): LevelAggregate {
  const throughputs = reps.map((r) => r.throughput).filter((v): v is number => v !== null)
  const p50s = reps.map((r) => r.p50).filter((v): v is number => v !== null)
  const p99s = reps.map((r) => r.p99).filter((v): v is number => v !== null)
  const notes = reps.map((r) => r.note).filter((n): n is string => n !== null)
  return {
    mode,
    conc,
    total,
    reps: reps.length,
    throughputMean: mean(throughputs),
    throughputMin: minOf(throughputs),
    throughputMax: maxOf(throughputs),
    p50Mean: mean(p50s),
    p50Min: minOf(p50s),
    p50Max: maxOf(p50s),
    p99Mean: mean(p99s),
    p99Min: minOf(p99s),
    p99Max: maxOf(p99s),
    errorsMean: reps.length === 0 ? 0 : reps.reduce((a, r) => a + r.errors, 0) / reps.length,
    durationMsMean: reps.length === 0 ? 0 : reps.reduce((a, r) => a + r.durationMs, 0) / reps.length,
    note: notes.length > 0 ? notes.join(`; `) : null
  }
}

export async function waitFor(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const startedAt = nowMs()
  while (!condition()) {
    if (nowMs() - startedAt > timeoutMs) {
      return false
    }
    await sleep(POLL_STEP_MS)
  }
  return true
}

export async function waitForAsync(condition: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const startedAt = nowMs()
  while (!(await condition())) {
    if (nowMs() - startedAt > timeoutMs) {
      return false
    }
    await sleep(POLL_STEP_MS)
  }
  return true
}

export function sendMessageRecords(requests: Array<ITMockTelegramRequestRecord>): Array<ITMockTelegramRequestRecord> {
  return requests.filter((request) => request.method === `sendMessage`)
}

export function extractToken(record: ITMockTelegramRequestRecord): string | null {
  const text = (record.body as {text?: unknown} | undefined)?.text
  if (typeof text !== `string`) {
    return null
  }
  const match = text.match(/bench-\d+-\d+/)
  return match?.[0] ?? null
}

export async function getFreePort(): Promise<number> {
  const probe = Bun.serve({port: 0, hostname: `127.0.0.1`, fetch: () => new Response(`probe`)})
  const port = probe.port ?? 0
  probe.stop(true)
  return port
}

export async function waitForHealth(url: string): Promise<boolean> {
  return waitForAsync(async () => {
    try {
      const response = await fetch(url)
      return response.ok
    } catch {
      return false
    }
  }, READY_TIMEOUT_MS)
}

// ---------------------------------------------------------------------------
// Shared reporting + rep loop
// ---------------------------------------------------------------------------

export function formatCell(value: number | null, digits = 1): string {
  return value === null ? `NOT-RUN` : value.toFixed(digits)
}

export function formatRange(min: number | null, max: number | null, digits = 1): string {
  return min === null || max === null ? `NOT-RUN` : `${min.toFixed(digits)}-${max.toFixed(digits)}`
}

export function printEnv(runLine: string, extraConfig?: string): void {
  const cpuList = cpus()
  const model = cpuList[0]?.model ?? `unknown`
  console.log(`# gramstax concurrent real-user benchmark`)
  console.log(``)
  console.log(`Run: ${runLine}`)
  console.log(`Env: ${platform()} ${arch()} | CPU: ${model} x${cpuList.length} | RAM: ${(totalmem() / 1024 ** 3).toFixed(1)} GiB | bun ${Bun.version}`)
  console.log(`Config: conc=[${CONCURRENCY.join(`,`)}] messagesPerUser=${MESSAGES_PER_USER} (total per level = conc x msg) reps=${BENCH_REPS} warmup=${BENCH_WARMUP} mockRttMs=${BENCH_MOCK_RTT_MS}${extraConfig ?? ``}`)
  console.log(`Clock: performance.now() (high-resolution); spread across reps reported as min-max`)
  console.log(``)
}

export function printTable(results: Array<LevelAggregate>): void {
  console.log(`| mode | conc | total | reps | throughput mean (upd/s) | throughput min-max | p50 mean (ms) | p50 min-max | p99 mean (ms) | p99 min-max | errors (mean) | note |`)
  console.log(`|------|------|-------|------|-------------------------|--------------------|---------------|-------------|---------------|-------------|---------------|------|`)
  for (const row of results) {
    console.log(`| ${row.mode} | ${row.conc} | ${row.total} | ${row.reps} | ${formatCell(row.throughputMean)} | ${formatRange(row.throughputMin, row.throughputMax)} | ${formatCell(row.p50Mean)} | ${formatRange(row.p50Min, row.p50Max)} | ${formatCell(row.p99Mean)} | ${formatRange(row.p99Min, row.p99Max)} | ${row.errorsMean.toFixed(1)} | ${row.note ?? ``} |`)
  }
  console.log(``)
}

export async function runLevel(mode: BenchMode, conc: number, runOne: (conc: number) => Promise<LevelResult>): Promise<LevelAggregate> {
  const total = conc * MESSAGES_PER_USER
  const reps: Array<LevelResult> = []
  for (let rep = 0; rep < BENCH_REPS; rep++) {
    maybeGc()
    reps.push(await runOne(conc))
  }
  maybeGc()
  return aggregateLevel(mode, conc, total, reps)
}

export async function runWarmup(runOne: (conc: number) => Promise<LevelResult>): Promise<void> {
  const lowest = CONCURRENCY[0] ?? 10
  for (let w = 0; w < BENCH_WARMUP; w++) {
    await runOne(lowest)
    maybeGc()
  }
}
