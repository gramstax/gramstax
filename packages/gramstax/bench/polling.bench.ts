/**
 * Concurrent real-user benchmark — polling mode only.
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
 * - `polling` — a real `Gramstax({deploy: "polling"})` long-polls
 *   `getUpdates` against `MockTelegramServer` (whose `getUpdates` handler
 *   serves a pre-filled per-level queue, honoring `offset`). Concurrency
 *   here means N distinct users queued at once; the loop drains them
 *   sequentially.
 *
 * Per-update latency is correlated exactly: every update carries a
 * `bench-<uid>-<seq>` token in its text and the page echoes it back through
 * the template (`pong {{echo}}`), so each captured `sendMessage` is matched
 * to the update that caused it. Completion = drain (all tokens echoed).
 *
 * Run: bun packages/gramstax/bench/polling.bench.ts
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
import {BenchBot, CONCURRENCY, DRAIN_TIMEOUT_MS, MESSAGES_PER_USER, TOKEN, botParams, buildUpdate, cleanupTemplateDir, extractToken, makeTemplateManager, mockRttHandlers, nowMs, printEnv, printTable, registerBenchPage, runLevel, runWarmup, sendMessageRecords, summarize, tokenFor, waitForAsync, type LevelAggregate, type LevelResult} from "./_setup"

const RUN_LINE = `bun packages/gramstax/bench/polling.bench.ts`

async function runPollingLevel(conc: number): Promise<LevelResult> {
  const total = conc * MESSAGES_PER_USER
  const base: Omit<LevelResult, `throughput` | `p50` | `p99`> = {mode: `polling`, conc, total, errors: 0, durationMs: 0, note: null}

  const queue: Array<Record<string, unknown>> = []
  const sentAt = new Map<string, number>()
  let updateId = 1
  for (let uid = 0; uid < conc; uid++) {
    for (let seq = 0; seq < MESSAGES_PER_USER; seq++) {
      queue.push(buildUpdate(updateId++, uid, seq))
      sentAt.set(tokenFor(uid, seq), nowMs())
    }
  }

  const {manager, dir} = makeTemplateManager()
  const mock = new MockTelegramServer({
    handlers: {
      ...mockRttHandlers(),
      getUpdates: ({request}) => {
        return (async () => {
          const body = (await request.json().catch(() => undefined)) as {offset?: unknown} | undefined
          const offset = typeof body?.offset === `number` ? body.offset : 0
          const batch = queue.filter((update) => (update.update_id as number) >= offset).slice(0, 100)
          return {ok: true, result: batch}
        })()
      }
    }
  })
  await mock.start()
  const bot = new BenchBot(botParams(TOKEN, `polling`, mock.apiRoot, manager))
  registerBenchPage(bot)

  try {
    const startedAt = nowMs()
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

    if (!drained) {
      return {...base, durationMs, throughput: null, p50: null, p99: null, note: `NOT-RUN: drained ${seenTokens.size}/${total} replies before ${DRAIN_TIMEOUT_MS}ms timeout`}
    }
    return {...base, durationMs, ...summarize(latencies, total, durationMs)}
  } finally {
    await bot.stop().catch(() => undefined)
    await mock.stop().catch(() => undefined)
    cleanupTemplateDir(dir)
  }
}

export async function main(): Promise<void> {
  printEnv(RUN_LINE)
  const results: Array<LevelAggregate> = []
  await runWarmup(runPollingLevel)
  for (const conc of CONCURRENCY) {
    results.push(await runLevel(`polling`, conc, runPollingLevel))
    printTable(results)
  }
  console.log(`Done.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
