/**
 * Integration tests for the LmdbEnv class with real LMDB.
 *
 * Uses a temp directory per test for isolation. Exercises env lifecycle,
 * state transitions, repository registration, duplicate detection, and the
 * read-only code path.
 */
import {describe, it, expect, beforeEach, afterEach} from "bun:test"
import {existsSync, mkdtempSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"

import {LmdbEnv} from "../src/env"
import {LmdbRepository} from "../src/repository"
import {
  LmdbEnvNotOpenError,
  LmdbDuplicateDbNameError,
  LmdbMissingDbNameError,
  LmdbReadOnlyError,
  LmdbRepositoryAlreadyRegisteredError,
  LmdbRepositoryNotRegisteredError
} from "../src/errors"
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
  tmpDir = mkdtempSync(join(tmpdir(), `lmdb-env-test-`))
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  await env.open()
})

afterEach(async () => {
  if (env.state !== `closed`) {
    await env.close()
  }
  await rmWithRetry(tmpDir)
})

describe(`LmdbEnv constructor`, () => {
  it(`stores options as readonly fields`, () => {
    expect(env.path).toBe(tmpDir)
    expect(env.maxDbs).toBe(5)
    expect(env.compression).toBe(false)
    expect(env.readOnly).toBe(false)
    expect(env.maxReaders).toBe(126)
    expect(env.mapSize).toBe(268435456)
  })

  it(`applies default values when options are omitted`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `lmdb-env-defaults-`))
    const e = new LmdbEnv({path: dir})
    await e.open()
    try {
      expect(e.maxDbs).toBe(10)
      expect(e.compression).toBe(false)
      expect(e.readOnly).toBe(false)
      expect(e.maxReaders).toBe(126)
      expect(e.mapSize).toBe(268435456)
    } finally {
      await e.close()
      await rmWithRetry(dir)
    }
  })
})

describe(`LmdbEnv.open / close`, () => {
  it(`starts in 'closed' state`, () => {
    const e = new LmdbEnv({path: tmpDir})
    expect(e.state).toBe(`closed`)
  })

  it(`transitions to 'open' after open()`, async () => {
    const e = new LmdbEnv({path: tmpDir})
    await e.open()
    expect(e.state).toBe(`open`)
    await e.close()
  })

  it(`open is idempotent on an already-open env`, async () => {
    expect(env.state).toBe(`open`)
    await env.open()
    expect(env.state).toBe(`open`)
  })

  it(`close is idempotent on an already-closed env`, async () => {
    await env.close()
    expect(env.state).toBe(`closed`)
    await env.close()
    expect(env.state).toBe(`closed`)
  })

  it(`creates the data directory if it does not exist`, async () => {
    const freshDir = join(tmpDir, `nested`, `data`)
    expect(existsSync(freshDir)).toBe(false)
    const e = new LmdbEnv({path: freshDir})
    await e.open()
    await e.close()
  })

  it(`operations on a closed env throw LmdbEnvNotOpenError`, async () => {
    const e = new LmdbEnv({path: tmpDir})
    expect(() => e.getDb(`x`)).toThrow(LmdbEnvNotOpenError)
  })

  it(`operations after close throw LmdbEnvNotOpenError`, async () => {
    await env.close()
    expect(() => env.getDb(`x`)).toThrow(LmdbEnvNotOpenError)
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
    const dir = mkdtempSync(join(tmpdir(), `lmdb-env-readonly-`))
    const writeEnv = new LmdbEnv({path: dir})
    await writeEnv.open()
    const users = writeEnv.register(UserRepo)
    await users.set(`u1`, {id: `u1`, name: `A`})
    await writeEnv.close()

    const roEnv = new LmdbEnv({path: dir, readOnly: true})
    await roEnv.open()
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
    const dir = mkdtempSync(join(tmpdir(), `lmdb-env-readonly-tx-`))
    const writeEnv = new LmdbEnv({path: dir})
    await writeEnv.open()
    await writeEnv.close()

    const roEnv = new LmdbEnv({path: dir, readOnly: true})
    await roEnv.open()
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
  it(`transitions through 'closing' and ends at 'closed'`, async () => {
    await env.close()
    expect(env.state).toBe(`closed`)
  })

  it(`getDb throws after close`, async () => {
    await env.close()
    expect(() => env.getDb(`anything`)).toThrow(LmdbEnvNotOpenError)
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

  it(`backup writes a copy that reopens cleanly`, async () => {
    const r = env.register(SimpleRepo)
    await r.set(`bk1`, 100)
    await r.set(`bk2`, 200)

    const destDir = mkdtempSync(join(tmpdir(), `lmdb-backup-test-`))
    try {
      await env.backup(destDir)

      const reopenEnv = new LmdbEnv({path: destDir, maxDbs: 5})
      try {
        await reopenEnv.open()
        const reopenRepo = reopenEnv.register(SimpleRepo)
        expect(await reopenRepo.get(`bk1`)).toBe(100)
        expect(await reopenRepo.get(`bk2`)).toBe(200)
      } finally {
        await reopenEnv.close()
      }
    } finally {
      await rmWithRetry(destDir)
    }
  })
})