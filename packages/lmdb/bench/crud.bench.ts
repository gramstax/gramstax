/**
 * CRUD benchmark — basic put, get, has, delete, count throughput.
 *
 * Runner: mitata (`bench`/`group`/`run`) — setup/populate stays outside
 * the measured closures so only the op itself is timed.
 *
 * Run: bun run packages/lmdb/bench/crud.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(20_000)

class ItemSchema extends LmdbSchema {
  static db = `bench-crud`
  static key = t.string()
  static value = {
    id: t.string(),
    name: t.string(),
    score: t.number(),
    tags: t.array<string>()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-crud-`, 5)
  const items = env.register(ItemSchema)

  console.log(`Populating ${POPULATE} entries (txSync)...`)
  populateSync(env, POPULATE, (i) => {
    items.putSync(`k${i}`, {id: `k${i}`, name: `name${i}`, score: i % 100, tags: [`tag${i % 10}`]})
  })
  console.log(`Ready.\n`)

  const existingKeys = [`k0`, `k${Math.floor(POPULATE / 2)}`, `k${POPULATE - 1}`]
  const missingKey = `__nonexistent__`
  const writeKey = `__bench_write__`

  group(`CRUD / reads`, () => {
    bench(`get (existing, 3 reqs)`, async () => {
      for (const k of existingKeys) do_not_optimize(await items.get(k))
    })
    bench(`get (missing, 3 reqs)`, async () => {
      for (let i = 0; i < 3; i++) do_not_optimize(await items.get(missingKey))
    })
    bench(`has (existing, 3 reqs)`, async () => {
      for (const k of existingKeys) do_not_optimize(await items.has(k))
    })
    bench(`has (missing, 3 reqs)`, async () => {
      for (let i = 0; i < 3; i++) do_not_optimize(await items.has(missingKey))
    })
    bench(`count (3 reqs)`, async () => {
      for (let i = 0; i < 3; i++) do_not_optimize(await items.count())
    })
    bench(`getMany (10 keys, 1 req)`, async () => {
      do_not_optimize(await items.getMany([`k0`, `k1`, `k2`, `k3`, `k4`, `k5`, `k6`, `k7`, `k8`, `k9`]))
    }).gc(`inner`)
  })

  group(`CRUD / writes`, () => {
    bench(`put (new key, 3 puts/1 txn)`, async () => {
      env.rootTransactionSync(() => {
        items.putSync(`${writeKey}:0`, {id: `w`, name: `write`, score: 0, tags: [`w`]})
        items.putSync(`${writeKey}:1`, {id: `w`, name: `write`, score: 0, tags: [`w`]})
        items.putSync(`${writeKey}:2`, {id: `w`, name: `write`, score: 0, tags: [`w`]})
      })
    })
    bench(`put (overwrite, 3 puts/1 txn)`, async () => {
      env.rootTransactionSync(() => {
        for (const k of existingKeys) items.putSync(k, {id: k, name: `updated`, score: 99, tags: [`u`]})
      })
    })
    bench(`delete (existing, 6 ops/2 txns)`, async () => {
      env.rootTransactionSync(() => {
        items.putSync(`__del:0`, {id: `d`, name: `del`, score: 0, tags: [`d`]})
        items.putSync(`__del:1`, {id: `d`, name: `del`, score: 0, tags: [`d`]})
        items.putSync(`__del:2`, {id: `d`, name: `del`, score: 0, tags: [`d`]})
      })
      env.rootTransactionSync(() => {
        items.removeSync(`__del:0`)
        items.removeSync(`__del:1`)
        items.removeSync(`__del:2`)
      })
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
