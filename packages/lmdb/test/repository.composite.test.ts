/**
 * F1 — Composite keys via ordered-binary array encoding.
 *
 * LMDB natively supports array keys ordered lexicographically via
 * ordered-binary. Wrapper's ILmdbKey previously omitted array form.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"

import {createTestDir, rmWithRetry} from "./test-helpers"

interface User {
  name: string
}

class TenantUserSchema extends LmdbSchema { static db = `tenant-user-f1-test`; static key = t.array(); static value = t.object<User>() }

let tmpDir: string
let env: LmdbEnv
let repo: LmdbEnvSub<typeof TenantUserSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-composite-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  repo = env.register(TenantUserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository composite array keys`, () => {
  it(`stores and retrieves via composite tuple keys`, async () => {
    await repo.put([`tenant-a`, 1], {name: `Alice`})
    await repo.put([`tenant-a`, 2], {name: `Bob`})
    await repo.put([`tenant-b`, 1], {name: `Carol`})
    expect(await repo.get([`tenant-a`, 1])).toEqual({name: `Alice`})
    expect(await repo.get([`tenant-a`, 2])).toEqual({name: `Bob`})
    expect(await repo.get([`tenant-b`, 1])).toEqual({name: `Carol`})
  })

  it(`isolates different composite keys with same first element`, async () => {
    await repo.put([`tenant-a`, 1], {name: `Alice`})
    expect(await repo.get([`tenant-a`, 2])).toBeUndefined()
    expect(repo.has([`tenant-a`, 1])).toBe(true)
    expect(repo.has([`tenant-a`, 2])).toBe(false)
  })

  it(`isolates same second element across different tenants`, async () => {
    await repo.put([`tenant-a`, 1], {name: `Alice`})
    await repo.put([`tenant-b`, 1], {name: `Bob`})
    expect(await repo.get([`tenant-a`, 1])).toEqual({name: `Alice`})
    expect(await repo.get([`tenant-b`, 1])).toEqual({name: `Bob`})
  })

  it(`supports range iteration over composite keys in ordered-binary order`, async () => {
    await repo.put([`tenant-a`, 1], {name: `A1`})
    await repo.put([`tenant-a`, 2], {name: `A2`})
    await repo.put([`tenant-b`, 1], {name: `B1`})
    const entries = await repo.entries()
    expect(entries.length).toBe(3)
    // Ordered: [tenant-a,1] < [tenant-a,2] < [tenant-b,1] lexicographically
    expect(entries[0]![0]).toEqual([`tenant-a`, 1])
    expect(entries[1]![0]).toEqual([`tenant-a`, 2])
    expect(entries[2]![0]).toEqual([`tenant-b`, 1])
  })

  it(`delete removes only the targeted composite key`, async () => {
    await repo.put([`tenant-a`, 1], {name: `Alice`})
    await repo.put([`tenant-a`, 2], {name: `Bob`})
    await repo.delete([`tenant-a`, 1])
    expect(await repo.get([`tenant-a`, 1])).toBeUndefined()
    expect(await repo.get([`tenant-a`, 2])).toEqual({name: `Bob`})
  })

  it(`count reflects composite key entries`, async () => {
    expect(repo.count()).toBe(0)
    await repo.put([`tenant-a`, 1], {name: `A1`})
    await repo.put([`tenant-a`, 2], {name: `A2`})
    expect(repo.count()).toBe(2)
  })
})
