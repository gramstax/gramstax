/**
 * LmdbEnvSub — typed sub-collection handle returned by `register`.
 *
 * Verifies the pre-bound handle delegates correctly: schema-bound calls
 * (put/get/has/count/delete), typed range queries, embedded indexes,
 * cross-collection access via `owner`, and sync methods.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"
import {createTestDir, rmWithRetry} from "./test-helpers"

class UserSchema extends LmdbSchema {
  static db = `sub-user-test`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    name: t.string(),
    age: t.number()
  }
}

class CountSchema extends LmdbSchema {
  static db = `sub-counter-test`
  static key = t.string()
  static value = t.number()
}

class TagSchema extends LmdbSchema {
  static db = `sub-tag-test`
  static key = t.string()
  static value = t.string()
  static dupSort = true
}

let tmpDir: string
let env: LmdbEnv
let users: LmdbEnvSub<typeof UserSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-sub-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  users = env.register(UserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbEnvSub`, () => {
  it(`register returns a pre-bound handle — put/get/has/count/delete`, async () => {
    await users.put(1, {id: 1, name: `Alice`, age: 30})
    expect(users.get(1)).toEqual({id: 1, name: `Alice`, age: 30})
    expect(users.has(1)).toBe(true)
    expect(users.count()).toBe(1)
    expect(users.dbName).toBe(`sub-user-test`)
    await users.delete(1)
    expect(users.count()).toBe(0)
  })

  it(`range queries are typed through the handle`, async () => {
    await users.put(1, {id: 1, name: `Alice`, age: 30})
    await users.put(2, {id: 2, name: `Bob`, age: 40})
    expect(await users.keys()).toEqual([1, 2])
    expect(await users.values()).toEqual([
      {id: 1, name: `Alice`, age: 30},
      {id: 2, name: `Bob`, age: 40}
    ])
    expect(await users.entries()).toHaveLength(2)
    const iterated: Array<unknown> = []
    for await (const entry of users.iterate()) iterated.push(entry)
    expect(iterated).toHaveLength(2)
    expect(await users.first()).toEqual([1, {id: 1, name: `Alice`, age: 30}])
    expect(await users.last()).toEqual([2, {id: 2, name: `Bob`, age: 40}])
    expect(await users.findByPrefix(1)).toEqual([[1, {id: 1, name: `Alice`, age: 30}]])
  })

  it(`embedded indexes narrow through the handle`, async () => {
    await users.put(1, {id: 1, name: `Alice`, age: 30})
    expect(await users.findByIndex({id: 1})).toEqual({id: 1, name: `Alice`, age: 30})
  })

  it(`scalar counter handle — increment/decrement`, async () => {
    const counters = env.register(CountSchema)
    expect(await counters.increment(`seq`)).toBe(1)
    expect(await counters.increment(`seq`)).toBe(2)
    expect(await counters.decrement(`seq`)).toBe(1)
    expect(counters.get(`seq`)).toBe(1)
  })

  it(`dupSort handle — addValue/getValues/getValuesCount/removeValue`, async () => {
    const tags = env.register(TagSchema)
    await tags.addValue(`p1`, `js`)
    await tags.addValue(`p1`, `ts`)
    expect(await tags.getValues(`p1`)).toEqual([`js`, `ts`])
    expect(tags.getValuesCount(`p1`)).toBe(2)
    await tags.removeValue(`p1`, `js`)
    expect(await tags.getValues(`p1`)).toEqual([`ts`])
  })

  it(`owner exposes the env for cross-collection transactions`, async () => {
    const counters = env.register(CountSchema)
    await users.owner.transaction(async () => {
      await users.put(1, {id: 1, name: `Alice`, age: 30})
      await counters.put(`x`, 5)
    })
    expect(users.get(1)?.name).toBe(`Alice`)
    expect(counters.get(`x`)).toBe(5)
  })

  it(`sync methods delegate through the handle`, async () => {
    const counters = env.register(CountSchema)
    await users.owner.rootTransactionSync(() => {
      counters.putSync(`k`, 7)
      expect(counters.get(`k`)).toBe(7)
      expect(counters.removeSync(`k`)).toBe(true)
    })
    expect(counters.count()).toBe(0)
  })
})
