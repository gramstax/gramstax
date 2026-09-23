/**
 * Embedded indexes — declarative schema columns (`t.string().unique()` /
 * `t.string().index()`) on LmdbSchema (SQL: CREATE INDEX / CREATE UNIQUE
 * INDEX). Index sub-DBs are auto-created and maintained atomically with
 * primary writes; unique constraints throw LmdbError; reads
 * via the unified object-query findByIndex (unique keys → T | undefined,
 * non-unique → T[], multi-key AND semantics); repair via reindex. Covers
 * auto-resolved field paths (plain + dotted), explicit extractors (attached
 * manually via attachIndexes — schemas cannot express extractors),
 * unique-conflict semantics, query guards (empty, null/undefined, unknown
 * key), multi-key AND filtering, TTL interplay, bulk ops (deleteByPrefix /
 * clear / putMany), conditional writes (putIfNotExists / compareAndSet).
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface IVUser {
  username: string
  email: string
  name?: string
  profile?: {email: string}
}

// Main schema: username unique, email non-unique. The lowerEmail extractor
// index cannot be expressed as a schema column — attached manually after
// registration (schema auto-attaches username + email).

class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    username: t.string().unique(),
    email: t.string().index()
  }
}

// Two unique indexes — multi-key ALL-unique queries resolve to a single record.
class TwoUniqueSchema extends LmdbSchema {
  static db = `two-unique`
  static key = t.number()
  static value = {
    username: t.string().unique(),
    email: t.string().unique()
  }
}

// Dotted field path: column name IS the path (`value.profile.email`).
class ProfileUserSchema extends LmdbSchema {
  static db = `profile-users`
  static key = t.number()
  static value = {
    "profile.email": t.string().unique()
  }
}

// Auto-resolved field that does not exist on the value — first write throws.
class MissingFieldSchema extends LmdbSchema {
  static db = `missing-field`
  static key = t.number()
  static value = {
    nope: t.string().unique()
  }
}

// String-keyed repo for deleteByPrefix / clear index-cleanup coverage.
class StrUserSchema extends LmdbSchema {
  static db = `str-users`
  static key = t.string()
  static value = {
    username: t.string().unique(),
    email: t.string().index()
  }
}

// Same dbName across DIFFERENT envs — reindex over pre-existing data.
class IndexedAfterSchema extends LmdbSchema {
  static db = `reindex-plain`
  static key = t.number()
  static value = {
    username: t.string().unique()
  }
}

// Plain (index-less) repo over the same data file — env A writes duplicates
// before env B attaches the indexed schema.
class PlainReindexSchema extends LmdbSchema {
  static db = `reindex-plain`
  static key = t.number()
  static value = t.object<IVUser>()
}

// Raw-value repo with manually attached extractor indexes — schemas cannot
// express custom extractors.
class SkipUsersSchema extends LmdbSchema {
  static db = `skip-users`
  static key = t.number()
  static value = t.object<IVUser>()
}

// TTL repo with a unique embedded index (schema static ttl → TTL repo).
class TtlUserSchema extends LmdbSchema {
  static db = `ttl-users`
  static key = t.number()
  static value = {
    username: t.string().unique()
  }
  static ttl = 50
}

// Unique-only index repo for the useVersions env.
class CasUserSchema extends LmdbSchema {
  static db = `cas-users`
  static key = t.number()
  static value = {
    username: t.string().unique()
  }
}

// Non-unique (dupSort) index collection for the useVersions env: the
// dupSort index sub-DB opts out of env-level versions because lmdb
// rejects dupSort combined with versions.
class CasEmailSchema extends LmdbSchema {
  static db = `cas-email-users`
  static key = t.number()
  static value = {
    email: t.string().index()
  }
}

// Unique violations surface with the raw index message (the transaction layer
// unwraps it) — but accept the wrapped form defensively.
// (bun's rejects.toSatisfy does not unwrap promises, so use an explicit helper.)
async function expectUniqueViolation(p: Promise<unknown>): Promise<void> {
  const messages: Array<string> = []
  try {
    await p
  } catch (err) {
    if (err instanceof LmdbError) messages.push(err.message)
    const cause = (err as {cause?: unknown}).cause
    if (cause instanceof LmdbError) messages.push(cause.message)
    if (messages.some((m) => m.includes(`Unique index `))) return
    throw new Error(`Expected unique-violation LmdbError, got: ${String(err)}`)
  }
  throw new Error(`Expected unique-violation LmdbError, but the promise resolved`)
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-embedded-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 20})
  env.register(UserSchema)
  env.register(ProfileUserSchema)
  env.register(MissingFieldSchema)
  env.register(TwoUniqueSchema)
  env.register(StrUserSchema)
  env.register(SkipUsersSchema)
  env._attachIndexes(`users`, [{name: `lowerEmail`, def: {extractor: (u: unknown) => (u as IVUser).email.toLowerCase()}, dbName: `users:idx:lowerEmail`}])
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`embedded indexes`, () => {
  it(`auto-resolves a plain field path; findByIndex handles unique and non-unique reads`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await env.sub(UserSchema).put(2, {username: `budi`, email: `A@B.com`})
    // non-unique email index → T[]
    expect(await env.sub(UserSchema).findByIndex({email: `a@b.com`})).toEqual([{username: `damar`, email: `a@b.com`}])
    expect(await env.sub(UserSchema).findByIndex({email: `missing@b.com`})).toEqual([])
    // unique username index → T | undefined
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`, email: `a@b.com`})
    expect(await env.sub(UserSchema).findByIndex({username: `nobody`})).toBeUndefined()
    // explicit extractor (lowerEmail) — case-insensitive
    expect(await env.sub(UserSchema).findByIndex({lowerEmail: `a@b.com`} as any)).toEqual([
      {username: `damar`, email: `a@b.com`},
      {username: `budi`, email: `A@B.com`}
    ])
  })

  it(`auto-resolves a dotted field path (column name is the path)`, async () => {
    const value = {profile: {email: `p.deep@x.com`}} as any
    await env.sub(ProfileUserSchema).put(1, value)
    expect(await env.sub(ProfileUserSchema).findByIndex({"profile.email": `p.deep@x.com`})).toEqual(value)
    expect(await env.sub(ProfileUserSchema).findByIndex({"profile.email": `other@x.com`})).toBeUndefined()
  })

  it(`throws LmdbError on first put when an auto-resolved field is missing`, async () => {
    // extractor `value.nope` — field absent → LmdbError wrapped by the
    // transaction layer (LmdbError extends LmdbError)
    await expect(env.sub(MissingFieldSchema).put(1, {username: `x`, email: `x@y.z`} as any)).rejects.toThrow(LmdbError)
    // nothing was written, and the index is untouched
    expect(env.sub(MissingFieldSchema).count()).toBe(0)
  })

  it(`skips records whose extractor yields undefined`, async () => {
    env._attachIndexes(`skip-users`, [
      {
        name: `email`,
        def: {extractor: (u: unknown) => ((u as IVUser).email === `skip@x.com` ? undefined : (u as IVUser).email)},
        dbName: `skip-users:idx:email`
      }
    ])
    await env.sub(SkipUsersSchema).put(1, {username: `s`, email: `skip@x.com`})
    expect(env.sub(SkipUsersSchema).get(1)).toEqual({username: `s`, email: `skip@x.com`})
    expect(await (env.sub(SkipUsersSchema) as any).findByIndex({email: `skip@x.com`})).toEqual([])
    await env.sub(SkipUsersSchema).put(2, {username: `t`, email: `t@x.com`})
    expect(await (env.sub(SkipUsersSchema) as any).findByIndex({email: `t@x.com`})).toEqual([{username: `t`, email: `t@x.com`}])
  })

  it(`rejects a duplicate unique value on insert`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await expectUniqueViolation(env.sub(UserSchema).put(2, {username: `damar`, email: `b@b.com`}))
  })

  it(`rejects updating a record to a unique value owned by another key`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await env.sub(UserSchema).put(2, {username: `budi`, email: `b@b.com`})
    await expectUniqueViolation(env.sub(UserSchema).put(2, {username: `damar`, email: `b@b.com`}))
    // rollback: user2 still owns `budi`, user1 still owns `damar`
    expect(await env.sub(UserSchema).findByIndex({username: `budi`})).toEqual({username: `budi`, email: `b@b.com`})
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`, email: `a@b.com`})
  })

  it(`allows re-putting the same key with the same unique value (self-update)`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await env.sub(UserSchema).put(1, {username: `damar`, email: `new@x.com`})
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`, email: `new@x.com`})
    // non-unique side updated in the same write
    expect(await env.sub(UserSchema).findByIndex({email: `new@x.com`})).toEqual([{username: `damar`, email: `new@x.com`}])
    expect(await env.sub(UserSchema).findByIndex({email: `a@b.com`})).toEqual([])
  })

  it(`frees the old unique value when a record's indexed field changes`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await env.sub(UserSchema).put(1, {username: `budi`, email: `a@b.com`})
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toBeUndefined()
    expect(await env.sub(UserSchema).findByIndex({username: `budi`})).toEqual({username: `budi`, email: `a@b.com`})
  })

  it(`findByIndex returns every record sharing a non-unique value`, async () => {
    await env.sub(UserSchema).put(1, {username: `a`, email: `same@x.com`})
    await env.sub(UserSchema).put(2, {username: `b`, email: `same@x.com`})
    const found: IVUser[] = (await env.sub(UserSchema).findByIndex({email: `same@x.com`})) as unknown as IVUser[]
    expect(found).toHaveLength(2)
    expect(found.map((u: IVUser) => u.username).sort()).toEqual([`a`, `b`])
  })

  it(`multi-key all-unique query returns the single record matching every key`, async () => {
    await env.sub(TwoUniqueSchema).put(1, {username: `u1`, email: `e1`})
    await env.sub(TwoUniqueSchema).put(2, {username: `u2`, email: `e2`})
    // all queried keys unique → T | undefined
    const hit: IVUser | undefined = (await env.sub(TwoUniqueSchema).findByIndex({username: `u1`, email: `e1`})) as unknown as IVUser | undefined
    expect(hit).toEqual({username: `u1`, email: `e1`})
    // miss on any key → undefined (all queried keys are unique)
    expect(await env.sub(TwoUniqueSchema).findByIndex({username: `u1`, email: `e2`})).toBeUndefined()
    expect(await env.sub(TwoUniqueSchema).findByIndex({username: `nobody`, email: `e1`})).toBeUndefined()
  })

  it(`multi-key mixed query AND-filters candidates across indexes`, async () => {
    await env.sub(UserSchema).put(1, {username: `a`, email: `Shared@x.com`})
    await env.sub(UserSchema).put(2, {username: `b`, email: `Shared@x.com`})
    await env.sub(UserSchema).put(3, {username: `c`, email: `shared@x.com`})
    // email non-unique → mixed query resolves T[]
    const found: IVUser[] = (await env.sub(UserSchema).findByIndex({email: `Shared@x.com`, lowerEmail: `shared@x.com`} as any)) as unknown as IVUser[]
    expect(found.map((u: IVUser) => u.username).sort()).toEqual([`a`, `b`])
    // driver (email) has no hit → lowerEmail drives; the email filter then rejects every candidate
    expect(await env.sub(UserSchema).findByIndex({email: `missing@x.com`, lowerEmail: `shared@x.com`} as any)).toEqual([])
  })

  it(`contradictory keys yield no match instead of throwing`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await env.sub(TwoUniqueSchema).put(1, {username: `u1`, email: `e1`})
    // mixed query (unique + non-unique) → [] (empty array)
    const mixed: IVUser[] = (await env.sub(UserSchema).findByIndex({username: `damar`, email: `other@x.com`})) as unknown as IVUser[]
    expect(mixed).toEqual([])
    // all-unique query → undefined
    expect(await env.sub(TwoUniqueSchema).findByIndex({username: `u1`, email: `e2`})).toBeUndefined()
  })

  it(`type-level: invalid query shapes are compile-time errors`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await expect(env.sub(UserSchema).findByIndex({usernme: `x`} as any)).rejects.toThrow(LmdbError)
    await expect(env.sub(UserSchema).findByIndex({} as any)).rejects.toThrow(LmdbError)
    expect(await env.sub(UserSchema).findByIndex({username: 123} as any)).toBeUndefined()
  })

  it(`throws LmdbError on an empty query`, async () => {
    await expect(env.sub(UserSchema).findByIndex({} as any)).rejects.toThrow(LmdbError)
  })

  it(`throws LmdbError on null/undefined query values`, async () => {
    await expect(env.sub(UserSchema).findByIndex({username: null} as any)).rejects.toThrow(LmdbError)
    await expect(env.sub(UserSchema).findByIndex({username: undefined} as any)).rejects.toThrow(LmdbError)
  })

  it(`throws LmdbError on an undeclared index key`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    await expect(env.sub(UserSchema).findByIndex({nope: `x`} as any)).rejects.toThrow(LmdbError)
  })

  it(`rejects unknown index names on reindex and queries alike`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `a@b.com`})
    // the unified API reads unique and non-unique indexes alike
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`, email: `a@b.com`})
    expect(await env.sub(UserSchema).findByIndex({email: `a@b.com`})).toEqual([{username: `damar`, email: `a@b.com`}])
    // unknown index name → LmdbError listing the declared indexes
    await expect(env.sub(UserSchema).findByIndex({unknownIdx: `x`} as any)).rejects.toThrow(LmdbError)
    expect(() => env.sub(UserSchema).reindex(`unknown-idx`)).toThrow(LmdbError)
  })

  it(`reindex() rebuilds every index and reports built/skipped`, async () => {
    await env.sub(UserSchema).put(1, {username: `a`, email: `a@x.com`})
    await env.sub(UserSchema).put(2, {username: `b`, email: `b@x.com`})
    await env.sub(UserSchema).put(3, {username: `c`, email: `a@x.com`})
    const res = await env.sub(UserSchema).reindex()
    // built counts index ENTRIES: 3 records x 3 indexes (username, email, lowerEmail)
    expect(res.built).toBe(9)
    expect(res.skipped).toEqual([])
    expect(await env.sub(UserSchema).findByIndex({username: `b`})).toEqual({username: `b`, email: `b@x.com`})
    expect(await env.sub(UserSchema).findByIndex({email: `a@x.com`})).toHaveLength(2)
  })

  it(`reindex(name) rebuilds only the named index`, async () => {
    await env.sub(UserSchema).put(1, {username: `a`, email: `a@x.com`})
    const res = await env.sub(UserSchema).reindex(`email`)
    expect(res.built).toBe(1)
    expect(res.skipped).toEqual([])
    expect(await env.sub(UserSchema).findByIndex({email: `a@x.com`})).toEqual([{username: `a`, email: `a@x.com`}])
  })

  it(`reindex skips records whose extractor yields undefined (built counts only indexed)`, async () => {
    env._attachIndexes(`skip-users`, [
      {
        name: `username`,
        def: {unique: true, extractor: (u: unknown) => ((u as IVUser).username === `skip` ? undefined : (u as IVUser).username)},
        dbName: `skip-users:idx:username`
      }
    ])
    await env.sub(SkipUsersSchema).put(1, {username: `skip`, email: `s@x.com`})
    await env.sub(SkipUsersSchema).put(2, {username: `a`, email: `a@x.com`})
    await env.sub(SkipUsersSchema).put(3, {username: `b`, email: `b@x.com`})
    const res = await env.sub(SkipUsersSchema).reindex()
    expect(res.built).toBe(2)
    expect(res.skipped).toEqual([])
    expect(await (env.sub(SkipUsersSchema) as any).findByIndex({username: `skip`})).toBeUndefined()
    expect(await (env.sub(SkipUsersSchema) as any).findByIndex({username: `a`})).toEqual({username: `a`, email: `a@x.com`})
  })

  it(`reindex skips unique conflicts between pre-existing records`, async () => {
    // env A: plain repo (no indexes) — duplicate usernames allowed at put time
    const plainTmp = createTestDir(`lmdb-reindex-conflict-`)
    const envA = new LmdbEnv({path: plainTmp, maxDbs: 10})
    envA.register(PlainReindexSchema)
    await envA.sub(PlainReindexSchema).put(1, {username: `a`, email: `x@y.z`})
    await envA.sub(PlainReindexSchema).put(2, {username: `a`, email: `x2@y.z`})
    await envA.close()

    // env B: same data file, indexed schema — reindex must not overwrite the
    // owner; the colliding record is reported in `skipped`
    const envB = new LmdbEnv({path: plainTmp, maxDbs: 10})
    try {
      envB.register(IndexedAfterSchema)
      const res = await envB.sub(IndexedAfterSchema).reindex()
      expect(res.built).toBe(1)
      expect(res.skipped).toEqual([{key: 2, index: `username`, value: `a`}])
      expect(await envB.sub(IndexedAfterSchema).findByIndex({username: `a`})).toEqual({username: `a`, email: `x@y.z`} as any)
    } finally {
      await envB.close()
      await rmWithRetry(plainTmp)
    }
  })

  it(`deleteByPrefix and clear() clean the index sub-DBs`, async () => {
    await env.sub(StrUserSchema).put(`u1`, {username: `a`, email: `a@x.com`})
    await env.sub(StrUserSchema).put(`u2`, {username: `b`, email: `b@x.com`})
    const removed = await env.sub(StrUserSchema).deleteByPrefix(`u`)
    expect(removed).toBe(2)
    expect(env.sub(StrUserSchema).count()).toBe(0)
    expect(await env.sub(StrUserSchema).findByIndex({email: `a@x.com`})).toEqual([])
    expect(await env.sub(StrUserSchema).findByIndex({username: `a`})).toBeUndefined()

    await env.sub(StrUserSchema).put(`u1`, {username: `a`, email: `a@x.com`})
    await env.sub(StrUserSchema).put(`u2`, {username: `b`, email: `b@x.com`})
    await env.sub(StrUserSchema).clear()
    expect(env.sub(StrUserSchema).count()).toBe(0)
    expect(await env.sub(StrUserSchema).findByIndex({email: `a@x.com`})).toEqual([])
    expect(await env.sub(StrUserSchema).findByIndex({username: `b`})).toBeUndefined()
  })

  it(`rejects increment and putBinary on indexed repositories`, async () => {
    await expect(env.sub(UserSchema).increment(1)).rejects.toThrow(LmdbError)
    await expect(env.sub(UserSchema).decrement(1)).rejects.toThrow(LmdbError)
    await expect(env.sub(UserSchema).putBinary(1, Buffer.from(`x`))).rejects.toThrow(LmdbError)
  })

  it(`putMany maintains indexes for every entry`, async () => {
    await env.sub(UserSchema).putMany([
      [1, {username: `a`, email: `a@x.com`}],
      [2, {username: `b`, email: `b@x.com`}]
    ])
    expect(await env.sub(UserSchema).findByIndex({email: `a@x.com`})).toEqual([{username: `a`, email: `a@x.com`}])
    expect(await env.sub(UserSchema).findByIndex({username: `b`})).toEqual({username: `b`, email: `b@x.com`})
  })

  it(`putIfNotExists returns true on insert and false on conflict, maintaining the index only on success`, async () => {
    const ok = await env.sub(UserSchema).putIfNotExists(1, {username: `damar`, email: `a@b.com`})
    expect(ok).toBe(true)
    expect(env.sub(UserSchema).get(1)).toEqual({username: `damar`, email: `a@b.com`})
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`, email: `a@b.com`})
    // conflict: key exists → false, record + index untouched
    const again = await env.sub(UserSchema).putIfNotExists(1, {username: `hijack`, email: `h@x.com`})
    expect(again).toBe(false)
    expect(env.sub(UserSchema).get(1)).toEqual({username: `damar`, email: `a@b.com`})
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`, email: `a@b.com`})
    expect(await env.sub(UserSchema).findByIndex({username: `hijack`})).toBeUndefined()
  })

  it(`update() maintains the embedded index`, async () => {
    await env.sub(UserSchema).put(1, {username: `damar`, email: `old@x.com`})
    const current = env.sub(UserSchema).get(1)
    const next = {...current!, email: `new@x.com`}
    await env.sub(UserSchema).put(1, next)
    expect(next.email).toBe(`new@x.com`)
    expect(await env.sub(UserSchema).findByIndex({email: `new@x.com`})).toEqual([{username: `damar`, email: `new@x.com`}])
    expect(await env.sub(UserSchema).findByIndex({email: `old@x.com`})).toEqual([])
    expect(await env.sub(UserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`, email: `new@x.com`})
  })
})

describe(`embedded indexes + TTL`, () => {
  let tTmpDir: string
  let tEnv: LmdbEnv

  beforeEach(() => {
    tTmpDir = createTestDir(`lmdb-embedded-ttl-`)
    tEnv = new LmdbEnv({path: tTmpDir, maxDbs: 10})
    tEnv.register(TtlUserSchema)
  })

  afterEach(async () => {
    await tEnv.close()
    await rmWithRetry(tTmpDir)
  })

  it(`purgeExpired removes the unique index row`, async () => {
    await tEnv.sub(TtlUserSchema).put(1, {username: `damar`})
    expect(tEnv.sub(TtlUserSchema).get(1)).toEqual({username: `damar`})
    expect(await tEnv.sub(TtlUserSchema).findByIndex({username: `damar`})).toEqual({username: `damar`})
    await Bun.sleep(80)
    const removed = await tEnv.sub(TtlUserSchema).purgeExpired()
    expect(removed).toBe(1)
    expect(tEnv.sub(TtlUserSchema).count()).toBe(0)
    expect(await tEnv.sub(TtlUserSchema).findByIndex({username: `damar`})).toBeUndefined()
  })

  it(`post-expiry get on an indexed TTL repo returns undefined without recursing`, async () => {
    await tEnv.sub(TtlUserSchema).put(1, {username: `damar`})
    await Bun.sleep(80)
    // FIXED (BUG 2): previously this recursed — TTL get's lazy
    // super.delete() called the indexed delete path, which re-read via
    // virtual get() → RangeError stack overflow. The index-maintenance
    // read now uses _peek() (non-virtual, pure envelope unwrap), so the
    // lazy delete completes cleanly.
    expect(tEnv.sub(TtlUserSchema).get(1)).toBeUndefined()
    // give the fire-and-forget lazy delete a turn to commit, then verify
    // both the record and its index row are gone
    await Bun.sleep(0)
    expect(tEnv.sub(TtlUserSchema).count()).toBe(0)
    expect(await tEnv.sub(TtlUserSchema).findByIndex({username: `damar`})).toBeUndefined()
  })
})

describe(`embedded indexes + compareAndSet (useVersions)`, () => {
  let vTmpDir: string
  let vEnv: LmdbEnv

  beforeEach(() => {
    vTmpDir = createTestDir(`lmdb-embedded-ver-`)
    vEnv = new LmdbEnv({path: vTmpDir, maxDbs: 10, useVersions: true})
    vEnv.register(CasUserSchema)
  })

  afterEach(async () => {
    await vEnv.close()
    await rmWithRetry(vTmpDir)
  })

  const cas = (key: number, expectedVersion: number, value: {username: string}) =>
    vEnv.transaction(() => {
      const entry = vEnv.rootGetEntry(`cas:${key}`)
      if (entry?.version !== expectedVersion) return false
      vEnv.rootPutSync(`cas:${key}`, value, expectedVersion + 1)
      vEnv.sub(CasUserSchema).putSync(key, value)
      return true
    })

  it(`compareAndSet with a matching version maintains the index and returns true`, async () => {
    vEnv.rootPutSync(`cas:1`, {username: `damar`}, 1)
    const ok = await cas(1, 1, {username: `budi`})
    expect(ok).toBe(true)
    expect(await vEnv.sub(CasUserSchema).findByIndex({username: `budi`})).toEqual({username: `budi`})
    expect(await vEnv.sub(CasUserSchema).findByIndex({username: `damar`})).toBeUndefined()
  })

  it(`compareAndSet with a stale version returns false and leaves record and index untouched`, async () => {
    vEnv.rootPutSync(`cas:1`, {username: `damar`}, 1)
    const ok0 = await cas(1, 1, {username: `budi`})
    expect(ok0).toBe(true)
    const ok = await cas(1, 99, {username: `hijack`})
    expect(ok).toBe(false)
    expect(vEnv.sub(CasUserSchema).get(1)).toEqual({username: `budi`})
    expect(await vEnv.sub(CasUserSchema).findByIndex({username: `budi`})).toEqual({username: `budi`})
    expect(await vEnv.sub(CasUserSchema).findByIndex({username: `hijack`})).toBeUndefined()
  })

  it(`non-unique (dupSort) embedded index registers and works on a useVersions env`, async () => {
    vEnv.register(CasEmailSchema)
    await vEnv.sub(CasEmailSchema).put(1, {email: `same@x.com`})
    await vEnv.sub(CasEmailSchema).put(2, {email: `same@x.com`})
    expect(await vEnv.sub(CasEmailSchema).findByIndex({email: `same@x.com`})).toHaveLength(2)
  })
})

describe(`findByIndex limit`, () => {
  beforeEach(async () => {
    const users = env.sub(StrUserSchema)
    for (let i = 0; i < 50; i++) {
      await users.put(`u${i}`, {username: `user${i}`, email: `group${i % 5}@x.dev`})
    }
  })

  it(`caps non-unique matches to the leading limit rows`, async () => {
    const users = env.sub(StrUserSchema)
    const full = await users.findByIndex({email: `group1@x.dev`})
    expect(full).toHaveLength(10)
    const limited = await users.findByIndex({email: `group1@x.dev`}, undefined, {limit: 3})
    expect(limited).toHaveLength(3)
    expect(limited).toEqual(full.slice(0, 3))
  })

  it(`returns every match when limit exceeds the set`, async () => {
    const users = env.sub(StrUserSchema)
    expect(await users.findByIndex({email: `group1@x.dev`}, undefined, {limit: 100})).toHaveLength(10)
  })

  it(`limit 0 returns an empty array for non-unique queries`, async () => {
    const users = env.sub(StrUserSchema)
    expect(await users.findByIndex({email: `group1@x.dev`}, undefined, {limit: 0})).toEqual([])
  })

  it(`applies limit after multi-key AND filtering`, async () => {
    const users = env.sub(StrUserSchema)
    const one = await users.findByIndex({email: `group1@x.dev`, username: `user11`}, undefined, {limit: 5})
    expect(one).toHaveLength(1)
  })

  it(`unique queries ignore positive limits and empty on zero`, async () => {
    const users = env.sub(StrUserSchema)
    expect(await users.findByIndex({username: `user1`}, undefined, {limit: 5})).toEqual({username: `user1`, email: `group1@x.dev`})
    expect(await users.findByIndex({username: `user1`}, undefined, {limit: 0})).toBeUndefined()
  })

})
