/**
 * Tests for schema-declared non-unique secondary indexes (.index()).
 *
 * Schema value columns declared with `.index()` create a dupSort sub-DB
 * that maps the indexed value → primary key. findOneByIndex returns the
 * primary record; the index is maintained in the same writer transaction.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"
import {createTestDir, rmWithRetry} from "./test-helpers"

class UserSchema extends LmdbSchema {
  static db = `sec-user-test`
  static key = t.string()
  static value = {
    id: t.string().unique(),
    email: t.string().index(),
    name: t.string()
  }
}

let tmpDir: string
let env: LmdbEnv
let users: LmdbEnvSub<typeof UserSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-sec-index-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  users = env.register(UserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`schema non-unique indexes`, () => {
  it(`indexes on put and finds by index key`, async () => {
    await users.put(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`})
    await users.put(`u2`, {id: `u2`, email: `b@b.com`, name: `Bob`})
    expect(await users.findByIndex({email: `a@b.com`})).toEqual([{id: `u1`, email: `a@b.com`, name: `Alice`}])
    expect(await users.findByIndex({email: `missing@b.com`})).toEqual([])
  })

  it(`updates index when indexed field changes`, async () => {
    await users.put(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`})
    await users.put(`u1`, {id: `u1`, email: `c@b.com`, name: `Alice`})
    expect(await users.findByIndex({email: `a@b.com`})).toEqual([])
    expect(await users.findByIndex({email: `c@b.com`})).toEqual([{id: `u1`, email: `c@b.com`, name: `Alice`}])
  })

  it(`removes index entry on delete`, async () => {
    await users.put(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`})
    await users.delete(`u1`)
    expect(await users.findByIndex({email: `a@b.com`})).toEqual([])
    expect(users.get(`u1`)).toBeUndefined()
  })

  it(`handles multiple primaries sharing same indexed value (non-unique)`, async () => {
    await users.put(`u1`, {id: `u1`, email: `shared@b.com`, name: `A`})
    await users.put(`u2`, {id: `u2`, email: `shared@b.com`, name: `B`})
    const found = await users.findByIndex({email: `shared@b.com`})
    expect(found.length).toBe(2)
    expect(found.map((u) => u.id).sort()).toEqual([`u1`, `u2`])
  })
})