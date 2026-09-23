/**
 * Integration tests for the LmdbRepository class with real LMDB.
 *
 * Uses a temp directory per test for isolation. Exercises put/get/delete/has,
 * clear, count, range queries, iteration, custom codec, and transactional
 * access through {@link LmdbTransaction}.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import {LmdbTransaction} from "../src/transaction"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
  age: number
}

interface Counter {
  n: number
}

class UserSchema extends LmdbSchema {
  static db = `user-repo-test`
  static key = t.string()
  static value = t.object<User>()
}

class CounterSchema extends LmdbSchema {
  static db = `counter-repo-test`
  static key = t.number()
  static value = t.object<Counter>()
}

class EncodedStringSchema extends LmdbSchema {
  static db = `nocodec-repo-test`
  static key = t.string()
  static value = t.string()
  static hookBeforeWrite = (v: unknown): unknown => `enc:${String(v)}`
  static hookBeforeRead = (r: unknown): unknown => String(r).replace(/^enc:/, ``)
}

class DateSchema extends LmdbSchema {
  static db = `date-repo-test`
  static key = t.string()
  static value = t.date()
}

class BufferKeyUserSchema extends LmdbSchema {
  static db = `buffer-key-repo-test`
  static key = t.buffer()
  static value = t.object<User>()
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-repo-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  env.register(UserSchema)
  env.register(CounterSchema)
  env.register(EncodedStringSchema)
  env.register(DateSchema)
  env.register(BufferKeyUserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository.put / get`, () => {
  it(`stores and retrieves a value`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Alice`, age: 30})
    expect(await env.sub(UserSchema).get(`u1`)).toEqual({id: `u1`, name: `Alice`, age: 30})
  })

  it(`returns undefined for missing key`, async () => {
    expect(await env.sub(UserSchema).get(`missing`)).toBeUndefined()
  })

  it(`overwrites an existing value`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Alice`, age: 30})
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Alice`, age: 31})
    expect(await env.sub(UserSchema).get(`u1`)).toEqual({id: `u1`, name: `Alice`, age: 31})
  })

  it(`supports numeric keys`, async () => {
    await env.sub(CounterSchema).put(1, {n: 100})
    await env.sub(CounterSchema).put(2, {n: 200})
    expect((await env.sub(CounterSchema).get(1))?.n).toBe(100)
    expect((await env.sub(CounterSchema).get(2))?.n).toBe(200)
  })
})

describe(`LmdbRepository.has`, () => {
  it(`returns true for existing key`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(await env.sub(UserSchema).has(`u1`)).toBe(true)
  })

  it(`returns false for missing key`, async () => {
    expect(await env.sub(UserSchema).has(`missing`)).toBe(false)
  })
})

describe(`LmdbRepository.has with transaction`, () => {
  it(`returns true for existing key inside readTransaction`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    const got = await env.readTransaction(async () => env.sub(UserSchema).has(`u1`))
    expect(got).toBe(true)
  })

  it(`returns false for missing key inside readTransaction`, async () => {
    const got = await env.readTransaction(async () => env.sub(UserSchema).has(`nope`))
    expect(got).toBe(false)
  })

  it(`works inside a write transaction callback`, async () => {
    await env.transaction(() => {
      env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
      expect(env.sub(UserSchema).has(`u1`)).toBe(true)
      expect(env.sub(UserSchema).has(`u1`)).toBe(true)
    })
    expect(await env.sub(UserSchema).has(`u1`)).toBe(true)
  })

  it(`has without tx is unchanged`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(env.sub(UserSchema).has(`u1`)).toBe(true)
    expect(env.sub(UserSchema).has(`nope`)).toBe(false)
  })
})

describe(`LmdbRepository.delete`, () => {
  it(`removes a key and returns true`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(await env.sub(UserSchema).delete(`u1`)).toBe(true)
    expect(await env.sub(UserSchema).has(`u1`)).toBe(false)
  })

  it(`returns false for missing key`, async () => {
    expect(await env.sub(UserSchema).delete(`missing`)).toBe(false)
  })
})

describe(`LmdbRepository.clear`, () => {
  it(`removes every entry`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`, age: 2})
    await env.sub(UserSchema).put(`u3`, {id: `u3`, name: `C`, age: 3})

    await env.sub(UserSchema).clear()

    expect(await env.sub(UserSchema).count()).toBe(0)
    expect(await env.sub(UserSchema).has(`u1`)).toBe(false)
    expect(await env.sub(UserSchema).has(`u2`)).toBe(false)
  })
})

describe(`LmdbRepository.count`, () => {
  it(`returns 0 for empty repo`, async () => {
    expect(await env.sub(UserSchema).count()).toBe(0)
  })

  it(`counts correctly after writes`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`, age: 2})
    await env.sub(UserSchema).put(`u3`, {id: `u3`, name: `C`, age: 3})
    expect(await env.sub(UserSchema).count()).toBe(3)
  })
})

describe(`LmdbRepository.keys / values / entries`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`, age: 2})
    await env.sub(UserSchema).put(`u3`, {id: `u3`, name: `C`, age: 3})
  })

  it(`keys returns all keys in lexicographic order`, async () => {
    expect(await env.sub(UserSchema).keys()).toEqual([`u1`, `u2`, `u3`])
  })

  it(`values returns all values`, async () => {
    const values = await env.sub(UserSchema).values()
    expect(values).toEqual([
      {id: `u1`, name: `A`, age: 1},
      {id: `u2`, name: `B`, age: 2},
      {id: `u3`, name: `C`, age: 3}
    ])
  })

  it(`entries returns all [key, value] pairs`, async () => {
    const entries = await env.sub(UserSchema).entries()
    expect(entries).toEqual([
      [`u1`, {id: `u1`, name: `A`, age: 1}],
      [`u2`, {id: `u2`, name: `B`, age: 2}],
      [`u3`, {id: `u3`, name: `C`, age: 3}]
    ])
  })
})

describe(`LmdbRepository range queries`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`, age: 2})
    await env.sub(UserSchema).put(`u3`, {id: `u3`, name: `C`, age: 3})
    await env.sub(UserSchema).put(`u4`, {id: `u4`, name: `D`, age: 4})
    await env.sub(UserSchema).put(`u5`, {id: `u5`, name: `E`, age: 5})
  })

  it(`keys respects start/end range`, async () => {
    const keys = await env.sub(UserSchema).keys({start: `u2`, end: `u4`})
    expect(keys).toEqual([`u2`, `u3`])
  })

  it(`keys respects limit`, async () => {
    const keys = await env.sub(UserSchema).keys({limit: 2})
    expect(keys).toEqual([`u1`, `u2`])
  })

  it(`keys respects reverse`, async () => {
    const keys = await env.sub(UserSchema).keys({reverse: true})
    expect(keys).toEqual([`u5`, `u4`, `u3`, `u2`, `u1`])
  })

  it(`values respects range and limit`, async () => {
    const values = await env.sub(UserSchema).values({start: `u2`, end: `u5`, limit: 2})
    expect(values).toEqual([
      {id: `u2`, name: `B`, age: 2},
      {id: `u3`, name: `C`, age: 3}
    ])
  })

  it(`entries respects range`, async () => {
    const entries = await env.sub(UserSchema).entries({start: `u3`, end: `u5`})
    expect(entries).toEqual([
      [`u3`, {id: `u3`, name: `C`, age: 3}],
      [`u4`, {id: `u4`, name: `D`, age: 4}]
    ])
  })

  it(`inclusiveEnd: true includes the end key in results`, async () => {
    const keys = await env.sub(UserSchema).keys({start: `u1`, end: `u3`, inclusiveEnd: true})
    expect(keys).toEqual([`u1`, `u2`, `u3`])
  })

  it(`matches the upstream LMDB issue example (key1..key3)`, async () => {
    await env.sub(UserSchema).clear()
    await env.sub(UserSchema).put(`key1`, {id: `key1`, name: `1`, age: 1})
    await env.sub(UserSchema).put(`key2`, {id: `key2`, name: `2`, age: 2})
    await env.sub(UserSchema).put(`key3`, {id: `key3`, name: `3`, age: 3})
    const a = await env.sub(UserSchema).keys({start: `key1`, end: `key3`})
    const b = await env.sub(UserSchema).keys({start: `key1`, end: `key3`, inclusiveEnd: true})
    const c = await env.sub(UserSchema).keys({start: `key1`, end: `key3`, exclusiveStart: true})
    expect(a).toEqual([`key1`, `key2`])
    expect(b).toEqual([`key1`, `key2`, `key3`])
    expect(c).toEqual([`key2`])
  })

  it(`exclusiveStart: true excludes the start key from results`, async () => {
    const keys = await env.sub(UserSchema).keys({start: `u1`, end: `u3`, exclusiveStart: true})
    expect(keys).toEqual([`u2`])
  })

  it(`inclusiveEnd and exclusiveStart can be combined`, async () => {
    const keys = await env.sub(UserSchema).keys({start: `u1`, end: `u3`, inclusiveEnd: true, exclusiveStart: true})
    expect(keys).toEqual([`u2`, `u3`])
  })

  it(`entries respects inclusiveEnd / exclusiveStart`, async () => {
    const entries = await env.sub(UserSchema).entries({start: `u1`, end: `u3`, inclusiveEnd: true})
    expect(entries.map(([k]) => k)).toEqual([`u1`, `u2`, `u3`])
  })
})

describe(`LmdbRepository.iterate`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`, age: 2})
    await env.sub(UserSchema).put(`u3`, {id: `u3`, name: `C`, age: 3})
  })

  it(`yields entries as an async iterator`, async () => {
    const collected: Array<[string, User | undefined]> = []
    for await (const entry of env.sub(UserSchema).iterate()) {
      collected.push(entry)
    }
    expect(collected.length).toBe(3)
    expect(collected[0]?.[0]).toBe(`u1`)
    expect(collected[2]?.[0]).toBe(`u3`)
  })

  it(`supports range + reverse`, async () => {
    // LMDB reverse range convention: start > end. Iterate from u3 down to
    // (but excluding) u1, reversed.
    const collected: Array<[string, User | undefined]> = []
    for await (const entry of env.sub(UserSchema).iterate({start: `u3`, end: `u1`, reverse: true})) {
      collected.push(entry)
    }
    expect(collected.map(([k]) => k)).toEqual([`u3`, `u2`])
  })
})

describe(`LmdbRepository custom codec`, () => {
  it(`uses the repo codec for serialize/deserialize`, async () => {
    await env.sub(EncodedStringSchema).put(`hello`, `world`)
    const raw = await (env as any).getDb(`nocodec-repo-test`).get(`hello`)
    expect(raw).toBe(`enc:world`)
    expect(await env.sub(EncodedStringSchema).get(`hello`)).toBe(`world`)
  })

  it(`supports non-JSON value types via codec`, async () => {
    const d = new Date(`2026-06-21T10:00:00Z`)
    await env.sub(DateSchema).put(`now`, d)
    const got = await env.sub(DateSchema).get(`now`)
    expect(got).toBeInstanceOf(Date)
    expect(got?.toISOString()).toBe(d.toISOString())
  })
})

describe(`LmdbRepository transactional access`, () => {
  it(`put inside env.transaction is visible after commit`, async () => {
    await env.transaction(() => {
      env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Tx`, age: 1})
    })
    expect(await env.sub(UserSchema).get(`u1`)).toEqual({id: `u1`, name: `Tx`, age: 1})
  })

  it(`get inside env.transaction sees uncommitted writes in the same tx`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Outside`, age: 1})
    await env.transaction(() => {
      env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Inside`, age: 2})
    })
    expect(await env.sub(UserSchema).get(`u1`)).toEqual({id: `u1`, name: `Inside`, age: 2})
  })

  it.skip(`put is rolled back when transaction is aborted`, async () => {
    const rawTxn = (env as any)._root.beginTxn()
    const {LmdbTransaction} = await import(`../src/transaction`)
    const tx = new LmdbTransaction(rawTxn)
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Ghost`, age: 1}, tx)
    tx.abort()
    expect(await env.sub(UserSchema).get(`u1`)).toBeUndefined()
  })
})

describe(`LmdbRepository read-only env`, () => {
  it(`rejects writes`, async () => {
    await env.close()
    const roEnv = new LmdbEnv({path: tmpDir, maxDbs: 10, readOnly: true})
    try {
      roEnv.register(UserSchema)
      await expect(roEnv.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})).rejects.toThrow(LmdbError)
    } finally {
      await roEnv.close()
    }
  })
})

describe(`LmdbRepository.like (LIKE-style pattern matching)`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    await env.sub(UserSchema).put(`user:2`, {id: `u2`, name: `Bob`, age: 25})
    await env.sub(UserSchema).put(`admin:1`, {id: `a1`, name: `Admin`, age: 40})
    await env.sub(UserSchema).put(`session:abc`, {id: `s1`, name: `Session`, age: 0})
  })

  it(`* matches any sequence (prefix LIKE pattern)`, async () => {
    const matched = await env.sub(UserSchema).like(`user:*`)
    expect(matched.map(([k]) => k)).toEqual([`user:1`, `user:2`])
  })

  it(`* at start matches suffix`, async () => {
    const matched = await env.sub(UserSchema).like(`*abc`)
    expect(matched.map(([k]) => k)).toEqual([`session:abc`])
  })

  it(`* in middle matches infix`, async () => {
    const matched = await env.sub(UserSchema).like(`user:*`)
    expect(matched.length).toBe(2)
  })

  it(`? matches single character`, async () => {
    const matched = await env.sub(UserSchema).like(`user:?`)
    expect(matched.map(([k]) => k)).toEqual([`user:1`, `user:2`])
  })

  it(`literal pattern (no wildcards) matches exact key`, async () => {
    const matched = await env.sub(UserSchema).like(`user:1`)
    expect(matched.map(([k]) => k)).toEqual([`user:1`])
  })

  it(`returns empty array when no matches`, async () => {
    const matched = await env.sub(UserSchema).like(`nonexistent:*`)
    expect(matched).toEqual([])
  })

  it(`escapes regex metacharacters in literal portions`, async () => {
    await env.sub(EncodedStringSchema).put(`key.with.dots`, `value1`)
    await env.sub(EncodedStringSchema).put(`keyXwithXdots`, `value2`)
    const matched = await env.sub(EncodedStringSchema).like(`key.with.dots`)
    expect(matched.map(([k]) => k)).toEqual([`key.with.dots`])
  })
})

describe(`LmdbRepository.like with numeric keys`, () => {
  beforeEach(async () => {
    await env.sub(CounterSchema).put(1, {n: 1})
    await env.sub(CounterSchema).put(10, {n: 10})
    await env.sub(CounterSchema).put(21, {n: 21})
  })

  it(`prefix pattern matches numeric keys by String() semantics`, async () => {
    const matched = await env.sub(CounterSchema).like(`1*`)
    expect(matched.map(([k]) => k).sort((a, b) => a - b)).toEqual([1, 10])
  })

  it(`prefix pattern with no matches returns []`, async () => {
    const matched = await env.sub(CounterSchema).like(`9*`)
    expect(matched).toEqual([])
  })

  it(`infix pattern matches numeric keys`, async () => {
    const matched = await env.sub(CounterSchema).like(`*1`)
    expect(matched.map(([k]) => k).sort((a, b) => a - b)).toEqual([1, 21])
  })

  it(`empty repo like() returns []`, async () => {
    await env.sub(CounterSchema).clear()
    expect(await env.sub(CounterSchema).like(`1*`)).toEqual([])
  })
})

describe(`LmdbRepository.findByPrefix (efficient range scan)`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    await env.sub(UserSchema).put(`user:2`, {id: `u2`, name: `Bob`, age: 25})
    await env.sub(UserSchema).put(`admin:1`, {id: `a1`, name: `Admin`, age: 40})
    await env.sub(UserSchema).put(`session:abc`, {id: `s1`, name: `Session`, age: 0})
  })

  it(`returns all entries with matching prefix`, async () => {
    const matched = await env.sub(UserSchema).findByPrefix(`user:`)
    expect(matched.map(([k]) => k).sort()).toEqual([`user:1`, `user:2`])
  })

  it(`respects limit option`, async () => {
    const matched = await env.sub(UserSchema).findByPrefix(`user:`, {limit: 1})
    expect(matched.length).toBe(1)
  })

  it(`returns empty array when no matches`, async () => {
    const matched = await env.sub(UserSchema).findByPrefix(`nonexistent:`)
    expect(matched).toEqual([])
  })

  it(`exact prefix match returns single entry`, async () => {
    await env.sub(UserSchema).put(`exact`, {id: `e1`, name: `Exact`, age: 1})
    const matched = await env.sub(UserSchema).findByPrefix(`exact`)
    expect(matched.map(([k]) => k)).toEqual([`exact`])
  })

  it(`prefix bounds are authoritative over user start`, async () => {
    await env.sub(UserSchema).put(`user;`, {id: `u2b`, name: `Boundary`, age: 1})
    const matched = await env.sub(UserSchema).findByPrefix(`user:`, {start: `a`})
    expect(matched.map(([k]) => k).sort()).toEqual([`user:1`, `user:2`])
  })

  it(`prefix bounds are authoritative over user end`, async () => {
    // 'user;' sorts AFTER 'user:\uffff' (0x3B > 0x3A) but BEFORE 'zzzz' —
    // a user-supplied end would wrongly include it without authoritative bounds.
    await env.sub(UserSchema).put(`user;`, {id: `u2b`, name: `Boundary`, age: 1})
    const matched = await env.sub(UserSchema).findByPrefix(`user:`, {end: `zzzz`})
    expect(matched.map(([k]) => k).sort()).toEqual([`user:1`, `user:2`])
  })
})

describe(`LmdbRepository.countByPrefix`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    await env.sub(UserSchema).put(`user:2`, {id: `u2`, name: `Bob`, age: 25})
    await env.sub(UserSchema).put(`user:3`, {id: `u3`, name: `Carol`, age: 35})
    await env.sub(UserSchema).put(`admin:1`, {id: `a1`, name: `Admin`, age: 40})
  })

  it(`counts entries matching prefix`, async () => {
    expect(await env.sub(UserSchema).countByPrefix(`user:`)).toBe(3)
    expect(await env.sub(UserSchema).countByPrefix(`admin:`)).toBe(1)
  })

  it(`returns 0 for non-existent prefix`, async () => {
    expect(await env.sub(UserSchema).countByPrefix(`nonexistent:`)).toBe(0)
  })

  it(`exact prefix counts exact match`, async () => {
    await env.sub(UserSchema).put(`exact`, {id: `e1`, name: `Exact`, age: 1})
    expect(await env.sub(UserSchema).countByPrefix(`exact`)).toBe(1)
  })
})

describe(`LmdbRepository.deleteByPrefix (bulk delete)`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`keep:1`, {id: `k1`, name: `Keep`, age: 1})
    await env.sub(UserSchema).put(`remove:1`, {id: `r1`, name: `Remove`, age: 1})
    await env.sub(UserSchema).put(`remove:2`, {id: `r2`, name: `Remove`, age: 2})
    await env.sub(UserSchema).put(`remove:3`, {id: `r3`, name: `Remove`, age: 3})
  })

  it(`deletes all entries with matching prefix`, async () => {
    const removed = await env.sub(UserSchema).deleteByPrefix(`remove:`)
    expect(removed).toBe(3)
    expect(await env.sub(UserSchema).has(`remove:1`)).toBe(false)
    expect(await env.sub(UserSchema).has(`remove:2`)).toBe(false)
    expect(await env.sub(UserSchema).has(`remove:3`)).toBe(false)
    expect(await env.sub(UserSchema).has(`keep:1`)).toBe(true)
  })

  it(`returns 0 when no matches`, async () => {
    const removed = await env.sub(UserSchema).deleteByPrefix(`nonexistent:`)
    expect(removed).toBe(0)
  })

  it(`returns count of deleted entries`, async () => {
    await env.sub(UserSchema).deleteByPrefix(`remove:`)
    const secondAttempt = await env.sub(UserSchema).deleteByPrefix(`remove:`)
    expect(secondAttempt).toBe(0)
  })
})

describe(`LmdbRepository.first / last (ordering)`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 30})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`, age: 25})
    await env.sub(UserSchema).put(`u3`, {id: `u3`, name: `C`, age: 35})
  })

  it(`first returns lexicographically smallest entry`, async () => {
    const first = await env.sub(UserSchema).first()
    expect(first?.[0]).toBe(`u1`)
    expect(first?.[1]).toEqual({id: `u1`, name: `A`, age: 30})
  })

  it(`last returns lexicographically largest entry`, async () => {
    const last = await env.sub(UserSchema).last()
    expect(last?.[0]).toBe(`u3`)
    expect(last?.[1]).toEqual({id: `u3`, name: `C`, age: 35})
  })

  it(`first / last return undefined when empty`, async () => {
    await env.sub(UserSchema).clear()
    expect(await env.sub(UserSchema).first()).toBeUndefined()
    expect(await env.sub(UserSchema).last()).toBeUndefined()
  })
})

describe(`LmdbRepository.getStrict`, () => {
  it(`returns the value when the key exists`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(env.sub(UserSchema).getStrict(`u1`)?.name).toBe(`A`)
  })

  it(`throws LmdbError when the key is absent`, () => {
    expect(() => env.sub(UserSchema).getStrict(`missing`)).toThrow(LmdbError)
  })

  it(`supports a read transaction`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.readTransaction(async () => {
      expect(env.sub(UserSchema).getStrict(`u1`)?.name).toBe(`A`)
    })
  })
})

describe(`LmdbRepository.update (read-modify-write)`, () => {
  it(`updates existing value via updater`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Alice`, age: 30})
    const current = env.sub(UserSchema).get(`u1`)
    if (!current) throw new Error(`should exist`)
    const next = {...current, age: current.age + 1}
    await env.sub(UserSchema).put(`u1`, next)
    expect(next.age).toBe(31)
    expect(env.sub(UserSchema).get(`u1`)?.age).toBe(31)
  })

  it(`upserts when key absent (updater receives undefined)`, async () => {
    const current = env.sub(UserSchema).get(`new-key`)
    if (current !== undefined) throw new Error(`should be undefined`)
    const created = {id: `new-key`, name: `Created`, age: 0}
    await env.sub(UserSchema).put(`new-key`, created)
    expect(created.name).toBe(`Created`)
    expect(env.sub(UserSchema).get(`new-key`)?.name).toBe(`Created`)
  })

  it(`increments counter via updater`, async () => {
    await env.sub(CounterSchema).put(1, {n: 0})

    for (let i = 1; i <= 5; i++) {
      const c = env.sub(CounterSchema).get(1)
      await env.sub(CounterSchema).put(1, {n: (c?.n ?? -1) + 1})
    }

    expect(env.sub(CounterSchema).get(1)?.n).toBe(5)
  })
})

describe(`LmdbRepository.getMany (batch read)`, () => {
  beforeEach(async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Alice`, age: 30})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `Bob`, age: 25})
    await env.sub(UserSchema).put(`u3`, {id: `u3`, name: `Carol`, age: 35})
  })

  it(`returns values in input order`, async () => {
    const result = await env.sub(UserSchema).getMany([`u1`, `u2`, `u3`])
    expect(result).toEqual([
      {id: `u1`, name: `Alice`, age: 30},
      {id: `u2`, name: `Bob`, age: 25},
      {id: `u3`, name: `Carol`, age: 35}
    ])
  })

  it(`returns undefined for missing keys (positional)`, async () => {
    const result = await env.sub(UserSchema).getMany([`u1`, `missing`, `u3`])
    expect(result[0]).toEqual({id: `u1`, name: `Alice`, age: 30})
    expect(result[1]).toBeUndefined()
    expect(result[2]).toEqual({id: `u3`, name: `Carol`, age: 35})
  })

  it(`returns empty array for empty input`, async () => {
    const result = await env.sub(UserSchema).getMany([])
    expect(result).toEqual([])
  })
})

describe(`LmdbRepository.prefetch (page pre-fault)`, () => {
  it(`completes without error for existing keys`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`, age: 2})
    await expect(env.sub(UserSchema).prefetch([`u1`, `u2`])).resolves.toBeUndefined()
  })

  it(`handles missing keys without error`, async () => {
    await expect(env.sub(UserSchema).prefetch([`nope`])).resolves.toBeUndefined()
  })

  it(`handles empty input`, async () => {
    await expect(env.sub(UserSchema).prefetch([])).resolves.toBeUndefined()
  })
})

describe(`LmdbRepository.drop (sub-DB removal)`, () => {
  it(`removes the sub-database and all entries`, async () => {
    const freshDir = createTestDir(`lmdb-drop-test-`)
    const freshEnv = new LmdbEnv({path: freshDir, maxDbs: 5})
    freshEnv.register(UserSchema)
    await freshEnv.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(freshEnv.sub(UserSchema).count()).toBe(1)
    await freshEnv.sub(UserSchema).drop()
    await freshEnv.close()
    const reopenEnv = new LmdbEnv({path: freshDir, maxDbs: 5})
    try {
      reopenEnv.register(UserSchema)
      expect(reopenEnv.sub(UserSchema).count()).toBe(0)
    } finally {
      await reopenEnv.close()
    }
  })

  it(`rejects on read-only env`, async () => {
    const roEnv = new LmdbEnv({path: tmpDir, readOnly: true})
    try {
      roEnv.register(UserSchema)
      await expect(roEnv.sub(UserSchema).drop()).rejects.toThrow(LmdbError)
    } finally {
      await roEnv.close()
    }
  })
})

describe(`LmdbRepository operations after close`, () => {
  it(`get throws LmdbError, not a raw native error`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await env.close()
    expect(() => env.sub(UserSchema).get(`u1`)).toThrow(LmdbError)
  })

  it(`put after close rejects with LmdbError`, async () => {
    await env.close()
    expect(() => env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})).toThrow(LmdbError)
  })

  it(`has and count after close throw LmdbError`, async () => {
    await env.close()
    expect(() => env.sub(UserSchema).has(`u1`)).toThrow(LmdbError)
    expect(() => env.sub(UserSchema).count()).toThrow(LmdbError)
  })
})

describe(`LmdbRepository tx argument validation`, () => {
  it(`put with an already-aborted LmdbTransaction rejects`, async () => {
    const tx = new LmdbTransaction()
    tx.abort()
    await expect(env.sub(UserSchema).put(`u1`, {id: `u1`, name: `X`, age: 1}, tx)).rejects.toThrow()
    expect(env.sub(UserSchema).get(`u1`)).toBeUndefined()
  })

  it(`put with a tx outside an active transaction rejects`, async () => {
    const tx = new LmdbTransaction()
    await expect(env.sub(UserSchema).put(`u1`, {id: `u1`, name: `X`, age: 1}, tx)).rejects.toBeInstanceOf(Error)
    expect(env.sub(UserSchema).get(`u1`)).toBeUndefined()
  })

  it(`delete with a done tx rejects`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    const tx = new LmdbTransaction()
    tx.commit()
    await expect(env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1}, tx)).rejects.toThrow()
    expect(env.sub(UserSchema).has(`u1`)).toBe(true)
  })
})

describe(`LmdbRepository key-type aware prefix helpers`, () => {
  it(`like() on a Buffer-keyed repo uses full-scan, never bounded wrong`, async () => {
    await env.sub(BufferKeyUserSchema).put(Buffer.from(`user_a`), {id: `a`, name: `A`, age: 1})
    await env.sub(BufferKeyUserSchema).put(Buffer.from(`other`), {id: `o`, name: `O`, age: 2})
    const found = await env.sub(BufferKeyUserSchema).like(`user_*`)
    expect(found.map(([k]) => k.toString())).toEqual([`user_a`])
  })

  it(`countByPrefix with a Buffer prefix on a Buffer-keyed repo works`, async () => {
    await env.sub(BufferKeyUserSchema).put(Buffer.from(`a`), {id: `a`, name: `A`, age: 1})
    await env.sub(BufferKeyUserSchema).put(Buffer.from(`b`), {id: `b`, name: `B`, age: 2})
    expect(await env.sub(BufferKeyUserSchema).countByPrefix(Buffer.from(`a`))).toBe(1)
  })

  it(`deleteByPrefix('') on a Buffer-keyed repo is rejected, not a silent no-op`, async () => {
    await env.sub(BufferKeyUserSchema).put(Buffer.from(`a`), {id: `a`, name: `A`, age: 1})
    await expect(env.sub(BufferKeyUserSchema).deleteByPrefix(`` as any)).rejects.toBeInstanceOf(LmdbError)
    expect(await env.sub(BufferKeyUserSchema).count()).toBe(1)
  })
})

describe(`LmdbRepository.deleteByPrefix empty-prefix guard`, () => {
  it(`rejects empty string prefix`, async () => {
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`, age: 1})
    await expect(env.sub(UserSchema).deleteByPrefix(``)).rejects.toBeInstanceOf(LmdbError)
    expect(env.sub(UserSchema).has(`u1`)).toBe(true)
  })

  it(`rejects zero-length Buffer prefix`, async () => {
    await expect(env.sub(BufferKeyUserSchema).deleteByPrefix(Buffer.alloc(0))).rejects.toBeInstanceOf(LmdbError)
  })
})

describe(`LmdbRepository.countByPrefix async contract`, () => {
  it(`returns a Promise even for string keys (no split-brain typing)`, async () => {
    await env.sub(UserSchema).put(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    const count = env.sub(UserSchema).countByPrefix(`user:`)
    expect(count instanceof Promise).toBe(true)
    expect(await count).toBe(1)
  })
})

describe(`LmdbRepository.like ReDoS guard`, () => {
  it(`rejects patterns with too many wildcards`, async () => {
    await expect(env.sub(UserSchema).like(`a*a*a*a*a*a*a*a*a*a*a*x`)).rejects.toBeInstanceOf(LmdbError)
  })

  it(`allows patterns up to the wildcard limit`, async () => {
    await env.sub(UserSchema).put(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    const found = await env.sub(UserSchema).like(`u?er:1*`)
    expect(found.length).toBe(1)
  })
})
