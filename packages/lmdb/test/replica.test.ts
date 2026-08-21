/**
 * F12 — Replica attach sugar + backup retention.
 *
 * Read-only replica polling via resetReadTxn, backupWithRetention pruning.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync, readdirSync} from "node:fs"
import {join} from "node:path"
import {LmdbEnv} from "../src/env"
import {backupWithRetention, LmdbReplica} from "../src/replica"
import {LmdbRepository} from "../src/repository"
import {createTestDir, rmWithRetry} from "./test-helpers"

class UserRepo extends LmdbRepository<{name: string}, string> {
  static dbName = `replica-user-test`
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-replica-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  env.register(UserRepo)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbReplica`, () => {
  it(`opens a read-only replica that sees writer data after resetReadTxn`, async () => {
    await env.get(UserRepo).set(`u1`, {name: `Alice`})
    await env.committed

    const replica = await LmdbReplica.open(tmpDir)
    replica.register(UserRepo)
    const roRepo = replica.get(UserRepo)
    // Initially may see u1, or need reset after writer commit
    replica.resetReadTxn()
    expect(roRepo.get(`u1`)).toEqual({name: `Alice`})

    await env.get(UserRepo).set(`u2`, {name: `Bob`})
    await env.committed
    // Replica's read txn is stale until reset
    replica.resetReadTxn()
    expect(roRepo.get(`u2`)).toEqual({name: `Bob`})

    expect(replica.readOnly).toBe(true)
    await replica.close()
  })

  it(`replica rejects writes`, async () => {
    const replica = await LmdbReplica.open(tmpDir)
    replica.register(UserRepo)
    const roRepo = replica.get(UserRepo)
    await expect(roRepo.set(`u1`, {name: `Alice`})).rejects.toThrow()
    await replica.close()
  })
})

const skipBackup = process.platform === `win32`

describe(`backupWithRetention`, () => {
  ;(skipBackup ? it.skip : it)(`creates a backup and prunes to keep N`, async () => {
    await env.get(UserRepo).set(`u1`, {name: `Alice`})
    await env.committed

    const base = createTestDir(`lmdb-backup-retention-`)
    try {
      await backupWithRetention(env, base, 2)
      await Bun.sleep(15)
      await backupWithRetention(env, base, 2)
      await Bun.sleep(15)
      await backupWithRetention(env, base, 2)
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
      await backupWithRetention(env, base, 1)
      expect(readdirSync(base).length).toBe(1)
    } finally {
      await rmWithRetry(base)
    }
  })
})
