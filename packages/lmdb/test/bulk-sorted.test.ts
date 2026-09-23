/**
 * Sorted-append bulk import tests — `{sorted: true}` fast path.
 *
 * Pre-sorted input skips the B-tree search per put (MDB_APPEND); any
 * inversion aborts fail-fast with `LmdbError`. Results equal
 * unsorted imports row-for-row.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t, type ValueOf} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
function assertType<T extends true>(): T {
  return true as T
}

class BulkSchema extends LmdbSchema {
  static db = `bulk-sorted`
  static key = t.number()
  static value = {
    name: t.string(),
    age: t.number()
  }
}

class IndexedBulkSchema extends LmdbSchema {
  static db = `bulk-sorted-indexed`
  static key = t.number()
  static value = {
    email: t.string().unique(),
    team: t.string().index(),
    age: t.number()
  }
}

class DupBulkSchema extends LmdbSchema {
  static db = `bulk-sorted-dup`
  static key = t.string()
  static value = t.string()
  static dupSort = true
}

class TtlBulkSchema extends LmdbSchema {
  static db = `bulk-sorted-ttl`
  static key = t.number()
  static value = {
    name: t.string()
  }
  static ttl = 60_000
}

function rows(n: number, reverse = false): Array<[number, {name: string; age: number}]> {
  const out: Array<[number, {name: string; age: number}]> = []
  for (let i = 0; i < n; i++) {
    const k = reverse ? n - 1 - i : i
    out.push([k, {name: `n${k}`, age: k}])
  }
  return out
}

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-bulk-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 20})
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

describe(`sorted bulk import`, () => {
  it(`is storage-neutral — row type unchanged`, () => {
    assertType<Equal<ValueOf<typeof BulkSchema>, {name: string; age: number}>>()
  })

  it(`sorted import equals unsorted result exactly`, async () => {
    const sorted = env.register(BulkSchema)
    await sorted.putMany(rows(2000), 500, {sorted: true})
    expect(await sorted.entries()).toEqual(rows(2000).map(([k, v]): [number, {name: string; age: number}] => [k, v]))
    expect(sorted.count()).toBe(2000)
  })

  it(`reverse input throws on the first inversion`, async () => {
    const subs = env.register(BulkSchema)
    await expect(subs.putMany(rows(100, true), 500, {sorted: true})).rejects.toBeInstanceOf(LmdbError)
  })

  it(`shuffled input throws`, async () => {
    const subs = env.register(BulkSchema)
    const mixed: Array<[number, {name: string; age: number}]> = [
      [1, {name: `n1`, age: 1}],
      [3, {name: `n3`, age: 3}],
      [2, {name: `n2`, age: 2}]
    ]
    await expect(subs.putMany(mixed, 500, {sorted: true})).rejects.toBeInstanceOf(LmdbError)
  })

  it(`duplicate keys throw without dupSort`, async () => {
    const subs = env.register(BulkSchema)
    const dups: Array<[number, {name: string; age: number}]> = [
      [1, {name: `n1`, age: 1}],
      [1, {name: `n1b`, age: 11}]
    ]
    await expect(subs.putMany(dups, 500, {sorted: true})).rejects.toBeInstanceOf(LmdbError)
  })

  it(`dupSort subs accept non-decreasing keys`, async () => {
    const tags = env.register(DupBulkSchema)
    await tags.putMany(
      [
        [`t`, `a`],
        [`t`, `b`],
        [`u`, `c`]
      ],
      500,
      {sorted: true}
    )
    expect(await tags.getValues(`t`)).toEqual([`a`, `b`])
  })

  it(`indexed subs maintain indexes on the fast path`, async () => {
    const subs = env.register(IndexedBulkSchema)
    const entries: Array<[number, {email: string; team: string; age: number}]> = []
    for (let i = 0; i < 500; i++) entries.push([i, {email: `u${i}@x.co`, team: i % 2 === 0 ? `red` : `blue`, age: i}])
    await subs.putMany(entries, 500, {sorted: true})
    expect(await subs.findByIndex({email: `u7@x.co`})).toEqual({email: `u7@x.co`, team: `blue`, age: 7})
    expect(await subs.findByIndex({team: `red`})).toHaveLength(250)
  })

  it(`ttl envelopes survive the fast path`, async () => {
    const subs = env.register(TtlBulkSchema)
    await subs.putMany(
      [
        [1, {name: `a`}],
        [2, {name: `b`}]
      ],
      500,
      {sorted: true}
    )
    expect(subs.get(1)).toEqual({name: `a`})
    expect(subs.get(2)).toEqual({name: `b`})
  })

  it(`onProgress fires per chunk`, async () => {
    const subs = env.register(BulkSchema)
    const calls: Array<[number, number]> = []
    await subs.putMany(rows(1200), 500, {
      sorted: true,
      onProgress: (done, total) => {
        calls.push([done, total])
      }
    })
    expect(calls).toEqual([
      [500, 1200],
      [1000, 1200],
      [1200, 1200]
    ])
  })

  it(`importJSONL supports sorted and progress`, async () => {
    const subs = env.register(BulkSchema)
    const lines = rows(1200)
      .map(([k, v]) => JSON.stringify([k, v]))
      .join(`\n`)
    const calls: Array<[number, number]> = []
    const count = await subs.importJSONL(lines, {
      sorted: true,
      onProgress: (done, total) => {
        calls.push([done, total])
      }
    })
    expect(count).toBe(1200)
    expect(subs.get(1199)).toEqual({name: `n1199`, age: 1199})
    expect(calls).toEqual([
      [500, 1200],
      [1000, 1200],
      [1200, 1200]
    ])
  })
})
