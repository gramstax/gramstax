/**
 * Declarative schema support — `LmdbSchema` subclasses + `t` builders bridge
 * into the class-based registration path (`env.register(SchemaClass)`): the
 * class's `static db` becomes the repo's dbName and derived index
 * descriptors (`LmdbSchema.deriveIndexes`) are attached exactly like a
 * `static indexes` map. Covers schema validation at registration time
 * (derived indexes, key restrictions, duplicate names, write/read hook pairing),
 * msgpack roundtrips for all 8 column kinds + optional, `ValueOf` type-level row
 * inference, unique conflicts, findByIndex narrowing (unique → scalar, index
 * → array, unknown key rejection), schema/schema coexistence in one env,
 * multi-key AND queries, and reindex. TTL schema integration is
 * intentionally NOT covered here (out of scope for this layer).
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import type {ValueOf} from "../src/schema"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

// Second schema fixture for coexistence + dbName collision tests (two schema
// declaration paths coexist — schema-vs-schema, not class-vs-schema).
class ClassUsersSchema extends LmdbSchema {
  static db = `class-users`
  static key = t.number()
  static value = {
    username: t.string().unique()
  }
}

// Schema covering all 8 column kinds + a optional column (roundtrip + ValueOf).
class FullKindsSchema extends LmdbSchema {
  static db = `full-kinds`
  static key = t.number()
  static value = {
    str: t.string(),
    num: t.number(),
    big: t.bigint(),
    bool: t.boolean(),
    obj: t.object(),
    arr: t.array(),
    date: t.date(),
    buf: t.buffer(),
    optionalStr: t.string().optional()
  }
}

// Unique `id` + indexed `username` + plain `email` — index derivation fixture.
class IndexedUsersSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index(),
    email: t.string()
  }
}

// `.index(name)` override fixture.
class CustomIndexSchema extends LmdbSchema {
  static db = `custom`
  static key = t.number()
  static value = {
    email: t.string().index(`customEmail`)
  }
}

// Simple unique-username schema for coexistence tests.
class UsersSchema extends LmdbSchema {
  static db = `schema-users`
  static key = t.number()
  static value = {
    username: t.string().unique()
  }
}

// Unique `id` column — duplicate values must reject.
class UniqueConflictSchema extends LmdbSchema {
  static db = `unique-conflict`
  static key = t.number()
  static value = {
    id: t.number().unique()
  }
}

// Unique `id` + non-unique `username` for findByIndex narrowing.
class FindByIndexSchema extends LmdbSchema {
  static db = `find-by-index`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index()
  }
}

// Two non-unique indexes for multi-key AND queries.
class MultiAndSchema extends LmdbSchema {
  static db = `multi-and`
  static key = t.number()
  static value = {
    city: t.string().index(),
    active: t.boolean().index()
  }
}

// Single index for reindex coverage.
class ReindexSchema extends LmdbSchema {
  static db = `reindex-schema`
  static key = t.number()
  static value = {
    username: t.string().index()
  }
}

// Same dbName as ClassUserRepo — registration must throw LmdbError.
class CollidingSchema extends LmdbSchema {
  static db = `class-users`
  static key = t.number()
  static value = {
    name: t.string()
  }
}

// Validation-error fixtures — invalid at registration time. The static base
// type widens `key`/`value` to `ColumnBuilder` / `Record<string, AnyColumnBuilder>`,
// so these still compile; `LmdbSchema.validate` rejects them when
// `env.register` runs.
class UniqueKeySchema extends LmdbSchema {
  static db = `bad`
  static key = t.number().unique()
  static value = {}
}

class IndexedKeySchema extends LmdbSchema {
  static db = `bad`
  static key = t.string().index()
  static value = {}
}

class DuplicateIndexSchema extends LmdbSchema {
  static db = `dup`
  static key = t.number()
  static value = {
    a: t.string().index(`x`),
    b: t.number().index(`x`)
  }
}

// write/read hook pair fixtures — validate() requires both-or-neither.
class EncodeOnlySchema extends LmdbSchema {
  static db = `encode-only`
  static key = t.number()
  static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => row
}

class DecodeOnlySchema extends LmdbSchema {
  static db = `decode-only`
  static key = t.number()
  static value = {at: t.date()}
  static hookBeforeRead = (raw: unknown): unknown => raw
}

// Date → number transform stored via the write hook, restored via the read hook.
class CodedSchema extends LmdbSchema {
  static db = `coded`
  static key = t.number()
  static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as {at: Date}).at.getTime()})
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)})
}

// t.object<T>() / t.array<T>() carry narrowed value types in ValueOf.
class GenericValueSchema extends LmdbSchema {
  static db = `generic-value`
  static key = t.number()
  static value = {
    profile: t.object<{bio: string; age: number}>(),
    // profile: t.object({
    //   bio: t.string(),
    //   age: t.number()
    // })
    tags: t.array<string>()
  }
}

// Unique violations surface with the raw index message (the transaction layer
// unwraps it) — but accept the wrapped form defensively.
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

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-schema-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 20})
  env.register(ClassUsersSchema)
  env.register(FullKindsSchema)
  env.register(UsersSchema)
  env.register(UniqueConflictSchema)
  env.register(FindByIndexSchema)
  env.register(MultiAndSchema)
  env.register(ReindexSchema)
  env.register(CodedSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`schema validation at registration`, () => {
  it(`derives index descriptors from unique() and index() columns`, () => {
    const indexes = LmdbSchema.deriveIndexes(IndexedUsersSchema.value)
    expect(indexes).toHaveLength(2)
    expect(indexes[0]?.name).toBe(`id`)
    expect(indexes[0]?.def.unique).toBe(true)
    expect(indexes[1]?.name).toBe(`username`)
    expect(indexes[1]?.def.unique).toBe(false)
  })

  it(`index(name) overrides the default column-name index`, () => {
    const indexes = LmdbSchema.deriveIndexes(CustomIndexSchema.value)
    expect(indexes).toHaveLength(1)
    expect(indexes[0]?.name).toBe(`customEmail`)
    expect(indexes[0]?.def.unique).toBe(false)
  })

  it(`rejects a unique key column`, () => {
    // the base type accepts any builder, so this compiles; validate() rejects it at runtime
    expect(() => env.register(UniqueKeySchema)).toThrow(LmdbError)
  })

  it(`rejects an indexed key column`, () => {
    expect(() => env.register(IndexedKeySchema)).toThrow(LmdbError)
  })

  it(`rejects duplicate index names`, () => {
    expect(() => env.register(DuplicateIndexSchema)).toThrow(LmdbError)
  })
})

describe(`schema repository roundtrip`, () => {
  it(`roundtrips all 8 column kinds through msgpack`, async () => {
    const row = {
      str: `hello`,
      num: 42,
      big: 9007199254740993n,
      bool: true,
      obj: {nested: {deep: [1, 2]}},
      arr: [1, `two`, {three: 3}],
      date: new Date(`2024-01-01T00:00:00.000Z`),
      buf: new Uint8Array([1, 2, 3, 255]),
      optionalStr: `present`
    }
    await env.sub(FullKindsSchema).put(1, row)
    const back = env.sub(FullKindsSchema).get(1)
    expect(back).toEqual(row)
    // typed fidelity: Date and BigInt survive natively, buffer stays binary
    expect(back?.date).toBeInstanceOf(Date)
    expect(back?.big).toBe(9007199254740993n)
    expect(back?.buf).toBeInstanceOf(Uint8Array)
  })

  it(`stores an undefined optional column as absent`, async () => {
    await env.sub(FullKindsSchema).put(1, {
      str: `x`,
      num: 0,
      big: 0n,
      bool: false,
      obj: {},
      arr: [],
      date: new Date(0),
      buf: new Uint8Array(),
      optionalStr: undefined
    })
    expect(env.sub(FullKindsSchema).get(1)?.optionalStr).toBeUndefined()
  })

  it(`ValueOf exposes the row value type`, () => {
    type Row = ValueOf<typeof FullKindsSchema>
    const row: Row = {
      str: `a`,
      num: 1,
      big: 2n,
      bool: true,
      obj: {n: 1},
      arr: [`x`],
      date: new Date(0),
      buf: new Uint8Array([1]),
      optionalStr: undefined
    }
    // @ts-expect-error `optionalStr` accepts string | undefined, not number
    const bad: Row = {...row, optionalStr: 123}
    void bad
    expect(row.buf).toBeInstanceOf(Uint8Array)
  })
})

describe(`schema unique constraints`, () => {
  it(`rejects a duplicate unique value via the schema-created repo`, async () => {
    await env.sub(UniqueConflictSchema).put(1, {id: 1})
    await expectUniqueViolation(env.sub(UniqueConflictSchema).put(2, {id: 1}))
    // rollback: user 2 was never written
    expect(env.sub(UniqueConflictSchema).count()).toBe(1)
    expect(env.sub(UniqueConflictSchema).get(2)).toBeUndefined()
  })
})

describe(`schema findByIndex`, () => {
  it(`unique column → scalar, index column → array, unknown key → LmdbError`, async () => {
    await env.sub(FindByIndexSchema).put(1, {id: 1, username: `damar`})
    // unique id → T | undefined
    expect(await env.sub(FindByIndexSchema).findByIndex({id: 1})).toEqual({id: 1, username: `damar`})
    expect(await env.sub(FindByIndexSchema).findByIndex({id: 99})).toBeUndefined()
    // non-unique username → T[]
    expect(await env.sub(FindByIndexSchema).findByIndex({username: `damar`})).toEqual([{id: 1, username: `damar`}])
    expect(await env.sub(FindByIndexSchema).findByIndex({username: `nobody`})).toEqual([])
    await expect(env.sub(FindByIndexSchema).findByIndex({nope: 1} as any)).rejects.toThrow(LmdbError)
  })
})

describe(`schema coexistence`, () => {
  it(`two schema repositories work independently in one env`, async () => {
    await env.sub(ClassUsersSchema).put(1, {username: `classy`})
    await env.sub(UsersSchema).put(1, {username: `schemey`})
    expect(env.sub(ClassUsersSchema).get(1)).toEqual({username: `classy`})
    expect(env.sub(UsersSchema).get(1)).toEqual({username: `schemey`})
    expect(env.sub(ClassUsersSchema).count()).toBe(1)
    expect(env.sub(UsersSchema).count()).toBe(1)
    expect(await env.sub(ClassUsersSchema).findByIndex({username: `classy`})).toEqual({username: `classy`})
    expect(await env.sub(UsersSchema).findByIndex({username: `schemey`})).toEqual({username: `schemey`})
    // the sub handle is cached per schema class,
    // so env.sub(SchemaClass) resolves to the same handle
    expect(env.sub(UsersSchema)).toBe(env.sub(UsersSchema))
    expect(env.sub(UsersSchema)).toBeDefined()
  })

  it(`rejects a schema whose name collides with another schema's dbName`, () => {
    expect(() => env.register(CollidingSchema)).toThrow(LmdbError)
  })
})

describe(`schema multi-key queries`, () => {
  it(`AND-filters candidates across two index columns`, async () => {
    await env.sub(MultiAndSchema).put(1, {city: `jakarta`, active: true})
    await env.sub(MultiAndSchema).put(2, {city: `jakarta`, active: false})
    await env.sub(MultiAndSchema).put(3, {city: `bandung`, active: true})
    const hits = await env.sub(MultiAndSchema).findByIndex({city: `jakarta`, active: true})
    expect(hits).toEqual([{city: `jakarta`, active: true}])
    // contradictory keys → empty result, not an error
    expect(await env.sub(MultiAndSchema).findByIndex({city: `jakarta`, active: false})).toEqual([{city: `jakarta`, active: false}])
    expect(await env.sub(MultiAndSchema).findByIndex({city: `surabaya`, active: true})).toEqual([])
  })
})

describe(`schema reindex`, () => {
  it(`reindex(name) rebuilds the index and keeps findByIndex working`, async () => {
    await env.sub(ReindexSchema).put(1, {username: `a`})
    await env.sub(ReindexSchema).put(2, {username: `b`})
    const res = await env.sub(ReindexSchema).reindex(`username`)
    expect(res).toEqual({built: 2, skipped: []})
    expect(await env.sub(ReindexSchema).findByIndex({username: `a`})).toEqual([{username: `a`}])
    expect(await env.sub(ReindexSchema).findByIndex({username: `b`})).toEqual([{username: `b`}])
  })
})

describe(`schema write/read hooks`, () => {
  it(`requires hookBeforeWrite and hookBeforeRead to be declared together`, () => {
    expect(() => env.register(EncodeOnlySchema)).toThrow(LmdbError)
    expect(() => env.register(DecodeOnlySchema)).toThrow(LmdbError)
  })

  it(`roundtrips rows through a declared write/read hook pair`, async () => {
    const when = new Date(`2025-01-01T00:00:00.000Z`)
    await env.sub(CodedSchema).put(1, {at: when})
    expect(env.sub(CodedSchema).get(1)).toEqual({at: when})
    expect(env.sub(CodedSchema).get(1)?.at).toBeInstanceOf(Date)
    // stored form is the write-hook shape — a plain ms number, not a Date
    const stored = await env.getDb(`coded`).get(1)
    expect(stored).toEqual({at: when.getTime()})
  })
})

describe(`schema generic value types`, () => {
  it(`ValueOf narrows t.object<T> and t.array<T> element types`, () => {
    type Row = ValueOf<typeof GenericValueSchema>
    const row: Row = {profile: {bio: `x`, age: 1}, tags: [`a`, `b`]}
    // positive: `profile` is the narrowed object type, `tags` is `string[]`
    const profile: {bio: string; age: number} | undefined = row.profile
    const tags: string[] | undefined = row.tags
    void profile
    void tags
    // @ts-expect-error `profile.bio` is string, not number
    const badProfile: Row = {...row, profile: {bio: 123, age: 1}}
    void badProfile
    // @ts-expect-error `tags` elements are strings, not numbers
    const badTags: Row = {...row, tags: [1, 2]}
    void badTags
  })
})
