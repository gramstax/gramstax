/**
 * CRUD benchmark — basic put, get, has, delete, count throughput.
 *
 * Run: bun run packages/lmdb/bench/crud.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

const POPULATE = 20_000
const ITERS = 5_000
const WARMUP = 200

interface Item {
  id: string
  name: string
  score: number
  tags: string[]
}

class ItemRepo extends LmdbRepository<Item, string> {
  static dbName = `bench-crud`
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

async function bench(label: string, fn: () => Promise<unknown> | unknown, collected: BenchResult[], iterations = ITERS, warmup = WARMUP): Promise<BenchResult> {
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
  const result: BenchResult = {label, median, min, max, mean}
  collected.push(result)
  console.log(`  ${label.padEnd(32)} median=${fmtNs(median).padStart(10)} min=${fmtNs(min).padStart(10)} max=${fmtNs(max).padStart(10)} mean=${fmtNs(mean).padStart(10)}`)
  return result
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
    console.log(`  #${i + 1} ${tag} ${r.label.padEnd(32)} median=${fmtNs(r.median).padStart(10)}  ${suffix}`)
  }
  console.log(`Winner is ${ratio.toFixed(2)}x faster than loser: ${fmtNs(loser.median)} vs ${fmtNs(winner.median)} (winner uses ${vsLoserPct.toFixed(0)}% less time than loser)`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-crud-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 5})
  const repo = env.register(ItemRepo)
  const collected: BenchResult[] = []

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    repo.env.transactionSync(() => {
      for (let i = start; i < end; i++) {
        repo.env.putSync(`k${i}`, {id: `k${i}`, name: `name${i}`, score: i % 100, tags: [`tag${i % 10}`]})
      }
    })
  }
  console.log(`Ready.\n`)

  console.log(`=== CRUD benchmark (${POPULATE} entries, ${ITERS} iters, ${WARMUP} warmup) ===\n`)

  const existingKeys = [`k0`, `k${Math.floor(POPULATE / 2)}`, `k${POPULATE - 1}`]
  const missingKey = `__nonexistent__`
  const writeKey = `__bench_write__`

  await bench(
    `get (existing)`,
    async () => {
      for (const k of existingKeys) await repo.get(k)
    },
    collected
  )
  await bench(
    `get (missing)`,
    async () => {
      for (let i = 0; i < 3; i++) await repo.get(missingKey)
    },
    collected
  )
  await bench(
    `has (existing)`,
    async () => {
      for (const k of existingKeys) await repo.has(k)
    },
    collected
  )
  await bench(
    `has (missing)`,
    async () => {
      for (let i = 0; i < 3; i++) await repo.has(missingKey)
    },
    collected
  )
  await bench(
    `put (new key)`,
    async () => {
      repo.env.transactionSync(() => {
        repo.env.putSync(`${writeKey}:0`, {id: `w`, name: `write`, score: 0, tags: [`w`]})
        repo.env.putSync(`${writeKey}:1`, {id: `w`, name: `write`, score: 0, tags: [`w`]})
        repo.env.putSync(`${writeKey}:2`, {id: `w`, name: `write`, score: 0, tags: [`w`]})
      })
    },
    collected
  )
  await bench(
    `put (overwrite)`,
    async () => {
      repo.env.transactionSync(() => {
        for (const k of existingKeys) repo.env.putSync(k, {id: k, name: `updated`, score: 99, tags: [`u`]})
      })
    },
    collected
  )
  await bench(
    `delete (existing)`,
    async () => {
      repo.env.transactionSync(() => {
        repo.env.putSync(`__del:0`, {id: `d`, name: `del`, score: 0, tags: [`d`]})
        repo.env.putSync(`__del:1`, {id: `d`, name: `del`, score: 0, tags: [`d`]})
        repo.env.putSync(`__del:2`, {id: `d`, name: `del`, score: 0, tags: [`d`]})
      })
      repo.env.transactionSync(() => {
        repo.env.removeSync(`__del:0`)
        repo.env.removeSync(`__del:1`)
        repo.env.removeSync(`__del:2`)
      })
    },
    collected
  )
  await bench(
    `count`,
    async () => {
      for (let i = 0; i < 3; i++) await repo.count()
    },
    collected
  )
  await bench(
    `getMany (10 keys)`,
    async () => {
      await repo.getMany([`k0`, `k1`, `k2`, `k3`, `k4`, `k5`, `k6`, `k7`, `k8`, `k9`])
    },
    collected
  )

  rankAndPrint(collected, `CRUD`)
  const readLabels = new Set([`get (existing)`, `get (missing)`, `has (existing)`, `has (missing)`, `count`, `getMany (10 keys)`])
  const writeLabels = new Set([`put (new key)`, `put (overwrite)`, `delete (existing)`])
  rankAndPrint(
    collected.filter((r) => readLabels.has(r.label)),
    `CRUD / reads`
  )
  rankAndPrint(
    collected.filter((r) => writeLabels.has(r.label)),
    `CRUD / writes`
  )

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
