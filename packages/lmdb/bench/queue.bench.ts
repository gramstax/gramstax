/**
 * LmdbQueue benchmark — v2 single-transaction enqueue/dequeue.
 *
 * v2: enqueue bumps the monotonic sequence counter AND writes the payload in
 * ONE synchronous transaction (`env.transactionSync`), so the generated
 * zero-padded id and the payload commit atomically — FIFO order is preserved
 * even across processes. Dequeue reads the head through a synchronous cursor
 * and deletes it in ONE synchronous transaction.
 *
 * Run:   bun run packages/lmdb/bench/queue.bench.ts
 * Quick: BENCH_N=5000 bun run packages/lmdb/bench/queue.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbQueue} from "../src"

const N = Number(process.env.BENCH_N ?? 50_000)
const ITERS = Number(process.env.BENCH_ITERS ?? 300)
const WARMUP = 30

interface Job {
  id: string
  payload: {type: string; n: number}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtNs(ns: bigint): string {
  const n = Number(ns)
  if (n < 1_000) return `${n}ns`
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}us`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}ms`
  return `${(n / 1_000_000_000).toFixed(2)}s`
}

interface BenchResult {
  label: string
  median: bigint
  min: bigint
  max: bigint
  mean: bigint
}

async function bench(label: string, fn: () => Promise<unknown> | unknown, iterations = ITERS, warmup = WARMUP): Promise<BenchResult> {
  for (let i = 0; i < warmup; i++) await fn()
  const samples: bigint[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint()
    await fn()
    samples.push(process.hrtime.bigint() - t0)
  }
  samples.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const median = samples[Math.floor(samples.length / 2)] ?? 0n
  const min = samples[0] ?? 0n
  const max = samples[samples.length - 1] ?? 0n
  const sum = samples.reduce((a, b) => a + b, 0n)
  const mean = sum / BigInt(samples.length)
  console.log(`  ${label.padEnd(36)} median=${fmtNs(median).padStart(10)} min=${fmtNs(min).padStart(10)} max=${fmtNs(max).padStart(10)} mean=${fmtNs(mean).padStart(10)}`)
  return {label, median, min, max, mean}
}

function rankAndPrint(results: BenchResult[], title = `benchmark`): void {
  const sorted = [...results].sort((a, b) => (a.median < b.median ? -1 : a.median > b.median ? 1 : 0))
  const winner = sorted[0]
  const loser = sorted[sorted.length - 1]
  if (!winner) {
    console.log(`\n--- Ranking: ${title} (by median) — no results ---\n`)
    return
  }
  if (sorted.length < 2 || !loser) {
    console.log(`\n--- Ranking: ${title} (by median) ---\n  #1 🏆 ${winner.label}  median=${fmtNs(winner.median)}  +0.0% vs winner  (WINNER)\n`)
    return
  }
  const vsLoserPct = (Number(loser.median - winner.median) / Number(loser.median)) * 100
  const ratio = Number(loser.median) / Number(winner.median)
  console.log(`\n--- Ranking: ${title} (by median) ---`)
  for (const [i, r] of sorted.entries()) {
    const isWinner = i === 0
    const isLoser = i === sorted.length - 1
    const vsWinnerPct = (Number(r.median - winner.median) / Number(winner.median)) * 100
    const tag = isWinner ? `🏆` : isLoser ? `💀` : `  `
    const suffix = isWinner ? `+0.0% vs winner  (WINNER)` : `${vsWinnerPct.toFixed(1)}% slower vs winner${isLoser ? `  (LOSER)` : ``}`
    console.log(`  #${i + 1} ${tag} ${r.label.padEnd(36)} median=${fmtNs(r.median).padStart(10)}  ${suffix}`)
  }
  console.log(`Winner is ${ratio.toFixed(2)}x faster than loser: ${fmtNs(loser.median)} vs ${fmtNs(winner.median)} (winner uses ${vsLoserPct.toFixed(0)}% less time than loser)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-queue-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 10})
  const queue = new LmdbQueue<Job>(env, `jobs`)

  console.log(`Populating ${N} jobs via v2 enqueue (single txn each)...`)
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < N; i++) {
    await queue.enqueue({id: `job-${i}`, payload: {type: `bench`, n: i}})
  }
  const populate = process.hrtime.bigint() - t0
  console.log(`Enqueued ${N} jobs in ${fmtNs(populate)} — ${fmtNs(populate / BigInt(N))}/job (total, incl. per-txn sync commit)`)
  console.log(`Queue size: ${await queue.size()}\n`)

  console.log(`=== LmdbQueue v2 (single synchronous transaction per op, ${ITERS} iters) ===\n`)

  const results: BenchResult[] = []

  // v2 enqueue — counter bump + payload put in ONE transactionSync
  results.push(
    await bench(`enqueue 1 job (single txn)`, async () => {
      await queue.enqueue({id: `bench-${Date.now()}-${Math.random()}`, payload: {type: `bench`, n: 0}})
    })
  )

  // v2 dequeue — sync-cursor read + delete in ONE transactionSync
  results.push(
    await bench(`dequeue 1 job (single txn)`, async () => {
      const job = await queue.dequeue()
      if (job === undefined) throw new Error(`queue drained unexpectedly during dequeue bench`)
    })
  )

  rankAndPrint(results, `Queue v2 (enqueue vs dequeue)`)
  console.log(`\nSnapshot: N=${N} iters=${ITERS} tmp=${tmp} queueSize=${await queue.size()}`)

  await env.close()
  console.log(`\nDone. enqueue = seq bump + payload (atomic); dequeue = read head + delete (atomic).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
