/**
 * Query helpers benchmark — like, findByPrefix, countByPrefix, first, last, entries, keys, values, iterate.
 *
 * Run: bun run packages/lmdb/bench/queries.bench.ts
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

const POPULATE = 50_000
const PREFIX_COUNT = 500
const ITERS = 200
const WARMUP = 50

interface User {
  id: string
  name: string
  age: number
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `bench-queries`
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
  console.log(`  ${label.padEnd(36)} median=${fmtNs(median).padStart(10)} min=${fmtNs(min).padStart(10)} max=${fmtNs(max).padStart(10)} mean=${fmtNs(mean).padStart(10)}`)
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
    console.log(`    #${rank} ${r.label.padEnd(36)} median=${fmtNs(r.median).padStart(10)} vs-winner ${vsPct.toFixed(1)}%${marker}`)
  })
  const ratio = Number(loser.median) / Number(winner.median)
  console.log(`    Winner is ${ratio.toFixed(2)}x faster than loser`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-queries-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 5})
  const users = env.register(UserRepo)

  console.log(`Populating ${POPULATE} entries (${PREFIX_COUNT} with "pref:" prefix, txSync)...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    users.env.transactionSync(() => {
      for (let i = start; i < end; i++) {
        users.env.putSync(i < PREFIX_COUNT ? `pref:${i}` : `other:${i}`, {id: `u${i}`, name: `name${i}`, age: i % 100})
      }
    })
  }
  console.log(`Ready.\n`)

  console.log(`=== Query helpers (${POPULATE} entries, ${PREFIX_COUNT} prefix) ===\n`)

  const likeResults: BenchResult[] = []
  const prefixResults: BenchResult[] = []
  const pointResults: BenchResult[] = []
  const allResults: BenchResult[] = []

  await bench(likeResults, `like("pref:*")`, () => users.like(`pref:*`))
  await bench(likeResults, `like("other:*")`, () => users.like(`other:*`))
  await bench(likeResults, `like("*500") (full scan)`, () => users.like(`*500`))
  await bench(likeResults, `like("pref:?")`, () => users.like(`pref:?`))
  await bench(likeResults, `like("*admin*") (infix)`, () => users.like(`*admin*`))

  await bench(prefixResults, `findByPrefix("pref:")`, () => users.findByPrefix(`pref:`))
  await bench(prefixResults, `findByPrefix("other:")`, () => users.findByPrefix(`other:`))

  await bench(prefixResults, `countByPrefix("pref:")`, () => users.countByPrefix(`pref:`))
  await bench(prefixResults, `countByPrefix("other:")`, () => users.countByPrefix(`other:`))

  await bench(pointResults, `count()`, () => users.count())
  await bench(pointResults, `first()`, () => users.first())
  await bench(pointResults, `last()`, () => users.last())

  await bench(pointResults, `keys({limit:10})`, () => users.keys({limit: 10}))
  await bench(pointResults, `keys({limit:100})`, () => users.keys({limit: 100}))
  await bench(pointResults, `values({limit:10})`, () => users.values({limit: 10}))
  await bench(pointResults, `entries({limit:10})`, () => users.entries({limit: 10}))

  await bench(pointResults, `iterate (limit 10)`, async () => {
    let c = 0
    for await (const _ of users.iterate({limit: 10})) {
      c += 1
    }
    return c
  })

  await bench(pointResults, `getMany (10 keys)`, () => users.getMany([`pref:0`, `pref:1`, `pref:2`, `pref:3`, `pref:4`, `pref:5`, `pref:6`, `pref:7`, `pref:8`, `pref:9`]))

  allResults.push(...likeResults, ...prefixResults, ...pointResults)

  // Bulk delete benchmark
  console.log(`\n=== Bulk delete ===\n`)
  const t0 = process.hrtime.bigint()
  const removed = await users.deleteByPrefix(`pref:`)
  const t1 = process.hrtime.bigint()
  const deleteTime = t1 - t0
  console.log(`  deleteByPrefix("pref:")  removed=${removed}  time=${fmtNs(deleteTime)}`)

  await env.close()
  console.log(`\n=== Summary ===\n`)
  rankAndPrint(likeResults, `Query / like`)
  rankAndPrint(prefixResults, `Query / prefix`)
  rankAndPrint(pointResults, `Query / point`)
  rankAndPrint(allResults, `Query / all`)
  console.log(`  deleteByPrefix("pref:")  removed=${removed}  time=${fmtNs(deleteTime)}  (single sample, not ranked)`)

  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
