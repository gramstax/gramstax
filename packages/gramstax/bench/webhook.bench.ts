/**
 * Concurrent real-user benchmark — webhook (queue-disabled) mode only.
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
 * - `webhook` — a real `Gramstax({deploy: "webhook", optionsDeploy: {url}})` serves updates
 *   over HTTP (queue disabled, so the 200 OK is sent after the handler
 *   finishes). N virtual users POST concurrently; per-user latency is
 *   measured from POST start to 200 OK.
 *
 * Per-update latency is correlated exactly: every update carries a
 * `bench-<uid>-<seq>` token in its text and the page echoes it back through
 * the template (`pong {{echo}}`), so each captured `sendMessage` is matched
 * to the update that caused it. A reply-count check guards against silent
 * drops (missing replies count as errors).
 *
 * Run: bun packages/gramstax/bench/webhook.bench.ts
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
 *
 * Rigor notes: all latency/duration deltas use the high-resolution
 * `performance.now()` clock (never `Date.now()` for deltas); `Bun.gc()`
 * (guarded) runs between levels/reps so GC pauses do not leak across
 * samples; spread across reps is reported as min/max.
 *
 * @internal
 */

import {MockTelegramServer} from "../src"
import {BenchBot, CONCURRENCY, MESSAGES_PER_USER, READY_TIMEOUT_MS, TOKEN, botParams, buildUpdate, cleanupTemplateDir, getFreePort, makeTemplateManager, mockRttHandlers, nowMs, printEnv, printTable, registerBenchPage, runLevel, runWarmup, sendMessageRecords, summarize, waitFor, waitForHealth, type LevelAggregate, type LevelResult} from "./_setup"

const RUN_LINE = `bun packages/gramstax/bench/webhook.bench.ts`

async function runWebhookLevel(conc: number): Promise<LevelResult> {
  const total = conc * MESSAGES_PER_USER
  const {manager, dir} = makeTemplateManager()
  const mock = new MockTelegramServer({handlers: mockRttHandlers()})
  await mock.start()
  const port = await getFreePort()
  const path = `/bench-hook`
  const bot = new BenchBot(botParams(TOKEN, `webhook`, mock.apiRoot, manager, undefined, {url: `http://127.0.0.1:${port}${path}`}))
  registerBenchPage(bot)

  const base: Omit<LevelResult, `throughput` | `p50` | `p99`> = {mode: `webhook`, conc, total, errors: 0, durationMs: 0, note: null}
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
    const latencies: Array<number> = []
    let errors = 0
    const startedAt = nowMs()
    await Promise.all(
      Array.from({length: conc}, (_, uid) => {
        return (async () => {
          for (let seq = 0; seq < MESSAGES_PER_USER; seq++) {
            const update = buildUpdate(updateId++, uid, seq)
            const sentAt = nowMs()
            try {
              const response = await fetch(mock.webhookUrl, {
                method: `POST`,
                headers: {"Content-Type": `application/json`},
                body: JSON.stringify(update)
              })
              latencies.push(nowMs() - sentAt)
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
    const durationMs = nowMs() - startedAt

    const replies = sendMessageRecords(mock.requests).length
    if (replies < total) {
      errors += total - replies
    }
    return {...base, errors, durationMs, ...summarize(latencies, total, durationMs)}
  } finally {
    await bot.stop().catch(() => undefined)
    await mock.stop().catch(() => undefined)
    cleanupTemplateDir(dir)
  }
}

export async function main(): Promise<void> {
  printEnv(RUN_LINE)
  const results: Array<LevelAggregate> = []
  await runWarmup(runWebhookLevel)
  for (const conc of CONCURRENCY) {
    results.push(await runLevel(`webhook`, conc, runWebhookLevel))
    printTable(results)
  }
  console.log(`Done.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
