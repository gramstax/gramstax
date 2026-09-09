/**
 * Range query benchmark — keys/values/entries/iterate with different bounds, limits, reverse.
 *
 * Runner: mitata (`bench`/`group`/`run`) — populate stays outside the
 * measured closures so only the query itself is timed.
 *
 * Run: bun run packages/lmdb/bench/range.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(100_000)

class ItemSchema extends LmdbSchema {
  static db = `bench-range`
  static key = t.string()
  static value = {
    id: t.string(),
    val: t.number()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-range-`, 5)
  const items = env.register(ItemSchema)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  populateSync(env, POPULATE, (i) => {
    items.putSync(`k${String(i).padStart(6, `0`)}`, {id: `k${i}`, val: i})
  })
  console.log(`Ready.\n`)

  group(`Range / keys (100k rows)`, () => {
    bench(`keys() (all, 100k rows, 1 req)`, async () => do_not_optimize(await items.keys())).gc(`inner`)
    bench(`keys({limit:10}, 1 req)`, async () => do_not_optimize(await items.keys({limit: 10}))).gc(`inner`)
    bench(`keys({limit:100}, 1 req)`, async () => do_not_optimize(await items.keys({limit: 100}))).gc(`inner`)
    bench(`keys({limit:1000}, 1 req)`, async () => do_not_optimize(await items.keys({limit: 1000}))).gc(`inner`)
    bench(`keys({reverse:true, limit:10}, 1 req)`, async () => do_not_optimize(await items.keys({reverse: true, limit: 10}))).gc(`inner`)
    bench(`keys({start:"k000500", limit:10}, 1 req)`, async () => do_not_optimize(await items.keys({start: `k000500`, limit: 10}))).gc(`inner`)
    bench(`keys({start:"k000500", end:"k001000"}, 1 req)`, async () => do_not_optimize(await items.keys({start: `k000500`, end: `k001000`}))).gc(`inner`)
  })

  group(`Range / values (100k rows)`, () => {
    bench(`values({limit:10}, 1 req)`, async () => do_not_optimize(await items.values({limit: 10}))).gc(`inner`)
    bench(`values({limit:100}, 1 req)`, async () => do_not_optimize(await items.values({limit: 100}))).gc(`inner`)
    bench(`values({reverse:true, limit:10}, 1 req)`, async () => do_not_optimize(await items.values({reverse: true, limit: 10}))).gc(`inner`)
  })

  group(`Range / entries (100k rows)`, () => {
    bench(`entries() (all, 100k rows, 1 req)`, async () => do_not_optimize(await items.entries())).gc(`inner`)
    bench(`entries({limit:10}, 1 req)`, async () => do_not_optimize(await items.entries({limit: 10}))).gc(`inner`)
    bench(`entries({limit:100}, 1 req)`, async () => do_not_optimize(await items.entries({limit: 100}))).gc(`inner`)
    bench(`entries({limit:1000}, 1 req)`, async () => do_not_optimize(await items.entries({limit: 1000}))).gc(`inner`)
    bench(`entries({reverse:true, limit:10}, 1 req)`, async () => do_not_optimize(await items.entries({reverse: true, limit: 10}))).gc(`inner`)
    bench(`entries({start:"k000500", limit:10}, 1 req)`, async () => do_not_optimize(await items.entries({start: `k000500`, limit: 10}))).gc(`inner`)
    bench(`entries({start:"k000500", end:"k001000"}, 1 req)`, async () => do_not_optimize(await items.entries({start: `k000500`, end: `k001000`}))).gc(`inner`)
  })

  group(`Range / iterate & edges (100k rows)`, () => {
    bench(`iterate({limit:10}, 1 req)`, async () => {
      let c = 0
      for await (const _ of items.iterate({limit: 10})) c++
      do_not_optimize(c)
    }).gc(`inner`)
    bench(`iterate({limit:100}, 1 req)`, async () => {
      let c = 0
      for await (const _ of items.iterate({limit: 100})) c++
      do_not_optimize(c)
    }).gc(`inner`)
    bench(`first() (1 req)`, async () => do_not_optimize(await items.first()))
    bench(`last() (1 req)`, async () => do_not_optimize(await items.last()))
  })

  group(`Range / pagination (offset vs keyset, same pages)`, () => {
    bench(`entries({limit:10, offset:100}, 1 req)`, async () => do_not_optimize(await items.entries({limit: 10, offset: 100}))).gc(`inner`)
    bench(`entries({start:"k000100", limit:10}, 1 req)`, async () => do_not_optimize(await items.entries({start: `k000100`, limit: 10}))).gc(`inner`)
    bench(`entries({limit:10, offset:1000}, 1 req)`, async () => do_not_optimize(await items.entries({limit: 10, offset: 1000}))).gc(`inner`)
    bench(`entries({start:"k001000", limit:10}, 1 req)`, async () => do_not_optimize(await items.entries({start: `k001000`, limit: 10}))).gc(`inner`)
  })

  await runBench()

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
