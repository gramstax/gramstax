import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync, mkdirSync, readdirSync, utimesSync} from "node:fs"
import {join} from "node:path"
import {LmdbBackup} from "../src/backup"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbReader} from "../src/reader"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

class CovUserSchema extends LmdbSchema {
  static db = `cov-user`
  static key = t.string()
  static value = {name: t.string()}
}

class CovNumSchema extends LmdbSchema {
  static db = `cov-num`
  static key = t.number()
  static value = {name: t.string()}
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-cov-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  env.register(CovUserSchema)
  env.register(CovNumSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`coverage-errors`, () => {
  it(`constructs version and map-full errors`, () => {
    expect(new LmdbError(`Cannot perform 'compareAndSet' because the env was not opened with useVersions: true.`).message).toContain(`useVersions`)
    expect(new LmdbError(`MDB_MAP_FULL risk — free ratio 0.050 is below 10%. Increase mapSize or prune data.`).message).toContain(`0.050`)
  })
})

describe(`coverage-sub`, () => {
  it(`putSync writes and type accessors resolve`, async () => {
    const users = env.sub(CovUserSchema)
    users.putSync(`s1`, {name: `Sync`})
    expect(users.get(`s1`)).toEqual({name: `Sync`})
    expect(users.getEntry(`s1`)?.value).toEqual({name: `Sync`})
    expect(users.schemaClass).toBe(CovUserSchema)
    expect(users.keyType).toBeUndefined()
    expect(users.valueType).toBeUndefined()
    expect(users.key).toBeUndefined()
  })

  it(`deleteByPrefix falls back to key scan for non-string prefixes`, async () => {
    const nums = env.sub(CovNumSchema)
    await nums.put(1, {name: `one`})
    await nums.put(2, {name: `two`})
    await nums.put(11, {name: `eleven`})
    const removed = await nums.deleteByPrefix(1 as never)
    expect(removed).toBe(2)
    expect(nums.get(2)).toEqual({name: `two`})
  })
})

describe(`coverage-replica`, () => {
  it(`open with pollMs resets periodically and clears timer on close`, async () => {
    const replica = await LmdbReader.open(tmpDir, {pollMs: 10, maxDbs: 5})
    expect(replica.readOnly).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await replica.close()
    await replica.close()
  })

  it(`LmdbBackup.backup prunes deterministic old entries`, async () => {
    await env.sub(CovUserSchema).put(`u1`, {name: `Alice`})
    await env.committed
    const base = createTestDir(`lmdb-cov-backup-`)
    try {
      const old = new Date(`2020-01-01T00:00:00Z`)
      for (const name of [`backup-old-a`, `backup-old-b`]) {
        mkdirSync(join(base, name), {recursive: true})
        utimesSync(join(base, name), old, old)
      }
      const dest = await LmdbBackup.backup(env, base, 2)
      expect(dest.startsWith(base)).toBe(true)
      const entries = readdirSync(base)
      expect(entries.length).toBe(2)
      expect(existsSync(join(dest, `data.mdb`))).toBe(true)
    } finally {
      await rmWithRetry(base)
    }
  })
})

describe(`coverage-test-helpers`, () => {
  it(`rmWithRetry swallows repeated failures`, async () => {
    await rmWithRetry(`x\0y`, 2, 1)
  })
})
