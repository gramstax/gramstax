/**
 * TTL Repository (LmdbTtlRepository) — use when records must expire automatically (sessions, OTPs, cache entries).
 * Why: stores `{v, exp}` envelope with absolute `exp = Date.now()+ttlMs`; `get`/`has` check wall-clock and lazily delete
 * expired entries (no timers, deterministic per process, safe across processes). Overwriting resets TTL; `purgeExpired`
 * reclaims via `entries` scan. Define a default once per class via `static ttlMs = 60_000` — per-call `{ttlMs}` overrides
 * the class default (priority: per-call → static → never expires). Opt-in subclass (`extends LmdbTtlRepository`), not default.
 *
 * Run with: `bun run packages/lmdb/example/ttl-repository.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbTtlRepository} from "../src/ttl"

type Session = {userId: string; token: string}

class SessionRepo extends LmdbTtlRepository<Session, string> {
  static dbName = `session-ttl`
}

// Class-level default TTL — all records expire in 80ms unless overridden per-call
class DefaultTtlSessionRepo extends LmdbTtlRepository<Session, string> {
  static dbName = `session-default-ttl`
  static ttlMs = 80
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-ttl-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const sessions = env.register(SessionRepo)

    console.log(`--- TTL: never-expire vs expiring ---\n`)
    await sessions.set(`perm`, {userId: `u1`, token: `keep`})
    console.log(`  perm before:`, sessions.get(`perm`))

    await sessions.set(`temp`, {userId: `u1`, token: `short`}, {ttlMs: 80})
    console.log(`  temp before expiry:`, sessions.get(`temp`))
    await Bun.sleep(100)
    console.log(`  temp after 100ms (expired):`, sessions.get(`temp`))
    console.log(`  has temp (false):`, sessions.has(`temp`))

    console.log(`\n--- Overwrite resets TTL ---\n`)
    await sessions.set(`renew`, {userId: `u1`, token: `t1`}, {ttlMs: 40})
    await Bun.sleep(20)
    await sessions.set(`renew`, {userId: `u1`, token: `t1`}, {ttlMs: 100})
    await Bun.sleep(30)
    console.log(`  renew after 30ms past first expiry (alive):`, !!sessions.get(`renew`))
    await Bun.sleep(80)
    console.log(`  renew after second expiry (gone):`, sessions.get(`renew`))

    console.log(`\n--- purgeExpired ---`)
    await sessions.set(`a`, {userId: `u1`, token: `a`}, {ttlMs: 30})
    await sessions.set(`b`, {userId: `u2`, token: `b`}, {ttlMs: 300000})
    await sessions.set(`c`, {userId: `u3`, token: `c`})
    await Bun.sleep(50)
    console.log(`  purgeExpired removed:`, await sessions.purgeExpired())
    console.log(`  a gone:`, sessions.get(`a`), `b alive:`, !!sessions.get(`b`), `c alive:`, !!sessions.get(`c`))

    console.log(`\n--- Class-level default TTL (static ttlMs) + per-call priority ---\n`)
    const defaultSessions = env.register(DefaultTtlSessionRepo)
    await defaultSessions.set(`d1`, {userId: `u1`, token: `default`}) // uses class ttlMs=80
    console.log(`  d1 with class default 80ms (alive):`, !!defaultSessions.get(`d1`))
    await Bun.sleep(100)
    console.log(`  d1 after 100ms (expired via class default):`, defaultSessions.get(`d1`))
    await defaultSessions.set(`d2`, {userId: `u2`, token: `override`}, {ttlMs: 300000}) // per-call overrides class
    await Bun.sleep(100)
    console.log(`  d2 with per-call 300s override (still alive):`, !!defaultSessions.get(`d2`), `(per-call > class)`)
    await defaultSessions.set(`d3`, {userId: `u3`, token: `also-default`}) // again class default
    console.log(`  d3 uses class default again (alive):`, !!defaultSessions.get(`d3`))

    await env.close()
    console.log(`\nenv closed cleanly`)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
