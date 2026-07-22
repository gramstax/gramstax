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
import {LmdbEnv, LmdbRepository} from "../src"

const POPULATE = 100_000
const ITERS = 500
const WARMUP = 50

interface Item { id: string; val: number }

class ItemRepo extends LmdbRepository<Item, string> {
  static dbName = `bench-range`
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

async function bench(
  label: string,
  fn: () => Promise<unknown> | unknown,
  iterations = ITERS,
  warmup = WARMUP
): Promise<void> {
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
  console.log(
    `  ${label.padEnd(40)} median=${fmtNs(median).padStart(10)} min=${fmtNs(min).padStart(10)} max=${fmtNs(max).padStart(10)} mean=${fmtNs(mean).padStart(10)}`
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-range-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 5})
  const repo = env.register(ItemRepo)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  const CHUNK = 500
  for (let start = 0; start < POPULATE; start += CHUNK) {
    const end = Math.min(start + CHUNK, POPULATE)
    repo.env.transactionSync(() => {
      for (let i = start; i < end; i++) {
        repo.env.putSync(`k${String(i).padStart(6, `0`)}`, {id: `k${i}`, val: i})
      }
    })
  }
  console.log(`Ready.\n`)

  console.log(`=== Range benchmark (${POPULATE} entries) ===\n`)

  // --- keys ---
  await bench(`keys() (all)`, () => repo.keys())
  await bench(`keys({limit:10})`, () => repo.keys({limit: 10}))
  await bench(`keys({limit:100})`, () => repo.keys({limit: 100}))
  await bench(`keys({limit:1000})`, () => repo.keys({limit: 1000}))
  await bench(`keys({reverse:true, limit:10})`, () => repo.keys({reverse: true, limit: 10}))
  await bench(`keys({start:"k000500", limit:10})`, () => repo.keys({start: `k000500`, limit: 10}))
  await bench(`keys({start:"k000500", end:"k001000"})`, () => repo.keys({start: `k000500`, end: `k001000`}))

  // --- values ---
  await bench(`values({limit:10})`, () => repo.values({limit: 10}))
  await bench(`values({limit:100})`, () => repo.values({limit: 100}))
  await bench(`values({reverse:true, limit:10})`, () => repo.values({reverse: true, limit: 10}))

  // --- entries ---
  await bench(`entries() (all)`, () => repo.entries())
  await bench(`entries({limit:10})`, () => repo.entries({limit: 10}))
  await bench(`entries({limit:100})`, () => repo.entries({limit: 100}))
  await bench(`entries({limit:1000})`, () => repo.entries({limit: 1000}))
  await bench(`entries({reverse:true, limit:10})`, () => repo.entries({reverse: true, limit: 10}))
  await bench(`entries({start:"k000500", limit:10})`, () => repo.entries({start: `k000500`, limit: 10}))
  await bench(`entries({start:"k000500", end:"k001000"})`, () => repo.entries({start: `k000500`, end: `k001000`}))

  // --- iterate (async generator) ---
  await bench(`iterate({limit:10})`, async () => {
    let c = 0
    for await (const _ of repo.iterate({limit: 10})) { c++ }
  })
  await bench(`iterate({limit:100})`, async () => {
    let c = 0
    for await (const _ of repo.iterate({limit: 100})) { c++ }
  })

  // --- offset ---
  await bench(`entries({limit:10, offset:100})`, () => repo.entries({limit: 10, offset: 100}))
  await bench(`entries({limit:10, offset:1000})`, () => repo.entries({limit: 10, offset: 1000}))

  // --- first / last (edge queries) ---
  await bench(`first()`, () => repo.first())
  await bench(`last()`, () => repo.last())

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
