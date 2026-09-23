/**
 * Batch-write benchmark — putMany chunked writes, putIfNotExists,
 * atomic increment/decrement on a scalar counter sub.
 *
 * Runner: mitata (`bench`/`group`/`run`) — fresh keys use a shared counter
 * so every iteration measures a real insert; the overwrite bench reuses a
 * fixed window to keep DB size flat.
 *
 * The sorted-append proof (plan 017 Phase 5) runs as standalone wall-clock
 * comparisons (100k single-shot imports would explode mitata's adaptive
 * iteration budget): ordered `{sorted: true}` vs deterministically shuffled
 * plain putMany, fresh env per side.
 *
 * Run: bun run packages/lmdb/bench/batch.bench.ts
 *
 * @internal
 */

import {rmSync} from "node:fs"
import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(1_000)

class ItemSchema extends LmdbSchema {
  static db = `bench-batch`
  static key = t.string()
  static value = {
    id: t.string(),
    value: t.number()
  }
}

class CounterSchema extends LmdbSchema {
  static db = `bench-batch-counter`
  static key = t.string()
  static value = t.number()
}

class SortedItemSchema extends LmdbSchema {
  static db = `bench-batch-sorted`
  static key = t.string()
  static value = {
    id: t.string(),
    value: t.number()
  }
}

function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function sortedAppendProof(): Promise<void> {
  const N = benchSize(100_000)
  const keys: Array<string> = []
  for (let i = 0; i < N; i++) keys.push(`bulk:${String(i).padStart(7, `0`)}`)
  const shuffled = [...keys]
  const rand = mulberry32(42)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = tmp
  }
  const timeImport = async (ordered: boolean): Promise<number> => {
    const {env, tmp} = setupEnv(`lmdb-bench-sorted-`, 5)
    try {
      const subs = env.register(SortedItemSchema)
      const source = ordered ? keys : shuffled
      const entries = source.map((k, i) => [k, {id: k, value: i}] as [string, {id: string; value: number}])
      const t0 = performance.now()
      await subs.putMany(entries, 500, ordered ? {sorted: true} : undefined)
      return performance.now() - t0
    } finally {
      await env.close()
      rmSync(tmp, {recursive: true, force: true})
    }
  }
  const sortedMs = await timeImport(true)
  const plainMs = await timeImport(false)
  console.log(`--- Sorted append (${N} rows) ---`)
  console.log(`  sorted putMany:   ${sortedMs.toFixed(0)}ms`)
  console.log(`  shuffled putMany: ${plainMs.toFixed(0)}ms`)
  console.log(`  speedup: ${(plainMs / sortedMs).toFixed(2)}x`)
  console.log(``)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-batch-`, 5)
  const items = env.register(ItemSchema)
  const counters = env.register(CounterSchema)

  console.log(`Populating ${POPULATE} entries...`)
  populateSync(env, POPULATE, (i) => {
    items.putSync(`k${i}`, {id: `k${i}`, value: i})
  })
  console.log(`Ready.\n`)

  let pmSeq = 0
  group(`Batch / putMany`, () => {
    bench(`putMany (10 entries, 1 req)`, async () => {
      const base = pmSeq
      pmSeq += 10
      await items.putMany(Array.from({length: 10}, (_, j) => [`pm:${base + j}`, {id: `pm${base + j}`, value: j}] as [string, {id: string; value: number}]))
    }).gc(`inner`)
    bench(`putMany (100 entries, 1 req)`, async () => {
      const base = pmSeq
      pmSeq += 100
      await items.putMany(Array.from({length: 100}, (_, j) => [`pm:${base + j}`, {id: `pm${base + j}`, value: j}] as [string, {id: string; value: number}]))
    }).gc(`inner`)
    bench(`putMany (100 entries, overwrite, 1 req)`, async () => {
      await items.putMany(Array.from({length: 100}, (_, j) => [`ov:${j}`, {id: `ov${j}`, value: j}] as [string, {id: string; value: number}]))
    }).gc(`inner`)
  })

  group(`Batch / single-write variants`, () => {
    bench(`putIfNotExists (new key, 1 req)`, async () => {
      const n = pmSeq++
      do_not_optimize(await items.putIfNotExists(`pine:${n}`, {id: `pine${n}`, value: n}))
    })
    bench(`putIfNotExists (existing key, 1 req)`, async () => {
      do_not_optimize(await items.putIfNotExists(`k0`, {id: `k0`, value: 0}))
    })
    bench(`increment (1 req)`, async () => {
      do_not_optimize(await counters.increment(`ctr`))
    })
    bench(`decrement (1 req)`, async () => {
      do_not_optimize(await counters.decrement(`ctr`))
    })
  })

  await sortedAppendProof()

  await runBench()

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
