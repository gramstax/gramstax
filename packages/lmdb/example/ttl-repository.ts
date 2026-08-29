/**
 * TTL Repository — use when records must expire automatically (sessions, OTPs, cache entries).
 * Why: `static ttl` on an LmdbSchema materializes a TTL repository (stores `{v, exp}` envelopes with
 * absolute `exp = Date.now()+ttlMs`); `get`/`has` check wall-clock and lazily delete expired entries
 * (no timers, deterministic per process, safe across processes). Overwriting resets TTL; `purgeExpired`
 * reclaims via `entries` scan. Priority: per-call `{ttlMs}` → `static ttl` → never expires.
 *
 * Note: `register(SchemaClass)` types the repo as `LmdbRepository`, so TTL-specific members
 * (`put(..., {ttlMs})`, `purgeExpired`) are exposed through a narrow cast to `LmdbTtlRepository`.
 *
 * Run with: `bun run packages/lmdb/example/ttl-repository.ts`
 */
import {mkdtempSync, rmSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"

class SessionTTLSchema extends LmdbSchema {
  static db = `session-ttl`
  static key = t.string()
  static value = {
    userId: t.string(),
    token: t.string()
  }
  // Declaring `ttl` materializes a TTL repository; 0 = no default, per-call `{ttlMs}` only.
  static ttl = 0
}

// Class-level default TTL — all records expire in 80ms unless overridden per-call.
class SessionDefaultTTLSchema extends LmdbSchema {
  static db = `session-default-ttl`
  static key = t.string()
  static value = {
    userId: t.string(),
    token: t.string()
  }
  static ttl = 80
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), `lmdb-ttl-`))
  try {
    const env = new LmdbEnv({path: dir, maxDbs: 5})
    const sessionTTL = env.register(SessionTTLSchema)
    const sessionDefaultTTL = env.register(SessionDefaultTTLSchema)

    console.log(`--- TTL: never-expire vs expiring ---\n`)
    await sessionTTL.put(`perm`, {userId: `u1`, token: `keep`})
    console.log(`  perm before:`, sessionDefaultTTL.get(`perm`))

    await sessionTTL.put(`temp`, {userId: `u1`, token: `short`}, {ttlMs: 80})
    console.log(`  temp before expiry:`, sessionDefaultTTL.get(`temp`))
    await Bun.sleep(100)
    console.log(`  temp after 100ms (expired):`, sessionTTL.get(`temp`))
    console.log(`  has temp (false):`, sessionDefaultTTL.has(`temp`))

    console.log(`\n--- Overwrite resets TTL ---\n`)
    await sessionTTL.put(`renew`, {userId: `u1`, token: `t1`}, {ttlMs: 40})
    await Bun.sleep(20)
    await sessionTTL.put(`renew`, {userId: `u1`, token: `t1`}, {ttlMs: 100})
    await Bun.sleep(30)
    console.log(`  renew after 30ms past first expiry (alive):`, !!sessionTTL.get(`renew`))
    await Bun.sleep(80)
    console.log(`  renew after second expiry (gone):`, sessionTTL.get(`renew`))

    console.log(`\n--- purgeExpired ---`)
    await sessionTTL.put(`a`, {userId: `u1`, token: `a`}, {ttlMs: 30})
    await sessionTTL.put(`b`, {userId: `u2`, token: `b`}, {ttlMs: 300000})
    await sessionTTL.put(`c`, {userId: `u3`, token: `c`})
    await Bun.sleep(50)
    console.log(`  purgeExpired removed:`, await sessionTTL.purgeExpired())
    console.log(`  a gone:`, sessionTTL.get(`a`), `b alive:`, !!sessionTTL.get(`b`), `c alive:`, !!sessionTTL.get(`c`))

    console.log(`\n--- Schema-level default TTL (static ttl) + per-call priority ---\n`)
    await sessionDefaultTTL.put(`d1`, {userId: `u1`, token: `default`}) // uses schema ttl=80
    console.log(`  d1 with schema default 80ms (alive):`, !!sessionDefaultTTL.get(`d1`))
    await Bun.sleep(100)
    console.log(`  d1 after 100ms (expired via schema default):`, sessionDefaultTTL.get(`d1`))
    await sessionDefaultTTL.put(`d2`, {userId: `u2`, token: `override`}, {ttlMs: 300000}) // per-call overrides schema
    await Bun.sleep(100)
    console.log(`  d2 with per-call 300s override (still alive):`, !!sessionDefaultTTL.get(`d2`), `(per-call > static ttl)`)
    await sessionDefaultTTL.put(`d3`, {userId: `u3`, token: `also-default`}) // again schema default
    console.log(`  d3 uses schema default again (alive):`, !!sessionDefaultTTL.get(`d3`))

    await env.close()
    console.log(`\nenv closed cleanly`)
  } finally {
    try {
      rmSync(dir, {recursive: true, force: true})
    } catch {
      // Windows LMDB lock race — ignore
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
