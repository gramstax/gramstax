/**
 * Concurrent access benchmark — N workers hitting the repository in parallel.
 *
 * Runner: mitata (`bench`/`group`/`run`) — one bench per (mode × method ×
 * concurrency); the worker fan-out lives inside the measured closure.
 * The sub handle is registered ONCE and captured directly (no per-op
 * `env.sub()` lookup inside hot closures). Read results go through
 * `do_not_optimize` so JIT cannot eliminate them; allocation-heavy
 * benches use `.gc('inner')` for consistent GC behavior.
 *
 * Run: bun run packages/lmdb/bench/concurrent.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import type {LmdbEnvSub} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(5_000)
const CONCURRENCY: ReadonlyArray<number> = process.env.BENCH_CONC?.split(`,`)
  .map(Number)
  .filter((n) => n > 0) ?? [10, 50, 100]
const OPS_PER_WORKER = 30

class UserSchema extends LmdbSchema {
  static db = `bench-concurrent`
  static key = t.string()
  static value = {
    id: t.string(),
    name: t.string(),
    age: t.number()
  }
}

type Users = LmdbEnvSub<typeof UserSchema>

const randKey = (): string => `u${Math.floor(Math.random() * POPULATE)}`

type BenchFn = (users: Users, wid: number) => Promise<unknown>

const METHODS: Record<string, BenchFn> = {
  get: async (u) => {
    do_not_optimize(await u.get(randKey()))
  },
  has: async (u) => {
    do_not_optimize(await u.has(randKey()))
  },
  put: async (u, w) => {
    await u.put(`w${w}:${Math.random().toString(36).slice(2)}`, {id: `w`, name: `w${w}`, age: w})
  },
  delete: async (u) => {
    const k = `tmp:${Math.random().toString(36).slice(2)}`
    await u.put(k, {id: `t`, name: `t`, age: 0})
    do_not_optimize(await u.delete(k))
  },
  count: async (u) => {
    do_not_optimize(await u.count())
  },
  getMany: async (u) => {
    do_not_optimize(await u.getMany(Array.from({length: 10}, () => randKey())))
  },
  findByPrefix: async (u) => {
    do_not_optimize(await u.findByPrefix(`u${Math.floor(Math.random() * 10)}`))
  },
  countByPrefix: async (u) => {
    do_not_optimize(await u.countByPrefix(`u${Math.floor(Math.random() * 10)}`))
  },
  like: async (u) => {
    do_not_optimize(await u.like(`u*`))
  },
  first: async (u) => {
    do_not_optimize(await u.first())
  },
  last: async (u) => {
    do_not_optimize(await u.last())
  },
  update: async (u) => {
    const k = `u${Math.floor(Math.random() * 1000)}`
    const cur = u.get(k)
    do_not_optimize(cur)
    await u.put(k, cur ?? {id: k, name: `init`, age: 0})
  },
  iterate: async (u) => {
    let c = 0
    for await (const _ of u.iterate({limit: 50})) {
      c++
      if (c >= 50) break
    }
    do_not_optimize(c)
  }
}

const METHODS_READ: ReadonlyArray<keyof typeof METHODS> = [`get`, `has`, `count`, `getMany`, `findByPrefix`, `countByPrefix`, `like`, `first`, `last`, `iterate`]
const METHODS_MIXED: ReadonlyArray<keyof typeof METHODS> = [`get`, `put`, `delete`, `update`, `findByPrefix`, `countByPrefix`, `like`, `getMany`]

const HEAVY_READ = new Set([`getMany`, `findByPrefix`, `like`, `iterate`])

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-conc-`, 5)

  const users = env.register(UserSchema)
  console.log(`Populating ${POPULATE} entries (txSync)...`)
  populateSync(env, POPULATE, (i) => {
    users.putSync(`u${i}`, {id: `u${i}`, name: `name${i}`, age: i % 100})
  })
  console.log(`Ready.\n`)

  for (const mode of [`pure-read`, `mixed`] as const) {
    const methods = mode === `pure-read` ? METHODS_READ : METHODS_MIXED
    for (const conc of CONCURRENCY) {
      group(`${mode} / conc=${conc} (${OPS_PER_WORKER} ops/worker)`, () => {
        for (const method of methods) {
          const fn = METHODS[method]!
          const b = bench(`${method} (${conc * OPS_PER_WORKER} ops)`, async () => {
            await Promise.all(
              Array.from({length: conc}, (_, wid) =>
                (async () => {
                  for (let i = 0; i < OPS_PER_WORKER; i++) {
                    await fn(users, wid)
                  }
                })()
              )
            )
          })
          if (HEAVY_READ.has(method)) b.gc(`inner`)
        }
      })
    }
  }

  group(`mixed interleaved`, () => {
    for (const conc of CONCURRENCY) {
      bench(`interleaved (conc=${conc}, ${conc * OPS_PER_WORKER} ops)`, async () => {
        await Promise.all(
          Array.from({length: conc}, async (_, wid) => {
            for (let i = 0; i < OPS_PER_WORKER; i++) {
              const method = METHODS_MIXED[i % METHODS_MIXED.length]!
              await METHODS[method]!(users, wid)
            }
          })
        )
      }).gc(`inner`)
    }
  })

  group(`burst / 10_000 simultaneous users (Promise.all)`, () => {
    bench(`get (10_000 parallel reqs)`, async () => {
      do_not_optimize(await Promise.all(Array.from({length: 10_000}, () => users.get(randKey()))))
    }).gc(`inner`)
    bench(`mixed (10_000 parallel reqs)`, async () => {
      await Promise.all(Array.from({length: 10_000}, (_, i) => METHODS[METHODS_MIXED[i % METHODS_MIXED.length]!]!(users, i)))
    }).gc(`inner`)
  })

  await runBench()

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
