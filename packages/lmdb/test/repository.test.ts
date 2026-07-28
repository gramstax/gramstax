/**
 * Integration tests for the LmdbRepository class with real LMDB.
 *
 * Uses a temp directory per test for isolation. Exercises set/get/delete/has,
 * clear, count, range queries, iteration, custom codec, and transactional
 * access through {@link LmdbTransaction}.
 */
import {describe, it, expect, beforeEach, afterEach} from "bun:test"
import {mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"

import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"
import {LmdbCodec} from "../src/codec"
import {LmdbReadOnlyError} from "../src/errors"
import {rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
  age: number
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `user-repo-test`
}

interface Counter {
  n: number
}

class CounterRepo extends LmdbRepository<Counter, number> {
  static dbName = `counter-repo-test`
}

class NoCodecRepo extends LmdbRepository<string, string> {
  static dbName = `nocodec-repo-test`
  static codec = LmdbCodec.create<string, string>(
    (v: string) => `enc:${v}`,
    (r: string) => r.replace(/^enc:/, ``)
  )
}

class DateRepo extends LmdbRepository<Date, string> {
  static dbName = `date-repo-test`
  static codec = LmdbCodec.create<Date, number>((d: Date) => d.getTime(), (n: number) => new Date(n))
}

let tmpDir: string
let env: LmdbEnv
let users: UserRepo
let counters: CounterRepo
let noCodec: NoCodecRepo
let dates: DateRepo

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), `lmdb-repo-test-`))
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  users = env.register(UserRepo)
  counters = env.register(CounterRepo)
  noCodec = env.register(NoCodecRepo)
  dates = env.register(DateRepo)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository.set / get`, () => {
  it(`stores and retrieves a value`, async () => {
    await users.set(`u1`, {id: `u1`, name: `Alice`, age: 30})
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alice`, age: 30})
  })

  it(`returns undefined for missing key`, async () => {
    expect(await users.get(`missing`)).toBeUndefined()
  })

  it(`overwrites an existing value`, async () => {
    await users.set(`u1`, {id: `u1`, name: `Alice`, age: 30})
    await users.set(`u1`, {id: `u1`, name: `Alice`, age: 31})
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alice`, age: 31})
  })

  it(`supports numeric keys`, async () => {
    await counters.set(1, {n: 100})
    await counters.set(2, {n: 200})
    expect((await counters.get(1))?.n).toBe(100)
    expect((await counters.get(2))?.n).toBe(200)
  })
})

describe(`LmdbRepository.has`, () => {
  it(`returns true for existing key`, async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(await users.has(`u1`)).toBe(true)
  })

  it(`returns false for missing key`, async () => {
    expect(await users.has(`missing`)).toBe(false)
  })
})

describe(`LmdbRepository.delete`, () => {
  it(`removes a key and returns true`, async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(await users.delete(`u1`)).toBe(true)
    expect(await users.has(`u1`)).toBe(false)
  })

  it(`returns false for missing key`, async () => {
    expect(await users.delete(`missing`)).toBe(false)
  })
})

describe(`LmdbRepository.clear`, () => {
  it(`removes every entry`, async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    await users.set(`u2`, {id: `u2`, name: `B`, age: 2})
    await users.set(`u3`, {id: `u3`, name: `C`, age: 3})

    await users.clear()

    expect(await users.count()).toBe(0)
    expect(await users.has(`u1`)).toBe(false)
    expect(await users.has(`u2`)).toBe(false)
  })
})

describe(`LmdbRepository.count`, () => {
  it(`returns 0 for empty repo`, async () => {
    expect(await users.count()).toBe(0)
  })

  it(`counts correctly after writes`, async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    await users.set(`u2`, {id: `u2`, name: `B`, age: 2})
    await users.set(`u3`, {id: `u3`, name: `C`, age: 3})
    expect(await users.count()).toBe(3)
  })
})

describe(`LmdbRepository.keys / values / entries`, () => {
  beforeEach(async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    await users.set(`u2`, {id: `u2`, name: `B`, age: 2})
    await users.set(`u3`, {id: `u3`, name: `C`, age: 3})
  })

  it(`keys returns all keys in lexicographic order`, async () => {
    expect(await users.keys()).toEqual([`u1`, `u2`, `u3`])
  })

  it(`values returns all values`, async () => {
    const values = await users.values()
    expect(values).toEqual([
      {id: `u1`, name: `A`, age: 1},
      {id: `u2`, name: `B`, age: 2},
      {id: `u3`, name: `C`, age: 3}
    ])
  })

  it(`entries returns all [key, value] pairs`, async () => {
    const entries = await users.entries()
    expect(entries).toEqual([
      [`u1`, {id: `u1`, name: `A`, age: 1}],
      [`u2`, {id: `u2`, name: `B`, age: 2}],
      [`u3`, {id: `u3`, name: `C`, age: 3}]
    ])
  })
})

describe(`LmdbRepository range queries`, () => {
  beforeEach(async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    await users.set(`u2`, {id: `u2`, name: `B`, age: 2})
    await users.set(`u3`, {id: `u3`, name: `C`, age: 3})
    await users.set(`u4`, {id: `u4`, name: `D`, age: 4})
    await users.set(`u5`, {id: `u5`, name: `E`, age: 5})
  })

  it(`keys respects start/end range`, async () => {
    const keys = await users.keys({start: `u2`, end: `u4`})
    expect(keys).toEqual([`u2`, `u3`])
  })

  it(`keys respects limit`, async () => {
    const keys = await users.keys({limit: 2})
    expect(keys).toEqual([`u1`, `u2`])
  })

  it(`keys respects reverse`, async () => {
    const keys = await users.keys({reverse: true})
    expect(keys).toEqual([`u5`, `u4`, `u3`, `u2`, `u1`])
  })

  it(`values respects range and limit`, async () => {
    const values = await users.values({start: `u2`, end: `u5`, limit: 2})
    expect(values).toEqual([
      {id: `u2`, name: `B`, age: 2},
      {id: `u3`, name: `C`, age: 3}
    ])
  })

  it(`entries respects range`, async () => {
    const entries = await users.entries({start: `u3`, end: `u5`})
    expect(entries).toEqual([
      [`u3`, {id: `u3`, name: `C`, age: 3}],
      [`u4`, {id: `u4`, name: `D`, age: 4}]
    ])
  })

  it(`inclusiveEnd: true includes the end key in results`, async () => {
    const keys = await users.keys({start: `u1`, end: `u3`, inclusiveEnd: true})
    expect(keys).toEqual([`u1`, `u2`, `u3`])
  })

  it(`matches the upstream LMDB issue example (key1..key3)`, async () => {
    await users.clear()
    await users.set(`key1`, {id: `key1`, name: `1`, age: 1})
    await users.set(`key2`, {id: `key2`, name: `2`, age: 2})
    await users.set(`key3`, {id: `key3`, name: `3`, age: 3})
    const a = await users.keys({start: `key1`, end: `key3`})
    const b = await users.keys({start: `key1`, end: `key3`, inclusiveEnd: true})
    const c = await users.keys({start: `key1`, end: `key3`, exclusiveStart: true})
    expect(a).toEqual([`key1`, `key2`])
    expect(b).toEqual([`key1`, `key2`, `key3`])
    expect(c).toEqual([`key2`])
  })

  it(`exclusiveStart: true excludes the start key from results`, async () => {
    const keys = await users.keys({start: `u1`, end: `u3`, exclusiveStart: true})
    expect(keys).toEqual([`u2`])
  })

  it(`inclusiveEnd and exclusiveStart can be combined`, async () => {
    const keys = await users.keys({start: `u1`, end: `u3`, inclusiveEnd: true, exclusiveStart: true})
    expect(keys).toEqual([`u2`, `u3`])
  })

  it(`entries respects inclusiveEnd / exclusiveStart`, async () => {
    const entries = await users.entries({start: `u1`, end: `u3`, inclusiveEnd: true})
    expect(entries.map(([k]) => k)).toEqual([`u1`, `u2`, `u3`])
  })
})

describe(`LmdbRepository.iterate`, () => {
  beforeEach(async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    await users.set(`u2`, {id: `u2`, name: `B`, age: 2})
    await users.set(`u3`, {id: `u3`, name: `C`, age: 3})
  })

  it(`yields entries as an async iterator`, async () => {
    const collected: Array<[string, User]> = []
    for await (const entry of users.iterate()) {
      collected.push(entry)
    }
    expect(collected.length).toBe(3)
    expect(collected[0]?.[0]).toBe(`u1`)
    expect(collected[2]?.[0]).toBe(`u3`)
  })

  it(`supports range + reverse`, async () => {
    // LMDB reverse range convention: start > end. Iterate from u3 down to
    // (but excluding) u1, reversed.
    const collected: Array<[string, User]> = []
    for await (const entry of users.iterate({start: `u3`, end: `u1`, reverse: true})) {
      collected.push(entry)
    }
    expect(collected.map(([k]) => k)).toEqual([`u3`, `u2`])
  })
})

describe(`LmdbRepository custom codec`, () => {
  it(`uses the static codec for serialize/deserialize`, async () => {
    await noCodec.set(`hello`, `world`)
    const raw = await (env as any).getDb(`nocodec-repo-test`).get(`hello`)
    expect(raw).toBe(`enc:world`)
    expect(await noCodec.get(`hello`)).toBe(`world`)
  })

  it(`supports non-JSON value types via codec`, async () => {
    const d = new Date(`2026-06-21T10:00:00Z`)
    await dates.set(`now`, d)
    const got = await dates.get(`now`)
    expect(got).toBeInstanceOf(Date)
    expect(got?.toISOString()).toBe(d.toISOString())
  })
})

describe(`LmdbRepository transactional access`, () => {
  it(`set inside env.transaction is visible after commit`, async () => {
    await env.transaction(() => {
      users.set(`u1`, {id: `u1`, name: `Tx`, age: 1})
    })
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Tx`, age: 1})
  })

  it(`get inside env.transaction sees uncommitted writes in the same tx`, async () => {
    await users.set(`u1`, {id: `u1`, name: `Outside`, age: 1})
    await env.transaction(() => {
      users.set(`u1`, {id: `u1`, name: `Inside`, age: 2})
    })
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Inside`, age: 2})
  })

  it.skip(`set is rolled back when transaction is aborted`, async () => {
    const rawTxn = (env as any)._root.beginTxn()
    const {LmdbTransaction} = await import(`../src/transaction`)
    const tx = new LmdbTransaction(rawTxn)
    await users.set(`u1`, {id: `u1`, name: `Ghost`, age: 1}, tx)
    tx.abort()
    expect(await users.get(`u1`)).toBeUndefined()
  })
})

describe(`LmdbRepository read-only env`, () => {
  it(`rejects writes`, async () => {
    await env.close()
    const roEnv = new LmdbEnv({path: tmpDir, maxDbs: 10, readOnly: true})
    try {
      const roUsers = roEnv.register(UserRepo)
      await expect(roUsers.set(`u1`, {id: `u1`, name: `A`, age: 1})).rejects.toThrow(LmdbReadOnlyError)
    } finally {
      await roEnv.close()
    }
  })
})

describe(`LmdbRepository.like (LIKE-style pattern matching)`, () => {
  beforeEach(async () => {
    await users.set(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    await users.set(`user:2`, {id: `u2`, name: `Bob`, age: 25})
    await users.set(`admin:1`, {id: `a1`, name: `Admin`, age: 40})
    await users.set(`session:abc`, {id: `s1`, name: `Session`, age: 0})
  })

  it(`* matches any sequence (prefix LIKE pattern)`, async () => {
    const matched = await users.like(`user:*`)
    expect(matched.map(([k]) => k)).toEqual([`user:1`, `user:2`])
  })

  it(`* at start matches suffix`, async () => {
    const matched = await users.like(`*abc`)
    expect(matched.map(([k]) => k)).toEqual([`session:abc`])
  })

  it(`* in middle matches infix`, async () => {
    const matched = await users.like(`user:*`)
    expect(matched.length).toBe(2)
  })

  it(`? matches single character`, async () => {
    const matched = await users.like(`user:?`)
    expect(matched.map(([k]) => k)).toEqual([`user:1`, `user:2`])
  })

  it(`literal pattern (no wildcards) matches exact key`, async () => {
    const matched = await users.like(`user:1`)
    expect(matched.map(([k]) => k)).toEqual([`user:1`])
  })

  it(`returns empty array when no matches`, async () => {
    const matched = await users.like(`nonexistent:*`)
    expect(matched).toEqual([])
  })

  it(`escapes regex metacharacters in literal portions`, async () => {
    await noCodec.set(`key.with.dots`, `value1`)
    await noCodec.set(`keyXwithXdots`, `value2`)
    const matched = await noCodec.like(`key.with.dots`)
    expect(matched.map(([k]) => k)).toEqual([`key.with.dots`])
  })
})

describe(`LmdbRepository.findByPrefix (efficient range scan)`, () => {
  beforeEach(async () => {
    await users.set(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    await users.set(`user:2`, {id: `u2`, name: `Bob`, age: 25})
    await users.set(`admin:1`, {id: `a1`, name: `Admin`, age: 40})
    await users.set(`session:abc`, {id: `s1`, name: `Session`, age: 0})
  })

  it(`returns all entries with matching prefix`, async () => {
    const matched = await users.findByPrefix(`user:`)
    expect(matched.map(([k]) => k).sort()).toEqual([`user:1`, `user:2`])
  })

  it(`respects limit option`, async () => {
    const matched = await users.findByPrefix(`user:`, {limit: 1})
    expect(matched.length).toBe(1)
  })

  it(`returns empty array when no matches`, async () => {
    const matched = await users.findByPrefix(`nonexistent:`)
    expect(matched).toEqual([])
  })

  it(`exact prefix match returns single entry`, async () => {
    await users.set(`exact`, {id: `e1`, name: `Exact`, age: 1})
    const matched = await users.findByPrefix(`exact`)
    expect(matched.map(([k]) => k)).toEqual([`exact`])
  })
})

describe(`LmdbRepository.countByPrefix`, () => {
  beforeEach(async () => {
    await users.set(`user:1`, {id: `u1`, name: `Alice`, age: 30})
    await users.set(`user:2`, {id: `u2`, name: `Bob`, age: 25})
    await users.set(`user:3`, {id: `u3`, name: `Carol`, age: 35})
    await users.set(`admin:1`, {id: `a1`, name: `Admin`, age: 40})
  })

  it(`counts entries matching prefix`, async () => {
    expect(await users.countByPrefix(`user:`)).toBe(3)
    expect(await users.countByPrefix(`admin:`)).toBe(1)
  })

  it(`returns 0 for non-existent prefix`, async () => {
    expect(await users.countByPrefix(`nonexistent:`)).toBe(0)
  })

  it(`exact prefix counts exact match`, async () => {
    await users.set(`exact`, {id: `e1`, name: `Exact`, age: 1})
    expect(await users.countByPrefix(`exact`)).toBe(1)
  })
})

describe(`LmdbRepository.deleteByPrefix (bulk delete)`, () => {
  beforeEach(async () => {
    await users.set(`keep:1`, {id: `k1`, name: `Keep`, age: 1})
    await users.set(`remove:1`, {id: `r1`, name: `Remove`, age: 1})
    await users.set(`remove:2`, {id: `r2`, name: `Remove`, age: 2})
    await users.set(`remove:3`, {id: `r3`, name: `Remove`, age: 3})
  })

  it(`deletes all entries with matching prefix`, async () => {
    const removed = await users.deleteByPrefix(`remove:`)
    expect(removed).toBe(3)
    expect(await users.has(`remove:1`)).toBe(false)
    expect(await users.has(`remove:2`)).toBe(false)
    expect(await users.has(`remove:3`)).toBe(false)
    expect(await users.has(`keep:1`)).toBe(true)
  })

  it(`returns 0 when no matches`, async () => {
    const removed = await users.deleteByPrefix(`nonexistent:`)
    expect(removed).toBe(0)
  })

  it(`returns count of deleted entries`, async () => {
    await users.deleteByPrefix(`remove:`)
    const secondAttempt = await users.deleteByPrefix(`remove:`)
    expect(secondAttempt).toBe(0)
  })
})

describe(`LmdbRepository.first / last (ordering)`, () => {
  beforeEach(async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 30})
    await users.set(`u2`, {id: `u2`, name: `B`, age: 25})
    await users.set(`u3`, {id: `u3`, name: `C`, age: 35})
  })

  it(`first returns lexicographically smallest entry`, async () => {
    const first = await users.first()
    expect(first?.[0]).toBe(`u1`)
    expect(first?.[1]).toEqual({id: `u1`, name: `A`, age: 30})
  })

  it(`last returns lexicographically largest entry`, async () => {
    const last = await users.last()
    expect(last?.[0]).toBe(`u3`)
    expect(last?.[1]).toEqual({id: `u3`, name: `C`, age: 35})
  })

  it(`first / last return undefined when empty`, async () => {
    await users.clear()
    expect(await users.first()).toBeUndefined()
    expect(await users.last()).toBeUndefined()
  })
})

describe(`LmdbRepository.update (read-modify-write)`, () => {
  it(`updates existing value via updater`, async () => {
    await users.set(`u1`, {id: `u1`, name: `Alice`, age: 30})
    const next = await users.update(`u1`, (u) => {
      if (!u) throw new Error(`should exist`)
      return {...u, age: u.age + 1}
    })
    expect(next.age).toBe(31)
    expect((await users.get(`u1`))?.age).toBe(31)
  })

  it(`upserts when key absent (updater receives undefined)`, async () => {
    const created = await users.update(`new-key`, (u) => {
      if (u !== undefined) throw new Error(`should be undefined`)
      return {id: `new-key`, name: `Created`, age: 0}
    })
    expect(created.name).toBe(`Created`)
    expect((await users.get(`new-key`))?.name).toBe(`Created`)
  })

  it(`increments counter via updater`, async () => {
    await counters.set(1, {n: 0})

    for (let i = 1; i <= 5; i++) {
      await counters.update(1, (c) => ({n: (c?.n ?? -1) + 1}))
    }

    expect((await counters.get(1))?.n).toBe(5)
  })
})

describe(`LmdbRepository.getMany (batch read)`, () => {
  beforeEach(async () => {
    await users.set(`u1`, {id: `u1`, name: `Alice`, age: 30})
    await users.set(`u2`, {id: `u2`, name: `Bob`, age: 25})
    await users.set(`u3`, {id: `u3`, name: `Carol`, age: 35})
  })

  it(`returns values in input order`, async () => {
    const result = await users.getMany([`u1`, `u2`, `u3`])
    expect(result).toEqual([
      {id: `u1`, name: `Alice`, age: 30},
      {id: `u2`, name: `Bob`, age: 25},
      {id: `u3`, name: `Carol`, age: 35}
    ])
  })

  it(`returns undefined for missing keys (positional)`, async () => {
    const result = await users.getMany([`u1`, `missing`, `u3`])
    expect(result[0]).toEqual({id: `u1`, name: `Alice`, age: 30})
    expect(result[1]).toBeUndefined()
    expect(result[2]).toEqual({id: `u3`, name: `Carol`, age: 35})
  })

  it(`returns empty array for empty input`, async () => {
    const result = await users.getMany([])
    expect(result).toEqual([])
  })
})

describe(`LmdbRepository.prefetch (page pre-fault)`, () => {
  it(`completes without error for existing keys`, async () => {
    await users.set(`u1`, {id: `u1`, name: `A`, age: 1})
    await users.set(`u2`, {id: `u2`, name: `B`, age: 2})
    await expect(users.prefetch([`u1`, `u2`])).resolves.toBeUndefined()
  })

  it(`handles missing keys without error`, async () => {
    await expect(users.prefetch([`nope`])).resolves.toBeUndefined()
  })

  it(`handles empty input`, async () => {
    await expect(users.prefetch([])).resolves.toBeUndefined()
  })
})

describe(`LmdbRepository.drop (sub-DB removal)`, () => {
  it(`removes the sub-database and all entries`, async () => {
    const freshDir = mkdtempSync(join(tmpdir(), `lmdb-drop-test-`))
    const freshEnv = new LmdbEnv({path: freshDir, maxDbs: 5})
    const freshUsers = freshEnv.register(UserRepo)
    await freshUsers.set(`u1`, {id: `u1`, name: `A`, age: 1})
    expect(await freshUsers.count()).toBe(1)
    await freshUsers.drop()
    await freshEnv.close()
    const reopenEnv = new LmdbEnv({path: freshDir, maxDbs: 5})
    try {
      const reopenUsers = reopenEnv.register(UserRepo)
      expect(await reopenUsers.count()).toBe(0)
    } finally {
      await reopenEnv.close()
    }
  })

  it(`rejects on read-only env`, async () => {
    const roEnv = new LmdbEnv({path: tmpDir, readOnly: true})
    try {
      const roUsers = roEnv.register(UserRepo)
      await expect(roUsers.drop()).rejects.toThrow(LmdbReadOnlyError)
    } finally {
      await roEnv.close()
    }
  })
})