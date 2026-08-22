/**
 * Transaction benchmark — single-write, batch, cross-repo throughput.
 *
 * Run: bun run packages/lmdb/bench/transaction.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

const POPULATE = 10_000
const ITERS = 500
const WARMUP = 50

interface Item {
  id: string
  value: number
}
interface Log {
  ts: number
  msg: string
}

class ItemRepo extends LmdbRepository<Item, string> {
  static dbName = `bench-tx-item`
}

class LogRepo extends LmdbRepository<Log, string> {
  static dbName = `bench-tx-log`
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
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-tx-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 10})
  const items = env.register(ItemRepo)
  const logs = env.register(LogRepo)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    items.env.transactionSync(() => {
      for (let i = start; i < end; i++) {
        items.env.putSync(`k${i}`, {id: `k${i}`, value: i})
      }
    })
  }
  console.log(`Ready.\n`)

  console.log(`=== Transaction benchmark (${ITERS} iters) ===\n`)

  const results: BenchResult[] = []

  // Single write inside transaction
  results.push(
    await bench(`tx single put`, async () => {
      await env.transaction(async () => {
        await items.put(`_tx1`, {id: `_tx1`, value: Date.now()})
      })
    })
  )

  // Read + write inside transaction
  results.push(
    await bench(`tx read-then-put`, async () => {
      await env.transaction(async () => {
        const cur = await items.get(`k0`)
        await items.put(`k0`, {id: `k0`, value: (cur?.value ?? 0) + 1})
      })
    })
  )

  // Cross-repo transaction (two repos)
  results.push(
    await bench(`tx cross-repo (2 repos)`, async () => {
      await env.transaction(async () => {
        await items.put(`_tx_cr`, {id: `_tx_cr`, value: Date.now()})
        await logs.put(`_log_cr`, {ts: Date.now(), msg: `cross-repo tx`})
      })
    })
  )

  // Batch write (multiple puts in one tx)
  results.push(
    await bench(`tx batch 10 puts`, async () => {
      await env.transaction(async () => {
        for (let i = 0; i < 10; i++) {
          await items.put(`_batch:${i}`, {id: `_batch:${i}`, value: i})
        }
      })
    })
  )

  // Transaction with abort
  results.push(
    await bench(`tx abort (rollback)`, async () => {
      await env.transaction(async (tx) => {
        await items.put(`_abort_test`, {id: `_abort_test`, value: 0})
        tx.abort()
      })
    })
  )

  // Read-only transaction
  results.push(
    await bench(`readTransaction (snapshot)`, async () => {
      await env.readTransaction(async () => {
        await items.get(`k0`)
        await items.get(`k100`)
        await items.get(`k500`)
      })
    })
  )

  // writeTransaction + readTransaction combo
  results.push(
    await bench(`tx write + read snapshot`, async () => {
      await env.transaction(async () => {
        await items.put(`_combo`, {id: `_combo`, value: Date.now()})
      })
      await env.readTransaction(async () => {
        await items.get(`_combo`)
      })
    })
  )

  rankAndPrint(results, `Transaction / all`)
  rankAndPrint([results[0]!, results[1]!, results[2]!, results[3]!], `Transaction / write`)
  rankAndPrint([results[5]!, results[6]!], `Transaction / read`)

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
