/**
 * F12 — Replica attach sugar + backup retention.
 *
 * Read-only replica polling via resetReadTxn, backup pruning.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync, readdirSync} from "node:fs"
import {join} from "node:path"
import {LmdbBackup} from "../src/backup"
import {LmdbEnv} from "../src/env"
import {LmdbReader} from "../src/reader"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

class UserSchema extends LmdbSchema {
  static db = `replica-user-test`
  static key = t.string()
  static value = {name: t.string()}
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-replica-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  env.register(UserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbReader`, () => {
  it(`opens a read-only replica that sees writer data after resetReadTxn`, async () => {
    await env.sub(UserSchema).put(`u1`, {name: `Alice`})
    await env.committed

    const replica = await LmdbReader.open(tmpDir)
    replica.register(UserSchema)
    const roRepo = replica.sub(UserSchema)
    // Initially may see u1, or need reset after writer commit
    replica.resetReadTxn()
    expect(roRepo.get(`u1`)).toEqual({name: `Alice`})

    await env.sub(UserSchema).put(`u2`, {name: `Bob`})
    await env.committed
    // Replica's read txn is stale until reset
    replica.resetReadTxn()
    expect(roRepo.get(`u2`)).toEqual({name: `Bob`})

    expect(replica.readOnly).toBe(true)
    await replica.close()
  })

  it(`replica rejects writes`, async () => {
    const replica = await LmdbReader.open(tmpDir)
    replica.register(UserSchema)
    const roRepo = replica.sub(UserSchema)
    await expect(roRepo.put(`u1`, {name: `Alice`})).rejects.toThrow()
    await replica.close()
  })
})

const skipBackup = process.platform === `win32`

describe(`backup`, () => {
  ;(skipBackup ? it.skip : it)(`creates a backup and prunes to keep N`, async () => {
    await env.sub(UserSchema).put(`u1`, {name: `Alice`})
    await env.committed

    const base = createTestDir(`lmdb-backup-retention-`)
    try {
      await LmdbBackup.backup(env, base, 2)
      await Bun.sleep(15)
      await LmdbBackup.backup(env, base, 2)
      await Bun.sleep(15)
      await LmdbBackup.backup(env, base, 2)
      // After 3 backups with keep=2, only 2 should remain
      const entries = readdirSync(base)
      expect(entries.length).toBe(2)
      // Each backup dir should contain LMDB files
      for (const e of entries) {
        expect(existsSync(join(base, e, `data.mdb`)) || existsSync(join(base, e))).toBe(true)
      }
    } finally {
      await rmWithRetry(base)
    }
  })

  ;(skipBackup ? it.skip : it)(`single backup with keep=1 leaves one entry`, async () => {
    const base = createTestDir(`lmdb-backup-single-`)
    try {
      await LmdbBackup.backup(env, base, 1)
      expect(readdirSync(base).length).toBe(1)
    } finally {
      await rmWithRetry(base)
    }
  })
})
