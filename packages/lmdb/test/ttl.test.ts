/**
 * F7 — TTL records via envelope + lazy expiry.
 *
 * Envelope stored as {v, exp?} — exp is absolute epoch ms.
 * get/has filter on read; purgeExpired reclaims.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbTtlRepository} from "../src/ttl"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface Session {
  userId: string
}

class SessionRepo extends LmdbTtlRepository<Session, string> {
  static dbName = `ttl-session-test`
}

let tmpDir: string
let env: LmdbEnv
let sessions: SessionRepo

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-ttl-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  sessions = env.register(SessionRepo)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbTtlRepository`, () => {
  it(`stores and retrieves without TTL`, async () => {
    await sessions.put(`s1`, {userId: `u1`})
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
    expect(sessions.has(`s1`)).toBe(true)
  })

  it(`returns value before expiry and undefined after`, async () => {
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: 50})
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
    await Bun.sleep(70)
    expect(sessions.get(`s1`)).toBeUndefined()
    expect(sessions.has(`s1`)).toBe(false)
  })

  it(`never expires when ttlMs is omitted`, async () => {
    await sessions.put(`s1`, {userId: `u1`})
    await Bun.sleep(20)
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
  })

  it(`purgeExpired removes only expired entries and returns count`, async () => {
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: 30})
    await sessions.put(`s2`, {userId: `u2`}, {ttlMs: 300000})
    await sessions.put(`s3`, {userId: `u3`})
    await Bun.sleep(50)
    const removed = await sessions.purgeExpired()
    expect(removed).toBe(1)
    expect(sessions.get(`s1`)).toBeUndefined()
    expect(sessions.get(`s2`)).toEqual({userId: `u2`})
    expect(sessions.get(`s3`)).toEqual({userId: `u3`})
  })

  it(`overwriting resets TTL`, async () => {
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: 40})
    await Bun.sleep(20)
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: 100})
    await Bun.sleep(30)
    // Would have expired at 40ms, but was reset to 100ms from second put
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
    await Bun.sleep(80)
    expect(sessions.get(`s1`)).toBeUndefined()
  })
})
