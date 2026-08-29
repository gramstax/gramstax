/**
 * F2 — Conditional writes at repository level.
 *
 * putIfNotExists: native ifNoExists — atomic across processes.
 * compareAndSet: native ifVersion + versioned put — requires useVersions env.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbReadOnlyError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
}

class UserSchema extends LmdbSchema { static db = `conditional-user-test`; static key = t.string(); static value = t.object<User>() }

let tmpDir: string
let env: LmdbEnv
let users: LmdbEnvSub<typeof UserSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-cond-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  users = env.register(UserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbRepository.putIfNotExists`, () => {
  it(`stores and returns true when the key is absent`, async () => {
    const created = await users.putIfNotExists(`u1`, {id: `u1`, name: `Alice`})
    expect(created).toBe(true)
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alice`})
  })

  it(`returns false and preserves the existing value when the key exists`, async () => {
    await users.put(`u1`, {id: `u1`, name: `Original`})
    const created = await users.putIfNotExists(`u1`, {id: `u1`, name: `Overwrite`})
    expect(created).toBe(false)
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Original`})
  })

  it(`runs through the codec like put() does`, async () => {
    const created = await users.putIfNotExists(`u1`, {id: `u1`, name: `Alice`})
    expect(created).toBe(true)
    expect((await users.getStrict(`u1`))?.name).toBe(`Alice`)
  })
})

describe(`LmdbRepository conditional write guards`, () => {
  it(`putIfNotExists rejects on a read-only env`, async () => {
    const roTmp = createTestDir(`lmdb-cond-ro-`)
    let roEnv: LmdbEnv | undefined
    try {
      // Seed data via a writable env first, then reopen read-only.
      const wEnv = new LmdbEnv({path: roTmp, maxDbs: 5})
      const wRepo = wEnv.register(UserSchema)
      await wRepo.put(`u1`, {id: `u1`, name: `A`})
      await wEnv.committed
      await wEnv.close()

      roEnv = new LmdbEnv({path: roTmp, maxDbs: 5, readOnly: true})
      const roRepo = roEnv.register(UserSchema)
      await expect(roRepo.putIfNotExists(`u2`, {id: `u2`, name: `B`})).rejects.toBeInstanceOf(LmdbReadOnlyError)
    } finally {
      if (roEnv) await roEnv.close()
      await rmWithRetry(roTmp)
    }
  })
})