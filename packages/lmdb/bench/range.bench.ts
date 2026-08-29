/**
 * Range query benchmark — keys/values/entries/iterate with different bounds, limits, reverse.
 *
 * Run: bun run packages/lmdb/bench/range.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbSchema, t} from "../src"

const POPULATE = 100_000
const ITERS = 500
const WARMUP = 50

class ItemSchema extends LmdbSchema {
  static db = `bench-range`
  static key = t.string()
  static value = {
    id: t.string(),
    val: t.number()
  }
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

async function bench(collected: BenchResult[], label: string, fn: () => Promise<unknown> | unknown, iterations = ITERS, warmup = WARMUP): Promise<BenchResult> {
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
  console.log(`  ${label.padEnd(40)} median=${fmtNs(median).padStart(10)} min=${fmtNs(min).padStart(10)} max=${fmtNs(max).padStart(10)} mean=${fmtNs(mean).padStart(10)}`)
  return result
}

function rankAndPrint(results: BenchResult[], title: string): void {
  if (results.length === 0) return
  const sorted = [...results].sort((a, b) => (a.median < b.median ? -1 : a.median > b.median ? 1 : 0))
  const winner = sorted[0]!
  const loser = sorted[sorted.length - 1]!
  console.log(`\n  -- ${title} --`)
  sorted.forEach((r, index) => {
    const rank = index + 1
    const isWinner = rank === 1
    const isLoser = rank === sorted.length && !isWinner
    const vsPct = ((Number(r.median) - Number(winner.median)) / Number(winner.median)) * 100
    const marker = isWinner ? `  🏆 WINNER` : isLoser ? `  💀 LOSER` : ``
    console.log(`    #${rank} ${r.label.padEnd(40)} median=${fmtNs(r.median).padStart(10)} vs-winner ${vsPct.toFixed(1)}%${marker}`)
  })
  const ratio = Number(loser.median) / Number(winner.median)
  console.log(`    Winner is ${ratio.toFixed(2)}x faster than loser`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-range-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 5})
  const items = env.register(ItemSchema)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    env.rootTransactionSync(() => {
      for (let i = start; i < end; i++) {
        items.putSync(`k${String(i).padStart(6, `0`)}`, {id: `k${i}`, val: i})
      }
    })
  }
  console.log(`Ready.\n`)

  console.log(`=== Range benchmark (${POPULATE} entries) ===\n`)

  const keysResults: BenchResult[] = []
  const valuesResults: BenchResult[] = []
  const entriesResults: BenchResult[] = []
  const iterateResults: BenchResult[] = []
  const allResults: BenchResult[] = []

  // --- keys ---
  await bench(keysResults, `keys() (all)`, () => items.keys())
  await bench(keysResults, `keys({limit:10})`, () => items.keys({limit: 10}))
  await bench(keysResults, `keys({limit:100})`, () => items.keys({limit: 100}))
  await bench(keysResults, `keys({limit:1000})`, () => items.keys({limit: 1000}))
  await bench(keysResults, `keys({reverse:true, limit:10})`, () => items.keys({reverse: true, limit: 10}))
  await bench(keysResults, `keys({start:"k000500", limit:10})`, () => items.keys({start: `k000500`, limit: 10}))
  await bench(keysResults, `keys({start:"k000500", end:"k001000"})`, () => items.keys({start: `k000500`, end: `k001000`}))
  rankAndPrint(keysResults, `Range / keys`)
  allResults.push(...keysResults)

  // --- values ---
  await bench(valuesResults, `values({limit:10})`, () => items.values({limit: 10}))
  await bench(valuesResults, `values({limit:100})`, () => items.values({limit: 100}))
  await bench(valuesResults, `values({reverse:true, limit:10})`, () => items.values({reverse: true, limit: 10}))
  rankAndPrint(valuesResults, `Range / values`)
  allResults.push(...valuesResults)

  // --- entries ---
  await bench(entriesResults, `entries() (all)`, () => items.entries())
  await bench(entriesResults, `entries({limit:10})`, () => items.entries({limit: 10}))
  await bench(entriesResults, `entries({limit:100})`, () => items.entries({limit: 100}))
  await bench(entriesResults, `entries({limit:1000})`, () => items.entries({limit: 1000}))
  await bench(entriesResults, `entries({reverse:true, limit:10})`, () => items.entries({reverse: true, limit: 10}))
  await bench(entriesResults, `entries({start:"k000500", limit:10})`, () => items.entries({start: `k000500`, limit: 10}))
  await bench(entriesResults, `entries({start:"k000500", end:"k001000"})`, () => items.entries({start: `k000500`, end: `k001000`}))
  rankAndPrint(entriesResults, `Range / entries`)
  allResults.push(...entriesResults)

  // --- iterate (async generator) ---
  await bench(iterateResults, `iterate({limit:10})`, async () => {
    for await (const _ of items.iterate({limit: 10})) {
      /* count */
    }
  })
  await bench(iterateResults, `iterate({limit:100})`, async () => {
    for await (const _ of items.iterate({limit: 100})) {
      /* count */
    }
  })

  // --- offset ---
  await bench(iterateResults, `entries({limit:10, offset:100})`, () => items.entries({limit: 10, offset: 100}))
  await bench(iterateResults, `entries({limit:10, offset:1000})`, () => items.entries({limit: 10, offset: 1000}))

  // --- first / last (edge queries) ---
  await bench(iterateResults, `first()`, () => items.first())
  await bench(iterateResults, `last()`, () => items.last())
  rankAndPrint(iterateResults, `Range / iterate & edges`)
  allResults.push(...iterateResults)

  rankAndPrint(allResults, `Range / all`)

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
