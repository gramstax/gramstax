/**
 * Full-text search tests — inverted posting tables over dupSort sub-DBs.
 *
 * Declared with `t.string().search()`; maintained in the same writer
 * transaction as the primary write; read via `sub.search(query, {limit?})`
 * with AND semantics and per-column-hit ranking.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t, type ValueOf} from "../src/schema"
import {LmdbSearch} from "../src/search"
import type {ILmdbKey} from "../src/types/key"
import {createTestDir, rmWithRetry} from "./test-helpers"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<T extends true>(): T {
  return true as T
}

class DocSchema extends LmdbSchema {
  static db = `search-doc`
  static key = t.number()
  static value = {
    title: t.string().search(),
    body: t.string().search(),
    views: t.number()
  }
}

class PlainSchema extends LmdbSchema {
  static db = `search-plain`
  static key = t.number()
  static value = {
    name: t.string()
  }
}

class BadKindSchema extends LmdbSchema {
  static db = `search-bad-kind`
  static key = t.number()
  static value = {
    count: t.number().search()
  }
}

class ScalarSearchSchema extends LmdbSchema {
  static db = `search-scalar`
  static key = t.number()
  static value = t.string().search()
}

class PrefixDocSchema extends LmdbSchema {
  static db = `search-prefix`
  static key = t.string()
  static value = {
    title: t.string().search()
  }
}

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-search-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 20})
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

describe(`tokenize`, () => {
  it(`lowercases and splits on non-alphanumerics`, () => {
    expect(LmdbSearch.tokenize(`Hello, World!`)).toEqual([`hello`, `world`])
    expect(LmdbSearch.tokenize(`  spaced   out  `)).toEqual([`spaced`, `out`])
    expect(LmdbSearch.tokenize(`a1-b2_c3`)).toEqual([`a1`, `b2`, `c3`])
  })

  it(`returns no terms for empty input`, () => {
    expect(LmdbSearch.tokenize(``)).toEqual([])
    expect(LmdbSearch.tokenize(`!!!`)).toEqual([])
  })

  it(`fingerprints keys by value, not identity`, () => {
    expect(LmdbSearch.fingerprintPk(`a`)).toBe(LmdbSearch.fingerprintPk(`a`))
    expect(LmdbSearch.fingerprintPk(`a`)).not.toBe(LmdbSearch.fingerprintPk(`b`))
    expect(LmdbSearch.fingerprintPk(1)).not.toBe(LmdbSearch.fingerprintPk(`1`))
    expect(LmdbSearch.fingerprintPk([`t`, 1])).toBe(LmdbSearch.fingerprintPk([`t`, 1]))
    expect(LmdbSearch.fingerprintPk([`t`, 1])).not.toBe(LmdbSearch.fingerprintPk([`t`, 2]))
    expect(LmdbSearch.fingerprintPk(Symbol.for(`k`))).toBe(`y:Symbol(k)`)
    expect(LmdbSearch.fingerprintPk(new Uint8Array([1, 2]))).toBe(`x:0102`)
    expect(LmdbSearch.fingerprintPk({odd: true} as unknown as ILmdbKey)).toBe(`j:{"odd":true}`)
  })
})

describe(`search declaration`, () => {
  it(`marker is storage-only — row type unchanged`, () => {
    assertType<Equal<ValueOf<typeof DocSchema>, {title: string; body: string; views: number}>>()
  })

  it(`rejects .search() on non-string columns`, () => {
    expect(() => env.register(BadKindSchema)).toThrow(LmdbError)
  })

  it(`rejects .search() on scalar values`, () => {
    expect(() => env.register(ScalarSearchSchema)).toThrow(LmdbError)
  })
})

describe(`sub.search()`, () => {
  it(`returns ranked PKs across searched columns`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `red apple`, body: `red orchard`, views: 1})
    await docs.put(2, {title: `red barn`, body: `green field`, views: 2})
    await docs.put(3, {title: `blue sky`, body: `green hills`, views: 3})
    // Doc 1 matches `red` in two columns — ranks before doc 2 (one column).
    expect(await docs.search(`red`)).toEqual([1, 2])
    expect(await docs.search(`green`)).toEqual([2, 3])
    expect(await docs.search(`RED`)).toEqual([1, 2])
  })

  it(`ANDs query terms`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `hello world`, body: `x`, views: 1})
    await docs.put(2, {title: `hello there`, body: `x`, views: 1})
    await docs.put(3, {title: `goodbye world`, body: `x`, views: 1})
    expect(await docs.search(`hello world`)).toEqual([1])
  })

  it(`returns [] for unknown terms`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `hello`, body: `world`, views: 1})
    expect(await docs.search(`nope`)).toEqual([])
    expect(await docs.search(`hello nope`)).toEqual([])
  })

  it(`rejects empty queries`, async () => {
    const docs = env.register(DocSchema)
    await expect(docs.search(``)).rejects.toBeInstanceOf(LmdbError)
    await expect(docs.search(` !!! `)).rejects.toBeInstanceOf(LmdbError)
  })

  it(`rejects search on schemas without searchable columns`, async () => {
    const plain = env.register(PlainSchema)
    await plain.put(1, {name: `hello`})
    await expect(plain.search(`hello`)).rejects.toBeInstanceOf(LmdbError)
  })

  it(`honors {limit}`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `red one`, body: `x`, views: 1})
    await docs.put(2, {title: `red two`, body: `x`, views: 1})
    await docs.put(3, {title: `red three`, body: `x`, views: 1})
    expect(await docs.search(`red`, {limit: 2})).toHaveLength(2)
    expect(await docs.search(`red`, {limit: 0})).toEqual([])
  })
})

describe(`search maintenance`, () => {
  it(`update frees old terms`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `alpha`, body: `x`, views: 1})
    expect(await docs.search(`alpha`)).toEqual([1])
    await docs.put(1, {title: `beta`, body: `x`, views: 1})
    expect(await docs.search(`alpha`)).toEqual([])
    expect(await docs.search(`beta`)).toEqual([1])
  })

  it(`delete cleans postings`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `alpha`, body: `x`, views: 1})
    await docs.delete(1)
    expect(await docs.search(`alpha`)).toEqual([])
  })

  it(`clear cleans postings`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `alpha`, body: `x`, views: 1})
    await docs.clear()
    expect(await docs.search(`alpha`)).toEqual([])
  })

  it(`deleteByPrefix cleans postings`, async () => {
    const docs = env.register(PrefixDocSchema)
    await docs.put(`user:1`, {title: `alpha`})
    await docs.put(`user:2`, {title: `alpha beta`})
    expect(await docs.search(`alpha`)).toEqual([`user:1`, `user:2`])
    await docs.deleteByPrefix(`user:`)
    expect(await docs.search(`alpha`)).toEqual([])
  })

  it(`reindex() rebuilds damaged posting tables`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `alpha`, body: `beta`, views: 1})
    // Corrupt the title postings behind the sub's back, then rebuild.
    const raw = env.getDb(`search-doc:search:title`)
    raw.removeSync(`alpha`, 1)
    expect(await docs.search(`alpha`)).toEqual([])
    expect(await docs.search(`beta`)).toEqual([1])
    const result = await docs.reindex()
    expect(result.built).toBeGreaterThan(0)
    expect(await docs.search(`alpha`)).toEqual([1])
  })

  it(`reindex(name) rebuilds one search table`, async () => {
    const docs = env.register(DocSchema)
    await docs.put(1, {title: `alpha`, body: `beta`, views: 1})
    env.getDb(`search-doc:search:body`).removeSync(`beta`, 1)
    expect(await docs.search(`beta`)).toEqual([])
    await docs.reindex(`body`)
    expect(await docs.search(`beta`)).toEqual([1])
    expect(await docs.search(`alpha`)).toEqual([1])
  })

  it(`putMany maintains postings`, async () => {
    const docs = env.register(DocSchema)
    await docs.putMany([
      [1, {title: `alpha`, body: `x`, views: 1}],
      [2, {title: `beta`, body: `x`, views: 1}]
    ])
    expect(await docs.search(`alpha`)).toEqual([1])
    expect(await docs.search(`beta`)).toEqual([2])
  })

  it(`rejects counter and binary writes on searchable subs`, async () => {
    const docs = env.register(DocSchema)
    await expect(docs.increment(1 as never)).rejects.toBeInstanceOf(LmdbError)
    await expect(docs.putBinary(1 as never, Buffer.from(`x`))).rejects.toBeInstanceOf(LmdbError)
  })
})

describe(`search at scale`, () => {
  it(`caps a 200k-term corpus with {limit}`, async () => {
    const docs = env.register(DocSchema)
    // Chunked inserts keep the driver's memory flat — one 200k array would
    // spike alongside parallel test files and starve timing-sensitive suites.
    for (let base = 0; base < 200_000; base += 10_000) {
      const entries: Array<[number, {title: string; body: string; views: number}]> = []
      for (let i = base; i < base + 10_000; i++) {
        entries.push([i, {title: `doc number ${i} w${i}`, body: `common body ${i}`, views: i}])
      }
      await docs.putMany(entries)
    }
    expect(await docs.search(`w199999`)).toEqual([199999])
    const capped = await docs.search(`common`, {limit: 100})
    expect(capped).toHaveLength(100)
  }, 300_000)
})
