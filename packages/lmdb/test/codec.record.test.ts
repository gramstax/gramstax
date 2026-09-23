/**
 * Record codec tests — positional array storage for row schemas.
 *
 * Registering a row-shaped schema without custom hooks installs a
 * positional codec automatically: rows encode as arrays in column order
 * (no field names on disk) and decode back to row objects. Custom-hook,
 * TTL, and scalar schemas bypass it.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {RecordCodec} from "../src/codec"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t, type ValueOf} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<T extends true>(): T {
  return true as T
}

class RecordSchema extends LmdbSchema {
  static db = `rec-row`
  static key = t.number()
  static value = {
    name: t.string(),
    age: t.number(),
    active: t.boolean(),
    nickname: t.string().optional(),
    role: t.string(`admin`, `user`),
    created: t.date(),
    tags: t.array<string>(),
    meta: t.object<{level: number}>(),
    score: t.number().default(0)
  }
}

const RECORD_ROW = {
  name: `Alice`,
  age: 30,
  active: true,
  role: `admin` as const,
  created: new Date(`2024-01-02T03:04:05Z`),
  tags: [`a`, `b`],
  meta: {level: 7}
}

class IdentityHookSchema extends LmdbSchema {
  static db = `rec-identity`
  static key = t.number()
  static value = {
    name: t.string(),
    age: t.number()
  }
  static hookBeforeWrite = (value: unknown): unknown => value
  static hookBeforeRead = (raw: unknown): unknown => raw
}

class TtlRecordSchema extends LmdbSchema {
  static db = `rec-ttl`
  static key = t.number()
  static value = {
    name: t.string(),
    age: t.number()
  }
  static ttl = 60_000
}

class ScalarRecordSchema extends LmdbSchema {
  static db = `rec-scalar`
  static key = t.string()
  static value = t.number()
}

class IndexedRecordSchema extends LmdbSchema {
  static db = `rec-indexed`
  static key = t.number()
  static value = {
    email: t.string().unique(),
    team: t.string().index(),
    age: t.number()
  }
}

class SearchedRecordSchema extends LmdbSchema {
  static db = `rec-searched`
  static key = t.number()
  static value = {
    title: t.string().search(),
    age: t.number()
  }
}

class DottedRecordSchema extends LmdbSchema {
  static db = `rec-dotted`
  static key = t.number()
  static value = {
    name: t.string(),
    "profile.email": t.string().index(),
    "profile.phone": t.string()
  }
}

function rawGet(env: LmdbEnv, db: string, key: unknown): unknown {
  const handle = env.getDb(db) as unknown as {get(k: unknown): unknown}
  return handle.get(key)
}

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-rec-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 20})
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

describe(`record codec`, () => {
  it(`is storage-only — row type unchanged`, () => {
    assertType<Equal<ValueOf<typeof RecordSchema>, {name: string; age: number; active: boolean; nickname?: string | undefined; role: `admin` | `user`; created: Date; tags: string[]; meta: {level: number}; score?: number | undefined}>>()
  })

  it(`round-trips every column kind`, async () => {
    const rows = env.register(RecordSchema)
    await rows.put(1, RECORD_ROW)
    const back = rows.get(1)
    expect(back).toEqual({...RECORD_ROW, score: 0})
    expect(back?.created).toBeInstanceOf(Date)
  })

  it(`stores rows positionally without field names`, async () => {
    const rows = env.register(RecordSchema)
    await rows.put(1, RECORD_ROW)
    const raw = rawGet(env, `rec-row`, 1)
    expect(Array.isArray(raw)).toBe(true)
    expect(raw).toEqual([`Alice`, 30, true, undefined, `admin`, RECORD_ROW.created, [`a`, `b`], {level: 7}, 0])
    expect(JSON.stringify(raw)).not.toContain(`name`)
  })

  it(`keeps absent optionals absent`, async () => {
    const rows = env.register(RecordSchema)
    await rows.put(1, RECORD_ROW)
    expect(`nickname` in rows.get(1)!).toBe(false)
    await rows.put(2, {...RECORD_ROW, nickname: `Al`})
    expect(rows.get(2)?.nickname).toBe(`Al`)
  })

  it(`still rejects out-of-enum writes`, async () => {
    const rows = env.register(RecordSchema)
    const bad: any = {...RECORD_ROW, role: `nope`}
    await expect(rows.put(1, bad)).rejects.toBeInstanceOf(LmdbError)
    expect(rows.get(1)).toBeUndefined()
  })

  it(`custom-hook schemas bypass the codec`, async () => {
    const rows = env.register(IdentityHookSchema)
    await rows.put(1, {name: `Alice`, age: 30})
    expect(rows.get(1)).toEqual({name: `Alice`, age: 30})
    expect(rawGet(env, `rec-identity`, 1)).toEqual({name: `Alice`, age: 30})
  })

  it(`ttl schemas bypass the codec`, async () => {
    const rows = env.register(TtlRecordSchema)
    await rows.put(1, {name: `Alice`, age: 30})
    expect(rows.get(1)).toEqual({name: `Alice`, age: 30})
    const raw = rawGet(env, `rec-ttl`, 1) as {v: unknown}
    expect(raw.v).toEqual({name: `Alice`, age: 30})
  })

  it(`scalar schemas bypass the codec`, async () => {
    const counters = env.register(ScalarRecordSchema)
    await counters.put(`n`, 41)
    expect(counters.get(`n`)).toBe(41)
    expect(rawGet(env, `rec-scalar`, `n`)).toBe(41)
    expect(await counters.increment(`n`)).toBe(42)
  })

  it(`indexes keep working through the codec`, async () => {
    const rows = env.register(IndexedRecordSchema)
    await rows.put(1, {email: `a@x.co`, team: `red`, age: 30})
    await rows.put(2, {email: `b@x.co`, team: `red`, age: 31})
    expect(await rows.findByIndex({email: `a@x.co`})).toEqual({email: `a@x.co`, team: `red`, age: 30})
    expect(await rows.findByIndex({team: `red`})).toHaveLength(2)
    await expect(rows.put(3, {email: `a@x.co`, team: `blue`, age: 32})).rejects.toBeInstanceOf(LmdbError)
  })

  it(`search keeps working through the codec`, async () => {
    const docs = env.register(SearchedRecordSchema)
    await docs.put(1, {title: `hello world`, age: 1})
    await docs.put(2, {title: `hello there`, age: 2})
    expect(await docs.search(`hello world`)).toEqual([1])
    expect(rawGet(env, `rec-searched`, 1)).toEqual([`hello world`, 1])
  })

  it(`walks dotted columns positionally`, async () => {
    const rows = env.register(DottedRecordSchema)
    const value = {name: `Alice`, profile: {email: `a@x.co`, phone: `555`}} as any
    await rows.put(1, value)
    expect(rawGet(env, `rec-dotted`, 1)).toEqual([`Alice`, `a@x.co`, `555`])
    expect(rows.get(1)).toEqual(value)
    expect(await rows.findByIndex({"profile.email": `a@x.co`})).toEqual([value])
  })

  it(`passes non-object writes and non-array reads through`, () => {
    const codec = new RecordCodec([`a`, `b`])
    expect(codec.hookBeforeWrite(42)).toBe(42)
    expect(codec.hookBeforeWrite(null)).toBe(null)
    const legacy = {a: 1, b: 2}
    expect(codec.hookBeforeRead(legacy)).toBe(legacy)
    expect(codec.hookBeforeWrite({a: 1, b: 2})).toEqual([1, 2])
    expect(codec.hookBeforeRead([1, undefined])).toEqual({a: 1})
  })
})
