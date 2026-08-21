/**
 * F5 — dupSort Repository API.
 *
 * Thin delegation to LMDB dupSort primitives: addValue, getValues,
 * getValuesCount, removeValue. Layer previously only existed at env level.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"
import {createTestDir, rmWithRetry} from "./test-helpers"

class IndexRepo extends LmdbRepository<string, string> {
  static dbName = `dup-index-test`
  static dupSort = true
}

let tmpDir: string
let env: LmdbEnv
let index: IndexRepo

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-dup-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5, encoding: `ordered-binary`})
  index = env.register(IndexRepo)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository dupSort helpers`, () => {
  it(`addValue stores duplicate values under the same key`, async () => {
    await index.addValue(`user1`, `order-1`)
    await index.addValue(`user1`, `order-2`)
    const values = await index.getValues(`user1`)
    expect(values).toEqual([`order-1`, `order-2`].sort())
  })

  it(`getValues returns empty array when the key has no values`, async () => {
    expect(await index.getValues(`missing`)).toEqual([])
  })

  it(`getValuesCount returns the number of duplicates for a key`, async () => {
    await index.addValue(`user1`, `order-1`)
    await index.addValue(`user1`, `order-2`)
    await index.addValue(`user1`, `order-3`)
    expect(index.getValuesCount(`user1`)).toBe(3)
    expect(index.getValuesCount(`missing`)).toBe(0)
  })

  it(`removeValue deletes a specific duplicate and returns true`, async () => {
    await index.addValue(`user1`, `order-1`)
    await index.addValue(`user1`, `order-2`)
    const removed = await index.removeValue(`user1`, `order-1`)
    expect(removed).toBe(true)
    expect(await index.getValues(`user1`)).toEqual([`order-2`])
  })

  it(`removeValue returns false when the value does not exist`, async () => {
    await index.addValue(`user1`, `order-1`)
    const removed = await index.removeValue(`user1`, `order-missing`)
    expect(removed).toBe(false)
    expect(await index.getValues(`user1`)).toEqual([`order-1`])
  })

  it(`isolates duplicate sets per key`, async () => {
    await index.addValue(`user1`, `a`)
    await index.addValue(`user2`, `b`)
    expect(await index.getValues(`user1`)).toEqual([`a`])
    expect(await index.getValues(`user2`)).toEqual([`b`])
  })
})
