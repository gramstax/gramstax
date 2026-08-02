/**
 * Integration tests for the LmdbEnv class with real LMDB.
 *
 * Uses a temp directory per test for isolation. Exercises env lifecycle,
 * state transitions, repository registration, duplicate detection, and the
 * read-only code path.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {join} from "node:path"
import {createTestDir} from "./test-helpers"

import {LmdbEnv} from "../src/env"
import {LmdbDuplicateDbNameError, LmdbEnvClosedError, LmdbMissingDbNameError, LmdbReadOnlyError, LmdbRepositoryAlreadyRegisteredError, LmdbRepositoryNotRegisteredError} from "../src/errors"
import {LmdbRepository} from "../src/repository"
import {rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
}

class UserRepo extends LmdbRepository<User, string> {
  static dbName = `env-test-user`
}

class SessionRepo extends LmdbRepository<{sid: string; data: string}, string> {
  static dbName = `env-test-session`
}

class SimpleRepo extends LmdbRepository<number, string> {
  static dbName = `env-test-simple`
}

class MissingDbNameRepo extends LmdbRepository {}

class SameDbNameRepo extends LmdbRepository {
  static dbName = `env-test-user` // collides with UserRepo
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-env-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  // env opens on construction
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

describe(`LmdbEnv constructor`, () => {
  it(`stores path, maxDbs, readOnly, encoding`, () => {
    expect(env.path).toBe(tmpDir)
    expect(env.maxDbs).toBe(5)
    expect(env.readOnly).toBe(false)
    expect(env.encoding).toBeUndefined()
  })

  it(`applies default values when options are omitted`, async () => {
    const dir = createTestDir(`lmdb-env-defaults-`)
    const e = new LmdbEnv({path: dir})
    try {
      expect(e.maxDbs).toBe(10)
      expect(e.readOnly).toBe(false)
      expect(e.encoding).toBeUndefined()
    } finally {
      await e.close()
      await rmWithRetry(dir)
    }
  })
})

describe(`LmdbEnv.open / close`, () => {
  it(`is open immediately after construction`, async () => {
    const e = new LmdbEnv({path: tmpDir})
    expect(e.state).toBe(`open`)
    await e.close()
  })

  it(`close is idempotent on an already-closed env`, async () => {
    await env.close()
    expect(env.state).toBe(`closed`)
    await env.close()
    expect(env.state).toBe(`closed`)
  })

  it(`opens without error when the data directory does not yet exist`, async () => {
    const freshDir = join(tmpDir, `nested`, `data`)
    expect(existsSync(freshDir)).toBe(false)
    const e = new LmdbEnv({path: freshDir})
    expect(e.state).toBe(`open`)
    await e.close()
  })

  it(`getDb returns a usable handle after construction`, async () => {
    const db = env.getDb(`probe-db`)
    expect(db).toBeDefined()
    await db.put(`k`, `v`)
    expect(await db.get(`k`)).toBe(`v`)
  })
})

describe(`LmdbEnv.register / get / has`, () => {
  it(`register returns a typed LmdbRepository instance`, () => {
    const users = env.register(UserRepo)
    expect(users).toBeInstanceOf(UserRepo)
  })

  it(`get returns the same instance for the same class`, () => {
    const a = env.register(UserRepo)
    const b = env.get(UserRepo)
    expect(a).toBe(b)
  })

  it(`has returns true after register, false before`, () => {
    expect(env.has(UserRepo)).toBe(false)
    env.register(UserRepo)
    expect(env.has(UserRepo)).toBe(true)
  })

  it(`get throws LmdbRepositoryNotRegisteredError for unknown class`, () => {
    expect(() => env.get(SessionRepo)).toThrow(LmdbRepositoryNotRegisteredError)
  })

  it(`registering the same class twice throws`, () => {
    env.register(UserRepo)
    expect(() => env.register(UserRepo)).toThrow(LmdbRepositoryAlreadyRegisteredError)
  })

  it(`register rejects LmdbRepository without static dbName`, () => {
    expect(() => env.register(MissingDbNameRepo)).toThrow(LmdbMissingDbNameError)
  })

  it(`register rejects collision with an existing dbName`, () => {
    env.register(UserRepo)
    expect(() => env.register(SameDbNameRepo)).toThrow(LmdbDuplicateDbNameError)
  })

  it(`two different classes with distinct dbNames can coexist`, async () => {
    const users = env.register(UserRepo)
    const sessions = env.register(SessionRepo)
    await users.set(`u1`, {id: `u1`, name: `Alice`})
    await sessions.set(`s1`, {sid: `s1`, data: `hello`})
    expect((await users.get(`u1`))?.name).toBe(`Alice`)
    expect((await sessions.get(`s1`))?.data).toBe(`hello`)
  })
})

describe(`LmdbEnv read-only mode`, () => {
  it(`readOnly option is stored and enforced`, async () => {
    const dir = createTestDir(`lmdb-env-readonly-`)
    const writeEnv = new LmdbEnv({path: dir})
    const users = writeEnv.register(UserRepo)
    await users.set(`u1`, {id: `u1`, name: `A`})
    await writeEnv.close()

    const roEnv = new LmdbEnv({path: dir, readOnly: true})
    try {
      expect(roEnv.readOnly).toBe(true)
      const roUsers = roEnv.register(UserRepo)
      expect((await roUsers.get(`u1`))?.name).toBe(`A`)
      await expect(roUsers.set(`u2`, {id: `u2`, name: `B`})).rejects.toThrow(LmdbReadOnlyError)
      await expect(roUsers.delete(`u1`)).rejects.toThrow(LmdbReadOnlyError)
      await expect(roUsers.clear()).rejects.toThrow(LmdbReadOnlyError)
    } finally {
      await roEnv.close()
      await rmWithRetry(dir)
    }
  })

  it(`env.transaction rejects read-only envs`, async () => {
    const dir = createTestDir(`lmdb-env-readonly-tx-`)
    const writeEnv = new LmdbEnv({path: dir})
    await writeEnv.close()

    const roEnv = new LmdbEnv({path: dir, readOnly: true})
    try {
      await expect(
        roEnv.transaction(async () => {
          // never runs
        })
      ).rejects.toThrow(LmdbReadOnlyError)
    } finally {
      await roEnv.close()
      await rmWithRetry(dir)
    }
  })
})

describe(`LmdbEnv state after close`, () => {
  it(`transitions to 'closed' after close`, async () => {
    await env.close()
    expect(env.state).toBe(`closed`)
  })

  it(`reopen after close works on a fresh env`, async () => {
    await env.close()
    const reopen = new LmdbEnv({path: tmpDir, maxDbs: 5})
    expect(reopen.state).toBe(`open`)
    const r = reopen.register(SimpleRepo)
    await r.set(`reopened`, 42)
    expect(await r.get(`reopened`)).toBe(42)
    await reopen.close()
  })
})

describe(`LmdbEnv operations after close`, () => {
  beforeEach(async () => {
    await env.close()
  })

  it(`register throws LmdbEnvClosedError`, () => {
    expect(() => env.register(UserRepo)).toThrow(LmdbEnvClosedError)
  })

  it(`getDb throws LmdbEnvClosedError`, () => {
    expect(() => env.getDb(`x`)).toThrow(LmdbEnvClosedError)
  })

  it(`transaction throws LmdbEnvClosedError`, async () => {
    await expect(env.transaction(() => {})).rejects.toThrow(LmdbEnvClosedError)
  })

  it(`readTransaction throws LmdbEnvClosedError`, async () => {
    await expect(env.readTransaction(async () => {})).rejects.toThrow(LmdbEnvClosedError)
  })

  it(`backup throws LmdbEnvClosedError`, async () => {
    await expect(env.backup(`somewhere`)).rejects.toThrow(LmdbEnvClosedError)
  })
})

describe(`LmdbEnv snapshot / durability`, () => {
  it(`committed resolves after a set`, async () => {
    const r = env.register(SimpleRepo)
    await r.set(`a`, 1)
    await env.committed
    expect(await r.get(`a`)).toBe(1)
  })

  it(`flushed resolves after a set`, async () => {
    const r = env.register(SimpleRepo)
    await r.set(`b`, 2)
    await env.flushed
    expect(await r.get(`b`)).toBe(2)
  })

  it(`committed / flushed are safe before any writes (resolves immediately)`, async () => {
    await Promise.resolve(env.committed)
    await Promise.resolve(env.flushed)
  })

  it(`resetReadTxn does not throw`, () => {
    expect(() => env.resetReadTxn()).not.toThrow()
  })

  it(`resetReadTxn is a no-op after close`, async () => {
    await env.close()
    expect(() => env.resetReadTxn()).not.toThrow()
  })

  // backup is flaky on Windows (LMDB native mmap file-lock race)
  // and on GitHub Actions CI (overlayfs incompatibility).
  // Consistently passes on bare-metal Linux/macOS.
  const skipBackup = process.platform === `win32` || process.env.CI === `true`
  ;(skipBackup ? it.skip : it)(`backup writes a copy that reopens cleanly`, async () => {
    const r = env.register(SimpleRepo)
    await r.set(`bk1`, 100)
    await r.set(`bk2`, 200)

    const backupBase = createTestDir(`lmdb-backup-test-`)
    const destDir = join(backupBase, `snapshot`) // must not already exist
    try {
      await env.backup(destDir)

      const reopenEnv = new LmdbEnv({path: destDir, maxDbs: 5})
      try {
        const reopenRepo = reopenEnv.register(SimpleRepo)
        expect(reopenRepo.get(`bk1`)).toBe(100)
        expect(reopenRepo.get(`bk2`)).toBe(200)
      } finally {
        await reopenEnv.close()
      }
    } finally {
      await rmWithRetry(backupBase)
    }
  })
})
