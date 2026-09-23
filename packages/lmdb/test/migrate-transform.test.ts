/**
 * Transform-backfill migration tests — row rewrites as migration steps.
 *
 * A `{version, name, transform: {schema, schemaVersion, map}}` step rewrites
 * every row in 500-row transactions with progress; completion markers in
 * `__migrations` make reruns resume without duplicates; shape skew throws
 * `LmdbError`. Transforms must be idempotent (reruns re-apply).
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t, type ValueOf} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

type ProfileRow = ValueOf<typeof ProfileSchema>

class ProfileSchema extends LmdbSchema {
  static db = `mig-profile`
  static key = t.number()
  static value = {
    name: t.string(),
    email: t.string().optional()
  }
  static version = 2
}

class PlainSchema extends LmdbSchema {
  static db = `mig-plain`
  static key = t.number()
  static value = {
    name: t.string()
  }
}

class AuditSchema extends LmdbSchema {
  static db = `mig-audit`
  static key = t.string()
  static value = {
    note: t.string()
  }
}

class BadVersionSchema extends LmdbSchema {
  static db = `mig-bad-version`
  static key = t.number()
  static value = {
    name: t.string()
  }
  static version = 1.5 as never
}

function fillEmail(row: ProfileRow): ProfileRow {
  return {...row, email: row.email ?? `${row.name}@x.co`}
}

let tmpDir: string
let env: LmdbEnv

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-mig-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 20})
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

async function seedProfiles(n: number): Promise<void> {
  const profiles = env.sub(ProfileSchema)
  const entries: Array<[number, {name: string}]> = []
  for (let i = 0; i < n; i++) entries.push([i, {name: `n${i}`}])
  await profiles.putMany(entries as never)
}

describe(`transform backfill`, () => {
  it(`rewrites all rows in chunks with progress`, async () => {
    env.register(ProfileSchema)
    await seedProfiles(1200)
    const calls: Array<[number, number]> = []
    const result = await env.migrate([
      {
        version: 1,
        name: `fill-email`,
        transform: {
          schema: ProfileSchema,
          schemaVersion: 2,
          map: fillEmail,
          onProgress: (done, total) => {
            calls.push([done, total])
          }
        }
      }
    ])
    expect(result.currentVersion).toBe(1)
    expect(result.applied).toHaveLength(1)
    expect(calls).toEqual([
      [500, 1200],
      [1000, 1200],
      [1200, 1200]
    ])
    const profiles = env.sub(ProfileSchema)
    expect(profiles.get(0)).toEqual({name: `n0`, email: `n0@x.co`})
    expect(profiles.get(1199)).toEqual({name: `n1199`, email: `n1199@x.co`})
    expect(profiles.count()).toBe(1200)
    // Rerun is a silent no-op.
    const rerun = await env.migrate([
      {
        version: 1,
        name: `fill-email`,
        transform: {schema: ProfileSchema, schemaVersion: 2, map: fillEmail}
      }
    ])
    expect(rerun.applied).toHaveLength(0)
  })

  it(`kill mid-way then restart resumes without duplicates`, async () => {
    env.register(ProfileSchema)
    await seedProfiles(1200)
    let calls = 0
    const crashing = (row: ProfileRow): ProfileRow => {
      calls++
      if (calls === 700) throw new Error(`boom`)
      return fillEmail(row)
    }
    await expect(env.migrate([{version: 1, name: `fill-email`, transform: {schema: ProfileSchema, schemaVersion: 2, map: crashing}}])).rejects.toThrow(`boom`)
    expect(env.getMigrationVersion()).toBe(0)
    await env.close()
    const env2 = new LmdbEnv({path: tmpDir, maxDbs: 20})
    try {
      env2.register(ProfileSchema)
      const result = await env2.migrate([{version: 1, name: `fill-email`, transform: {schema: ProfileSchema, schemaVersion: 2, map: fillEmail}}])
      expect(result.currentVersion).toBe(1)
      const profiles = env2.sub(ProfileSchema)
      expect(profiles.count()).toBe(1200)
      for (const k of [0, 699, 700, 1199]) {
        expect(profiles.get(k)).toEqual({name: `n${k}`, email: `n${k}@x.co`})
      }
    } finally {
      await env2.close()
    }
  })

  it(`up runs after transform and sees rewritten rows`, async () => {
    env.register(ProfileSchema)
    env.register(AuditSchema)
    await seedProfiles(10)
    await env.migrate([
      {
        version: 1,
        name: `fill-then-audit`,
        transform: {schema: ProfileSchema, schemaVersion: 2, map: fillEmail},
        up: async (e) => {
          const email = e.sub(ProfileSchema).get(0)?.email ?? `missing`
          await e.sub(AuditSchema).put(`a1`, {note: email})
        }
      }
    ])
    expect(env.sub(AuditSchema).get(`a1`)).toEqual({note: `n0@x.co`})
  })

  it(`skew between step and schema versions throws`, async () => {
    env.register(ProfileSchema)
    await expect(env.migrate([{version: 1, name: `stale`, transform: {schema: ProfileSchema, schemaVersion: 1, map: fillEmail}}])).rejects.toBeInstanceOf(LmdbError)
    expect(env.getMigrationVersion()).toBe(0)
  })

  it(`unversioned schemas skip the skew check`, async () => {
    const subs = env.register(PlainSchema)
    await subs.put(1, {name: `a`})
    const result = await env.migrate([
      {
        version: 1,
        name: `upper`,
        transform: {
          schema: PlainSchema,
          map: (row: {name: string}) => ({name: row.name.toUpperCase()})
        }
      }
    ])
    expect(result.currentVersion).toBe(1)
    expect(subs.get(1)).toEqual({name: `A`})
  })

  it(`steps need up or transform, versions must be integers`, async () => {
    await expect(env.migrate([{version: 1, name: `empty`} as never])).rejects.toBeInstanceOf(LmdbError)
    expect(() => env.register(BadVersionSchema)).toThrow(LmdbError)
  })
})
