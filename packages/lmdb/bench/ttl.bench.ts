/**
 * TTL benchmark — put with per-call expiry, reads on TTL rows, purgeExpired scan.
 *
 * The schema materializes a TTL sub (`static ttl = 0`: no default expiry,
 * per-put `{ttlMs}` only). The plain `put`/`purgeExpired` handle members
 * already accept TTL args — no cast needed.
 *
 * Runner: mitata (`bench`/`group`/`run`).
 *
 * Run: bun run packages/lmdb/bench/ttl.bench.ts
 *
 * @internal
 */

import {bench, do_not_optimize, group} from "mitata"
import {LmdbSchema, t} from "../src"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"

const POPULATE = benchSize(1_000)

class SessionSchema extends LmdbSchema {
  static db = `bench-ttl`
  static key = t.string()
  static value = {
    userId: t.string(),
    token: t.string()
  }
  static ttl = 0
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const {env} = setupEnv(`lmdb-bench-ttl-`, 5)
  const sessions = env.register(SessionSchema)

  console.log(`Populating ${POPULATE} entries...`)
  populateSync(env, POPULATE, (i) => {
    sessions.putSync(`s${i}`, {userId: `u${i}`, token: `tok${i}`})
  })
  await sessions.put(`probe`, {userId: `u0`, token: `probe`}, {ttlMs: 3_600_000})
  console.log(`Ready.\n`)

  let ttlSeq = 0
  group(`TTL`, () => {
    bench(`put (ttlMs 60s, 1 req)`, async () => {
      const n = ttlSeq++
      await sessions.put(`t${n}`, {userId: `u${n}`, token: `tok${n}`}, {ttlMs: 60_000})
    })
    bench(`put (no ttl, 1 req)`, async () => {
      const n = ttlSeq++
      await sessions.put(`p${n}`, {userId: `u${n}`, token: `tok${n}`})
    })
    bench(`get (ttl row, 1 req)`, async () => {
      do_not_optimize(await sessions.get(`probe`))
    })
    bench(`purgeExpired (empty scan, 1 req)`, async () => {
      do_not_optimize(await sessions.purgeExpired())
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
