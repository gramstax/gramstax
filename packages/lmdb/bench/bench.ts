/**
 * Performance benchmark for the @gramstax/lmdb query helpers.
 *
 * Run with: `bun run packages/lmdb/bench/bench.ts`
 *
 * @internal
 */

import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv, LmdbRepository} from "../src"

interface User {
  id: string
  name: string
  age: number
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `user-bench`
}

async function populate(env: LmdbEnv, users: UserRepo, total: number, prefixCount: number): Promise<void> {
  for (let i = 0; i < total; i++) {
    const key = i < prefixCount ? `pref:${i}` : `other:${i}`
    await users.set(key, {id: key, name: `name${i}`, age: i % 100})
  }
}

function fmtNs(ns: bigint): string {
  const n = Number(ns)
  if (n < 1_000) return `${n}ns`
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}us`
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}ms`
  return `${(n / 1_000_000_000).toFixed(2)}s`
}

async function bench(name: string, fn: () => Promise<unknown> | unknown, iters = 5): Promise<bigint> {
  const samples: bigint[] = []
  for (let i = 0; i < iters; i++) {
    const t0 = process.hrtime.bigint()
    await fn()
    samples.push(process.hrtime.bigint() - t0)
  }
  samples.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const median = samples[Math.floor(samples.length / 2)] ?? 0n
  console.log(
    `  ${name.padEnd(40)} median=${fmtNs(median).padStart(10)} min=${fmtNs(samples[0] ?? 0n).padStart(10)} max=${fmtNs(samples[samples.length - 1] ?? 0n).padStart(10)}`
  )
  return median
}

async function main(): Promise<void> {
  const tmp = mkdtempSync(join(tmpdir(), `lmdb-bench-`))
  const env = new LmdbEnv({path: tmp, maxDbs: 5})
  await env.open()
  const users = env.register(UserRepo)

  const TOTAL = 50_000
  const PREFIX = 500
  console.log(`Populating ${TOTAL} entries (${PREFIX} matching "pref:" prefix)...`)
  await populate(env, users, TOTAL, PREFIX)

  console.log(`\n=== Query helpers (${TOTAL} total, ${PREFIX} matching prefix) ===\n`)

  await bench(`like("pref:*")     prefix pattern`, () => users.like(`pref:*`))
  await bench(`like("other:*")    prefix pattern`, () => users.like(`other:*`))
  await bench(`like("*500")       suffix pattern (full scan)`, () => users.like(`*500`))
  await bench(`like("pref:?")     single-char wildcard`, () => users.like(`pref:?`))
  await bench(`findByPrefix("pref:")`, () => users.findByPrefix(`pref:`))
  await bench(`countByPrefix("pref:")   native count`, () => users.countByPrefix(`pref:`))
  await bench(`count()                  native count`, () => users.count())
  await bench(`first()`, () => users.first())
  await bench(`last()`, () => users.last())
  await bench(`entries({limit:10})      small window`, () => users.entries({limit: 10}))

  console.log(`\n=== Bulk delete (${PREFIX} entries) ===\n`)
  const t0 = process.hrtime.bigint()
  const removed = await users.deleteByPrefix(`pref:`)
  const t1 = process.hrtime.bigint()
  console.log(`  deleteByPrefix("pref:") removed=${removed} time=${fmtNs(t1 - t0)}`)

  await env.close()
  console.log(`\nDone.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
