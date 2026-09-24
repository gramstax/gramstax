/**
 * Concurrent real-user benchmark — webhook + queue mode only.
 *
 * Runner: plain `bun` (no mitata — this harness needs per-user latency
 * percentiles, not micro-bench stats). One scenario per concurrency; the
 * virtual-user fan-out lives inside the measured section. Each virtual user
 * sends message updates with a distinct chat/user id while the bot serves a
 * minimal page that renders a small template reply (thin handler: one
 * `render()` + one `sendMessage`, no sleeps, no extra IO), so the numbers
 * reflect framework overhead, not app logic.
 *
 * Deploy mode (production intake path, over real HTTP):
 * - `webhook-queue` — a real `Gramstax({deploy: "webhook:<url>"})` with
 *   `webhookQueue: {enabled: true, ...}` serves updates over HTTP. POST
 *   returns 200 OK on ENQUEUE (see `Gramstax._runWebhook` in
 *   `packages/gramstax/src/core/bot.ts`); a worker pool
 *   (`_startWebhookWorker`) drains the bounded FIFO afterwards.
 *
 * Mode semantics — HTTP 200 here means ENQUEUED, not handled. Intake and
 * completion are decoupled (fast 200s, completions trailing), so per-user
 * latency is enqueue-to-reply: each update carries a `bench-<uid>-<seq>`
 * token in its text, the page echoes it back through the template
 * (`pong {{echo}}`), and each captured `sendMessage` is matched to the
 * update that caused it — the same drain measurement as polling.
 * Throughput = completions/s (replies drained per second), not POSTs/s.
 * Queue stats are captured at level end via `GET /stats_queue` and the
 * residual queue length is appended to the table note.
 *
 * Run: bun packages/gramstax/bench/webhook-queue.bench.ts
 *
 * Knobs (all optional):
 * - `BENCH_CONC` — csv concurrency list, e.g. `10,50` (default `10,50,200`)
 * - `BENCH_MSG`  — messages per virtual user (default `5`)
 * - `BENCH_REPS` — repetitions per conc level, mean + min/max reported
 *   across reps (default `3`)
 * - `BENCH_WARMUP` — discarded warmup runs of the lowest-concurrency level
 *   before measured reps (default `1`; `0` disables)
 * - `BENCH_MOCK_RTT_MS` — simulated internet RTT: mock `sendMessage`
 *   handler awaits ~that many ms before responding (default `0` = current
 *   behavior, byte-identical)
 * - `BENCH_QUEUE_WORKERS` — queue worker pool size, maps 1:1 to the
 *   framework's `ITWebhookQueueConfig.workerCount` (default `8`)
 * - `BENCH_QUEUE_PER_CHAT` — max concurrent updates per chat, maps 1:1 to
 *   `ITWebhookQueueConfig.perChatConcurrency` (default `1`; `0` disables
 *   per-chat locking)
 * - `BENCH_QUEUE_MAX` — bounded queue capacity, maps 1:1 to
 *   `ITWebhookQueueConfig.maxQueueSize` (default `5000`)
 *
 * Rigor notes: all latency/duration deltas use the high-resolution
 * `performance.now()` clock (never `Date.now()` for deltas); `Bun.gc()`
 * (guarded) runs between levels/reps so GC pauses do not leak across
 * samples; spread across reps is reported as min/max.
 *
 * @internal
 */

import {MockTelegramServer} from "../src"
import {BenchBot, CONCURRENCY, DRAIN_TIMEOUT_MS, MESSAGES_PER_USER, READY_TIMEOUT_MS, TOKEN, botParams, buildUpdate, cleanupTemplateDir, extractToken, getFreePort, makeTemplateManager, mockRttHandlers, nowMs, printEnv, printTable, registerBenchPage, runLevel, runWarmup, sendMessageRecords, summarize, tokenFor, waitFor, waitForAsync, waitForHealth, type LevelAggregate, type LevelResult} from "./_setup"

const RUN_LINE = `bun packages/gramstax/bench/webhook-queue.bench.ts`
const QUEUE_WORKERS = Math.max(1, Number(process.env.BENCH_QUEUE_WORKERS ?? `8`))
const QUEUE_PER_CHAT = Math.max(0, Number(process.env.BENCH_QUEUE_PER_CHAT ?? `1`))
const QUEUE_MAX = Math.max(1, Number(process.env.BENCH_QUEUE_MAX ?? `5000`))

async function runWebhookQueueLevel(conc: number): Promise<LevelResult> {
  const total = conc * MESSAGES_PER_USER
  const {manager, dir} = makeTemplateManager()
  const mock = new MockTelegramServer({handlers: mockRttHandlers()})
  await mock.start()
  const port = await getFreePort()
  const path = `/bench-hook`
  const bot = new BenchBot(
    botParams(TOKEN, `webhook:http://127.0.0.1:${port}${path}`, mock.apiRoot, manager, {
      enabled: true,
      workerCount: QUEUE_WORKERS,
      perChatConcurrency: QUEUE_PER_CHAT,
      maxQueueSize: QUEUE_MAX
    })
  )
  registerBenchPage(bot)

  const base: Omit<LevelResult, `throughput` | `p50` | `p99`> = {mode: `webhook-queue`, conc, total, errors: 0, durationMs: 0, note: null}
  try {
    const ready = await waitFor(() => mock.webhookUrl.length > 0, READY_TIMEOUT_MS)
    if (!ready) {
      return {...base, throughput: null, p50: null, p99: null, note: `NOT-RUN: bot never called setWebhook`}
    }
    const healthy = await waitForHealth(`http://127.0.0.1:${port}/health`)
    if (!healthy) {
      return {...base, throughput: null, p50: null, p99: null, note: `NOT-RUN: webhook server never healthy`}
    }

    let updateId = 1
    const sentAt = new Map<string, number>()
    let errors = 0
    const startedAt = nowMs()
    await Promise.all(
      Array.from({length: conc}, (_, uid) => {
        return (async () => {
          for (let seq = 0; seq < MESSAGES_PER_USER; seq++) {
            const token = tokenFor(uid, seq)
            const update = buildUpdate(updateId++, uid, seq)
            sentAt.set(token, nowMs())
            try {
              const response = await fetch(mock.webhookUrl, {
                method: `POST`,
                headers: {"Content-Type": `application/json`},
                body: JSON.stringify(update)
              })
              if (!response.ok) {
                errors += 1
              }
              await response.text().catch(() => ``)
            } catch {
              errors += 1
            }
          }
        })()
      })
    )

    const seenTokens = new Set<string>()
    const latencies: Array<number> = []
    let stamped = 0
    const drained = await waitForAsync(async () => {
      for (const record of sendMessageRecords(mock.requests).slice(stamped)) {
        stamped += 1
        const token = extractToken(record)
        if (token !== null && !seenTokens.has(token)) {
          seenTokens.add(token)
          const sent = sentAt.get(token)
          if (sent !== undefined) {
            latencies.push(nowMs() - sent)
          }
        }
      }
      return seenTokens.size >= total
    }, DRAIN_TIMEOUT_MS)
    const durationMs = nowMs() - startedAt

    const queueNote = await fetch(`http://127.0.0.1:${port}/stats_queue`)
      .then((response) => response.json() as Promise<{queue?: {length?: unknown}}>)
      .then((stats) => (typeof stats.queue?.length === `number` ? `queueLen=${stats.queue.length}` : `queueLen=?`))
      .catch(() => `queueLen=?`)

    if (!drained) {
      return {...base, durationMs, throughput: null, p50: null, p99: null, note: `NOT-RUN: drained ${seenTokens.size}/${total} replies before ${DRAIN_TIMEOUT_MS}ms timeout; ${queueNote}`}
    }
    const missing = total - seenTokens.size
    return {...base, errors: errors + missing, durationMs, note: queueNote, ...summarize(latencies, total, durationMs)}
  } finally {
    await bot.stop().catch(() => undefined)
    await mock.stop().catch(() => undefined)
    cleanupTemplateDir(dir)
  }
}

export async function main(): Promise<void> {
  printEnv(RUN_LINE, ` queueWorkers=${QUEUE_WORKERS} queuePerChat=${QUEUE_PER_CHAT} queueMax=${QUEUE_MAX}`)
  const results: Array<LevelAggregate> = []
  await runWarmup(runWebhookQueueLevel)
  for (const conc of CONCURRENCY) {
    results.push(await runLevel(`webhook-queue`, conc, runWebhookQueueLevel))
    printTable(results)
  }
  console.log(`Done.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
