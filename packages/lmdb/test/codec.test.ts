/**
 * Tests for schema write/read hooks — the codec path at the collection boundary.
 *
 * @remarks
 * Default encoding (LMDB native msgpack/json/etc.) is exercised in
 * repository.test.ts. Custom transforms are declared as
 * `static hookBeforeWrite` / `static hookBeforeRead` on a schema class
 * (e.g. `Date → number`), replacing the deleted `LmdbCodec` class.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface Session {
  at: Date
}

class DateSchema extends LmdbSchema {
  static db = `codec-date-test`
  static key = t.string()
  static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as Session).at.getTime()})
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)})
}

class UpperSchema extends LmdbSchema {
  static db = `codec-upper-test`
  static key = t.string()
  static value = t.string()
  static hookBeforeWrite = (v: unknown): unknown => String(v).toUpperCase()
  static hookBeforeRead = (r: unknown): unknown => String(r)
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-codec-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`schema write/read hooks`, () => {
  it(`hookBeforeWrite runs before serialization and hookBeforeRead after deserialization`, async () => {
    env.register(DateSchema)
    const d = new Date(`2026-06-21T10:00:00Z`)
    await env.sub(DateSchema).put(`s1`, {at: d})
    // Raw stored value is the encoded (number) form
    const raw = await (env as any).getDb(`codec-date-test`).get(`s1`)
    expect(raw).toEqual({at: d.getTime()})
    // Decoded read returns the original Date
    const got = env.sub(DateSchema).get(`s1`)
    expect(got?.at).toBeInstanceOf(Date)
    expect(got?.at?.toISOString()).toBe(d.toISOString())
  })

  it(`write/read hooks must be declared together — registration rejects partial`, () => {
    class HalfSchema extends LmdbSchema {
      static db = `codec-half-test`
      static key = t.string()
      static value = t.string()
      static hookBeforeWrite = (v: unknown): unknown => v
    }
    expect(() => env.register(HalfSchema)).toThrow(/hookBeforeWrite.*hookBeforeRead/)
  })

  it(`write hook transform round-trips through put/get`, async () => {
    env.register(UpperSchema)
    await env.sub(UpperSchema).put(`k`, `hello`)
    expect(env.sub(UpperSchema).get(`k`)).toBe(`HELLO`)
    // Raw stored value is uppercased
    const raw = await (env as any).getDb(`codec-upper-test`).get(`k`)
    expect(raw).toBe(`HELLO`)
  })
})