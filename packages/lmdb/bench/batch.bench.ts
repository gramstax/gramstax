/**
 * Batch-write benchmark — putMany chunked writes, putIfNotExists,
 * atomic increment/decrement on a scalar counter sub.
 *
 * Runner: mitata (`bench`/`group`/`run`) — fresh keys use a shared counter
 * so every iteration measures a real insert; the overwrite bench reuses a
 * fixed window to keep DB size flat.
 *
 * Run: bun run packages/lmdb/bench/batch.bench.ts
 *
 * @internal
 */

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

  await runBench()

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
