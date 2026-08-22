/**
 * F8 — Declarative non-unique secondary index (NonUniqueIndex) — SQL: CREATE INDEX (non-unique).
 * Why dupSort: one indexed value (email) maps to many primary keys; dupSort stores duplicates
 * under the same key in sorted order. Non-unique index requires static dupSort = true — validated.
 * Primary repo holds User by id; index repo (dupSort) maps email -> id.
 * Helper maintains index in same transaction as primary writes.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {NonUniqueIndex} from "../src/non-unique-index"
import {LmdbRepository} from "../src/repository"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface User {
  id: string
  email: string
  name: string
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `sec-user-test`
}

class EmailIndexRepo extends LmdbRepository<string, string> {
  static dbName = `sec-email-index-test`
  static dupSort = true
}

let tmpDir: string
let env: LmdbEnv
let users: UserRepo
let emailIndex: EmailIndexRepo
let indexed: NonUniqueIndex<User, string, string>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-sec-index-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  users = env.register(UserRepo)
  emailIndex = env.register(EmailIndexRepo)
  indexed = new NonUniqueIndex(env, users, emailIndex, (u: User) => u.email)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`NonUniqueIndex`, () => {
  it(`indexes on put and finds by index key`, async () => {
    await indexed.put(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`})
    await indexed.put(`u2`, {id: `u2`, email: `b@b.com`, name: `Bob`})
    expect(await indexed.findByIndex(`a@b.com`)).toEqual([{id: `u1`, email: `a@b.com`, name: `Alice`}])
    expect(await indexed.findByIndex(`missing@b.com`)).toEqual([])
  })

  it(`updates index when indexed field changes`, async () => {
    await indexed.put(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`})
    await indexed.put(`u1`, {id: `u1`, email: `c@b.com`, name: `Alice`})
    expect(await indexed.findByIndex(`a@b.com`)).toEqual([])
    expect(await indexed.findByIndex(`c@b.com`)).toEqual([{id: `u1`, email: `c@b.com`, name: `Alice`}])
  })

  it(`removes index entry on delete`, async () => {
    await indexed.put(`u1`, {id: `u1`, email: `a@b.com`, name: `Alice`})
    await indexed.remove(`u1`)
    expect(await indexed.findByIndex(`a@b.com`)).toEqual([])
    expect(users.get(`u1`)).toBeUndefined()
  })

  it(`handles multiple primaries sharing same indexed value (dupSort)`, async () => {
    await indexed.put(`u1`, {id: `u1`, email: `shared@b.com`, name: `A`})
    await indexed.put(`u2`, {id: `u2`, email: `shared@b.com`, name: `B`})
    const found = await indexed.findByIndex(`shared@b.com`)
    expect(found.length).toBe(2)
    expect(found.map((u: User) => u.id).sort()).toEqual([`u1`, `u2`])
  })

  it(`throws if index repo is not dupSort (validation)`, () => {
    class BadIndex extends LmdbRepository<string, string> {
      static dbName = `bad-index_dupsort_test`
    }
    const bad = env.register(BadIndex)
    expect(() => new NonUniqueIndex(env, users, bad, (u: User) => u.email)).toThrow(/dupSort/)
  })
})
