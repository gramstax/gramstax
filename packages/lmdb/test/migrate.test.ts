/**
 * F9 — Schema versioning + migration runner.
 *
 * Reserved meta sub-DB `__migrations` stores current version.
 * migrate() applies pending migrations in order, each inside its own
 * writer transaction, records new version, and is safe for concurrent
 * callers (second caller sees already-applied versions and skips).
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"
import {createTestDir, rmWithRetry} from "./test-helpers"

class UserRepo extends LmdbRepository<{name: string}, string> {
  static dbName = `migrate-user-test`
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-migrate-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  env.register(UserRepo)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbEnv.migrate`, () => {
  it(`applies pending migrations in ascending version order`, async () => {
    const order: number[] = []
    await env.migrate([
      {
        version: 2,
        name: `add-bob`,
        up: async (e: LmdbEnv) => {
          order.push(2)
          await e.get(UserRepo).set(`bob`, {name: `Bob`})
        }
      },
      {
        version: 1,
        name: `add-alice`,
        up: async (e: LmdbEnv) => {
          order.push(1)
          await e.get(UserRepo).set(`alice`, {name: `Alice`})
        }
      },
      {
        version: 3,
        name: `add-carol`,
        up: async (e: LmdbEnv) => {
          order.push(3)
          await e.get(UserRepo).set(`carol`, {name: `Carol`})
        }
      }
    ])
    expect(order).toEqual([1, 2, 3])
    expect(await env.get(UserRepo).get(`alice`)).toEqual({name: `Alice`})
    expect(env.getMigrationVersion()).toBe(3)
  })

  it(`is idempotent — re-running with same migrations applies nothing`, async () => {
    const migrations = [
      {
        version: 1,
        name: `v1`,
        up: async (e: LmdbEnv) => {
          await e.get(UserRepo).set(`a`, {name: `A`})
        }
      }
    ]
    const first = await env.migrate(migrations)
    expect(first.applied.length).toBe(1)
    const second = await env.migrate(migrations)
    expect(second.applied.length).toBe(0)
    expect(env.getMigrationVersion()).toBe(1)
  })

  it(`applies only pending versions when current version is already ahead`, async () => {
    await env.migrate([
      {
        version: 1,
        name: `v1`,
        up: async (e: LmdbEnv) => {
          await e.get(UserRepo).set(`a`, {name: `A`})
        }
      }
    ])
    const result = await env.migrate([
      {
        version: 1,
        name: `v1`,
        up: async () => {
          throw new Error(`should not run v1 again`)
        }
      },
      {
        version: 2,
        name: `v2`,
        up: async (e: LmdbEnv) => {
          await e.get(UserRepo).set(`b`, {name: `B`})
        }
      }
    ])
    expect(result.applied.map((m: {version: number}) => m.version)).toEqual([2])
    expect(await env.get(UserRepo).get(`b`)).toEqual({name: `B`})
  })

  it(`rolls back a failed migration and does not advance version`, async () => {
    await expect(
      env.migrate([
        {
          version: 1,
          name: `bad`,
          up: async () => {
            throw new Error(`boom`)
          }
        }
      ])
    ).rejects.toThrow(`boom`)
    expect(env.getMigrationVersion()).toBe(0)
    // Retry with a good migration at same version should succeed
    await env.migrate([
      {
        version: 1,
        name: `good`,
        up: async (e: LmdbEnv) => {
          await e.get(UserRepo).set(`a`, {name: `A`})
        }
      }
    ])
    expect(env.getMigrationVersion()).toBe(1)
  })

  it(`rejects duplicate version numbers in the input array`, async () => {
    await expect(
      env.migrate([
        {version: 1, name: `a`, up: async () => {}},
        {version: 1, name: `b`, up: async () => {}}
      ])
    ).rejects.toThrow(/duplicate/i)
  })
})
