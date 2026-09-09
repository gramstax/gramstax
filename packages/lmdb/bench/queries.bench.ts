/**
 * Query helpers benchmark — like, findByPrefix, countByPrefix, first, last, entries, keys, values, iterate.
 *
 * Runner: mitata (`bench`/`group`/`run`) — populate stays outside the
 * measured closures; the bulk-delete single sample stays plain timed code.
 *
 * Run: bun run packages/lmdb/bench/queries.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(50_000)
const PREFIX_COUNT = 500

class UserSchema extends LmdbSchema {
  static db = `bench-queries`
  static key = t.string()
  static value = {
    id: t.string(),
    name: t.string(),
    age: t.number()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-queries-`, 5)
  const users = env.register(UserSchema)

  console.log(`Populating ${POPULATE} entries (${PREFIX_COUNT} with "pref:" prefix, txSync)...`)
  populateSync(env, POPULATE, (i) => {
    users.putSync(i < PREFIX_COUNT ? `pref:${i}` : `other:${i}`, {id: `u${i}`, name: `name${i}`, age: i % 100})
  })
  console.log(`Ready.\n`)

  group(`Query / like (50k rows)`, () => {
    bench(`like("pref:*", 1 req)`, async () => do_not_optimize(await users.like(`pref:*`))).gc(`inner`)
    bench(`like("other:*", 1 req)`, async () => do_not_optimize(await users.like(`other:*`))).gc(`inner`)
    bench(`like("*500") (full scan, 1 req)`, async () => do_not_optimize(await users.like(`*500`))).gc(`inner`)
    bench(`like("pref:?", 1 req)`, async () => do_not_optimize(await users.like(`pref:?`))).gc(`inner`)
    bench(`like("*admin*") (infix, 1 req)`, async () => do_not_optimize(await users.like(`*admin*`))).gc(`inner`)
  })

  group(`Query / prefix (50k rows)`, () => {
    bench(`findByPrefix("pref:", 1 req)`, async () => do_not_optimize(await users.findByPrefix(`pref:`))).gc(`inner`)
    bench(`findByPrefix("other:", 1 req)`, async () => do_not_optimize(await users.findByPrefix(`other:`))).gc(`inner`)
    bench(`countByPrefix("pref:", 1 req)`, async () => do_not_optimize(await users.countByPrefix(`pref:`))).gc(`inner`)
    bench(`countByPrefix("other:", 1 req)`, async () => do_not_optimize(await users.countByPrefix(`other:`))).gc(`inner`)
  })

  group(`Query / point (50k rows)`, () => {
    bench(`count() (1 req)`, async () => do_not_optimize(await users.count()))
    bench(`first() (1 req)`, async () => do_not_optimize(await users.first()))
    bench(`last() (1 req)`, async () => do_not_optimize(await users.last()))
    bench(`keys({limit:10}, 1 req)`, async () => do_not_optimize(await users.keys({limit: 10}))).gc(`inner`)
    bench(`keys({limit:100}, 1 req)`, async () => do_not_optimize(await users.keys({limit: 100}))).gc(`inner`)
    bench(`values({limit:10}, 1 req)`, async () => do_not_optimize(await users.values({limit: 10}))).gc(`inner`)
    bench(`entries({limit:10}, 1 req)`, async () => do_not_optimize(await users.entries({limit: 10}))).gc(`inner`)
    bench(`iterate (limit 10, 1 req)`, async () => {
      let c = 0
      for await (const _ of users.iterate({limit: 10})) c += 1
      do_not_optimize(c)
    }).gc(`inner`)
    bench(`getMany (10 keys, 1 req)`, async () => do_not_optimize(await users.getMany([`pref:0`, `pref:1`, `pref:2`, `pref:3`, `pref:4`, `pref:5`, `pref:6`, `pref:7`, `pref:8`, `pref:9`]))).gc(`inner`)
  })

  let delSeq = 0
  group(`Query / bulk delete`, () => {
    bench(`deleteByPrefix (500 rows + 500 setup puts)`, async () => {
      const prefix = `benchdel:${delSeq++}:`
      env.rootTransactionSync(() => {
        for (let i = 0; i < 500; i++) users.putSync(`${prefix}${i}`, {id: `d${i}`, name: `del`, age: 0})
      })
      const removed = await users.deleteByPrefix(prefix)
      if (removed !== 500) throw new Error(`expected 500 rows removed, got ${removed}`)
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
