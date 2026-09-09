/**
 * Embedded-index benchmark — write-maintenance cost vs plain put,
 * findByIndex reads (unique / non-unique / multi-key AND), reindex.
 *
 * Runner: mitata (`bench`/`group`/`run`) — populate stays outside the
 * measured closures; labels state the exact request count per iteration.
 *
 * Run: bun run packages/lmdb/bench/index.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(10_000)

class UserSchema extends LmdbSchema {
  static db = `bench-index`
  static key = t.string()
  static value = {
    id: t.string().unique(),
    email: t.string().index(),
    name: t.string(),
    age: t.number()
  }
}

class PlainSchema extends LmdbSchema {
  static db = `bench-index-plain`
  static key = t.string()
  static value = {
    id: t.string(),
    email: t.string(),
    name: t.string(),
    age: t.number()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-index-`, 10)
  const users = env.register(UserSchema)
  const plain = env.register(PlainSchema)

  console.log(`Populating ${POPULATE} indexed + ${POPULATE} plain entries...`)
  populateSync(env, POPULATE, (i) => {
    const row = {id: `id${i}`, email: `user${i % 10}@bench.dev`, name: `name${i}`, age: i % 100}
    users.putSync(`u${i}`, row)
    plain.putSync(`u${i}`, row)
  })
  console.log(`Ready.\n`)

  let putSeq = 0
  let flip = false
  group(`Index / writes`, () => {
    bench(`put indexed (2 indexes, 1 req)`, async () => {
      const n = putSeq++
      await users.put(`w${n}`, {id: `wid${n}`, email: `w${n % 10}@bench.dev`, name: `w`, age: 0})
    })
    bench(`put plain (no index, 1 req)`, async () => {
      const n = putSeq++
      await plain.put(`w${n}`, {id: `wid${n}`, email: `w${n % 10}@bench.dev`, name: `w`, age: 0})
    })
    bench(`put overwrite indexed field (1 req)`, async () => {
      flip = !flip
      await users.put(`u0`, {id: `id0`, email: flip ? `a@bench.dev` : `b@bench.dev`, name: `name0`, age: 0})
    })
  })

  group(`Index / reads`, () => {
    bench(`get primary (1 req)`, async () => {
      do_not_optimize(await users.get(`u${Math.floor(Math.random() * POPULATE)}`))
    })
    bench(`findByIndex unique (1 req)`, async () => {
      do_not_optimize(await users.findByIndex({id: `id${Math.floor(Math.random() * POPULATE)}`}))
    })
    bench(`findByIndex non-unique (1 req)`, async () => {
      do_not_optimize(await users.findByIndex({email: `user${Math.floor(Math.random() * 10)}@bench.dev`}))
    }).gc(`inner`)
    bench(`findByIndex multi-key AND (1 req)`, async () => {
      const i = Math.floor(Math.random() * POPULATE)
      do_not_optimize(await users.findByIndex({id: `id${i}`, email: `user${i % 10}@bench.dev`}))
    })
  })

  group(`Index / reindex`, () => {
    bench(`reindex all (1 req)`, async () => {
      await users.reindex()
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
