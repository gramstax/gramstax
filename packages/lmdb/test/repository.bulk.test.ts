/**
 * F10 — Bulk utilities: putMany, exportJSONL, importJSONL.
 *
 * putMany batches in one transaction; export/import are text-format
 * complements to native binary backup().
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
}

class UserSchema extends LmdbSchema { static db = `bulk-user-test`; static key = t.string(); static value = t.object<User>() }

let tmpDir: string
let env: LmdbEnv
let users: LmdbEnvSub<typeof UserSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-bulk-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  users = env.register(UserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository bulk utilities`, () => {
  it(`putMany stores multiple entries in one batch`, async () => {
    await users.putMany([
      [`u1`, {id: `u1`, name: `Alice`}],
      [`u2`, {id: `u2`, name: `Bob`}],
      [`u3`, {id: `u3`, name: `Carol`}]
    ])
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alice`})
    expect(await users.get(`u2`)).toEqual({id: `u2`, name: `Bob`})
    expect(await users.get(`u3`)).toEqual({id: `u3`, name: `Carol`})
    expect(users.count()).toBe(3)
  })

  it(`putMany overwrites existing keys`, async () => {
    await users.put(`u1`, {id: `u1`, name: `Alice`})
    await users.putMany([[`u1`, {id: `u1`, name: `Alicia`}]])
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alicia`})
  })

  it(`count() tracks put/overwrite/delete/clear exactly (stat-based)`, async () => {
    expect(users.count()).toBe(0)
    await users.put(`u1`, {id: `u1`, name: `Alice`})
    await users.put(`u2`, {id: `u2`, name: `Bob`})
    expect(users.count()).toBe(2)
    await users.put(`u1`, {id: `u1`, name: `Alicia`})
    expect(users.count()).toBe(2)
    await users.delete(`u1`)
    expect(users.count()).toBe(1)
    await users.clear()
    expect(users.count()).toBe(0)
  })

  it(`exportJSONL serializes entries as JSON Lines`, async () => {
    await users.put(`u1`, {id: `u1`, name: `Alice`})
    await users.put(`u2`, {id: `u2`, name: `Bob`})
    const jsonl = await users.exportJSONL()
    const lines = jsonl
      .trim()
      .split(`\n`)
      .map((l: string) => JSON.parse(l))
    expect(lines).toEqual([
      [`u1`, {id: `u1`, name: `Alice`}],
      [`u2`, {id: `u2`, name: `Bob`}]
    ])
  })

  it(`importJSONL restores from JSONL and returns count`, async () => {
    const jsonl = [JSON.stringify([`u1`, {id: `u1`, name: `Alice`}]), JSON.stringify([`u2`, {id: `u2`, name: `Bob`}])].join(`\n`)
    const n = await users.importJSONL(jsonl)
    expect(n).toBe(2)
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alice`})
    expect(await users.get(`u2`)).toEqual({id: `u2`, name: `Bob`})
  })

  it(`export then import roundtrips through clear`, async () => {
    await users.put(`u1`, {id: `u1`, name: `Alice`})
    await users.put(`u2`, {id: `u2`, name: `Bob`})
    const jsonl = await users.exportJSONL()
    await users.clear()
    expect(users.count()).toBe(0)
    await users.importJSONL(jsonl)
    expect(users.count()).toBe(2)
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alice`})
  })

  it(`importJSONL handles empty string as zero imports`, async () => {
    expect(await users.importJSONL(``)).toBe(0)
    expect(await users.importJSONL(`\n\n`)).toBe(0)
  })
})
