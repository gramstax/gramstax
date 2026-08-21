/**
 * F2 — Conditional writes at repository level.
 *
 * setIfNotExists: native ifNoExists — atomic across processes.
 * compareAndSet: native ifVersion + versioned put — requires useVersions env.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbReadOnlyError} from "../src/errors"
import {LmdbRepository} from "../src/repository"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `cond-user-test`
}

class VersionedRepo extends LmdbRepository<User, string> {
  static dbName = `cond-versioned-test`
}

let tmpDir: string
let env: LmdbEnv
let users: UserRepo

let vTmpDir: string
let vEnv: LmdbEnv
let versioned: VersionedRepo

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-cond-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  users = env.register(UserRepo)

  vTmpDir = createTestDir(`lmdb-cond-ver-test-`)
  vEnv = new LmdbEnv({path: vTmpDir, maxDbs: 5, useVersions: true})
  versioned = vEnv.register(VersionedRepo)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
  await vEnv.close()
  await rmWithRetry(vTmpDir)
})

describe(`LmdbRepository.setIfNotExists`, () => {
  it(`stores and returns true when the key is absent`, async () => {
    const created = await users.setIfNotExists(`u1`, {id: `u1`, name: `Alice`})
    expect(created).toBe(true)
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Alice`})
  })

  it(`returns false and preserves the existing value when the key exists`, async () => {
    await users.set(`u1`, {id: `u1`, name: `Original`})
    const created = await users.setIfNotExists(`u1`, {id: `u1`, name: `Overwrite`})
    expect(created).toBe(false)
    expect(await users.get(`u1`)).toEqual({id: `u1`, name: `Original`})
  })

  it(`runs through the codec like set() does`, async () => {
    const created = await users.setIfNotExists(`u1`, {id: `u1`, name: `Alice`})
    expect(created).toBe(true)
    expect((await users.getStrict(`u1`)).name).toBe(`Alice`)
  })
})

describe(`LmdbRepository.compareAndSet`, () => {
  it(`updates and returns true when the expected version matches`, async () => {
    await (versioned as unknown as {env: LmdbEnv}).env.put(`u1`, {id: `u1`, name: `v1`}, 1)
    const ok = await versioned.compareAndSet(`u1`, 1, {id: `u1`, name: `v2`})
    expect(ok).toBe(true)
    expect(await versioned.get(`u1`)).toEqual({id: `u1`, name: `v2`})
  })

  it(`returns false and leaves the value untouched when the version does not match`, async () => {
    await (versioned as unknown as {env: LmdbEnv}).env.put(`u1`, {id: `u1`, name: `v1`}, 1)
    const ok = await versioned.compareAndSet(`u1`, 99, {id: `u1`, name: `hijack`})
    expect(ok).toBe(false)
    expect(await versioned.get(`u1`)).toEqual({id: `u1`, name: `v1`})
  })

  it(`advances the record version after a successful CAS`, async () => {
    await (versioned as unknown as {env: LmdbEnv}).env.put(`u1`, {id: `u1`, name: `v1`}, 1)
    await versioned.compareAndSet(`u1`, 1, {id: `u1`, name: `v2`})
    const entry = (versioned as unknown as {env: LmdbEnv}).env.getEntry(`u1`)
    expect(entry?.version).toBe(2)
  })

  it(`rejects with a clear error when the env was opened without useVersions`, async () => {
    await users.set(`u1`, {id: `u1`, name: `v1`})
    await expect(users.compareAndSet(`u1`, 1, {id: `u1`, name: `v2`})).rejects.toThrow(/useVersions/)
  })
})

describe(`LmdbRepository conditional write guards`, () => {
  it(`setIfNotExists rejects on a read-only env`, async () => {
    const roTmp = createTestDir(`lmdb-cond-ro-`)
    let roEnv: LmdbEnv | undefined
    try {
      // Seed data via a writable env first, then reopen read-only.
      const wEnv = new LmdbEnv({path: roTmp, maxDbs: 5})
      const wRepo = wEnv.register(UserRepo)
      await wRepo.set(`u1`, {id: `u1`, name: `A`})
      await wEnv.committed
      await wEnv.close()

      roEnv = new LmdbEnv({path: roTmp, maxDbs: 5, readOnly: true})
      const roRepo = roEnv.register(UserRepo)
      await expect(roRepo.setIfNotExists(`u2`, {id: `u2`, name: `B`})).rejects.toBeInstanceOf(LmdbReadOnlyError)
    } finally {
      if (roEnv) await roEnv.close()
      await rmWithRetry(roTmp)
    }
  })
})
