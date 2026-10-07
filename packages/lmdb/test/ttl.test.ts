/**
 * F7 — TTL records via envelope + lazy expiry.
 *
 * Envelope stored as {v, exp?} — exp is absolute epoch ms.
 * get/has filter on read; purgeExpired reclaims.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

interface Session {
  userId: string
}

class SessionSchema extends LmdbSchema {
  static db = `ttl-session-test`
  static key = t.string()
  static value = t.object<Session>()
  static ttl = 0
}

// Timing budget for this file. `sleep()` guarantees a minimum, not a target —
// under CPU contention it overshoots by an order of magnitude — so the two
// directions of each assertion are made asymmetric on purpose:
//
//   liveness  → a long TTL read back IMMEDIATELY, never after a sleep, so
//               there is no sleep that can overshoot into expiry;
//   expiry    → a short TTL followed by a sleep far past it, where an
//               overshoot only makes the row MORE expired and stays correct.
//
// Every number below is sized so that direction holds on a loaded machine.
const SHORT_TTL_MS = 150
const PAST_EXPIRY_MS = 1500
const LIVE_TTL_MS = 60_000

class DefaultTtlSchema extends LmdbSchema {
  static db = `ttl-default-test`
  static key = t.string()
  static value = t.object<Session>()
  static ttl = SHORT_TTL_MS
}

let tmpDir: string
let env: LmdbEnv
let sessions: LmdbEnvSub<typeof SessionSchema>
let defaultSessions: LmdbEnvSub<typeof DefaultTtlSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-ttl-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  sessions = env.register(SessionSchema)
  defaultSessions = env.register(DefaultTtlSchema)
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

  it(`putMany honors per-call TTL envelopes like put`, async () => {
    await sessions.putMany([
      [`s1`, {userId: `u1`}],
      [`s2`, {userId: `u2`}]
    ])
    await sessions.put(`s3`, {userId: `u3`}, {ttlMs: SHORT_TTL_MS})
    await Bun.sleep(PAST_EXPIRY_MS)
    // Purge before any read: get() evicts expired entries with a
    // fire-and-forget delete, which would race this count.
    expect(await sessions.purgeExpired()).toBe(1)
    expect(sessions.get(`s3`)).toBeUndefined()
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
  })

  it(`putMany applies the schema default TTL`, async () => {
    // The subject is whether putMany stamps the schema's default envelope on
    // its rows. Both reaping proves the default was applied — with `static
    // ttl = 0` these rows would never expire and the count would be 0 — so no
    // liveness read is needed, and that keeps this direction overshoot-safe.
    await defaultSessions.putMany([
      [`d1`, {userId: `u1`}],
      [`d2`, {userId: `u2`}]
    ])
    await Bun.sleep(PAST_EXPIRY_MS)
    expect(await defaultSessions.purgeExpired()).toBe(2)
    expect(defaultSessions.get(`d1`)).toBeUndefined()
  })

  it(`returns value before expiry and undefined after`, async () => {
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: LIVE_TTL_MS})
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
    await sessions.put(`s2`, {userId: `u2`}, {ttlMs: SHORT_TTL_MS})
    await Bun.sleep(PAST_EXPIRY_MS)
    expect(sessions.get(`s2`)).toBeUndefined()
    expect(sessions.has(`s2`)).toBe(false)
  })

  it(`never expires when ttlMs is omitted`, async () => {
    await sessions.put(`s1`, {userId: `u1`})
    await Bun.sleep(SHORT_TTL_MS)
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
  })

  it(`purgeExpired removes only expired entries and returns count`, async () => {
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: SHORT_TTL_MS})
    await sessions.put(`s2`, {userId: `u2`}, {ttlMs: LIVE_TTL_MS})
    await sessions.put(`s3`, {userId: `u3`})
    await Bun.sleep(PAST_EXPIRY_MS)
    const removed = await sessions.purgeExpired()
    expect(removed).toBe(1)
    expect(sessions.get(`s1`)).toBeUndefined()
    expect(sessions.get(`s2`)).toEqual({userId: `u2`})
    expect(sessions.get(`s3`)).toEqual({userId: `u3`})
  })

  it(`overwriting resets TTL`, async () => {
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: SHORT_TTL_MS})
    // Sleep past the original expiry, so from here an unreset row would be gone.
    await Bun.sleep(PAST_EXPIRY_MS)
    await sessions.put(`s1`, {userId: `u1`}, {ttlMs: LIVE_TTL_MS})
    // Live despite the original TTL having passed — that is the reset.
    expect(sessions.get(`s1`)).toEqual({userId: `u1`})
    // A row still on the short TTL does expire, so the window is real.
    await sessions.put(`s2`, {userId: `u2`}, {ttlMs: SHORT_TTL_MS})
    await Bun.sleep(PAST_EXPIRY_MS)
    expect(sessions.get(`s2`)).toBeUndefined()
  })
})
