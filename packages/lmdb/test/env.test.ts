/**
 * Integration tests for the LmdbEnv class with real LMDB.
 *
 * Uses a temp directory per test for isolation. Exercises env lifecycle,
 * state transitions, repository registration, duplicate detection, and the
 * read-only code path.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {basename, extname, join} from "node:path"
import * as lmdbNs from "lmdb"
import {LmdbEnv} from "../src/env"
import {LmdbDuplicateDbNameError, LmdbEnvClosedError, LmdbError, LmdbReadOnlyError, LmdbSchemaAlreadyRegisteredError, LmdbSchemaNotRegisteredError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

// `allDbs` is a runtime-only export of lmdb-js (absent from its d.ts).
const allDbs = (lmdbNs as unknown as {allDbs: Map<string, unknown>}).allDbs

class UserSchema extends LmdbSchema {
  static db = `env-test-user`
  static key = t.string()
  static value = {
    id: t.string(),
    name: t.string()
  }
}

class SessionSchema extends LmdbSchema {
  static db = `env-test-session`
  static key = t.string()
  static value = {
    sid: t.string(),
    data: t.string()
  }
}

class MissingDbNameSchema extends LmdbSchema {
  static key = t.string()
  static value = {
    v: t.string()
  }
}

class SameDbNameSchema extends LmdbSchema {
  static db = `env-test-user` // collides with UserSchema
  static key = t.string()
  static value = {
    v: t.string()
  }
}

class EnvTestSimpleSchema extends LmdbSchema {
  static db = `env-test-simple`
  static key = t.string()
  static value = t.number()
}

let tmpDir: string
let env: LmdbEnv

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-env-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  env.register(EnvTestSimpleSchema)
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
      expect(e.maxDbs).toBe(128)
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
  it(`register returns a typed LmdbEnvSub handle`, () => {
    env.register(UserSchema)
    expect(env.sub(UserSchema).dbName).toBe(`env-test-user`)
  })

  it(`sub returns the same instance for the same schema class`, () => {
    env.register(UserSchema)
    const a = env.sub(UserSchema)
    const b = env.sub(UserSchema)
    expect(a).toBe(b)
  })

  it(`isRegistered returns true after register, false before`, () => {
    expect(env.isRegistered(UserSchema)).toBe(false)
    env.register(UserSchema)
    expect(env.isRegistered(UserSchema)).toBe(true)
  })

  it(`sub throws LmdbSchemaNotRegisteredError for unknown schema class`, () => {
    expect(() => env.sub(SessionSchema)).toThrow(LmdbSchemaNotRegisteredError)
  })

  it(`registering the same schema class twice throws`, () => {
    env.register(UserSchema)
    expect(() => env.register(UserSchema)).toThrow(LmdbSchemaAlreadyRegisteredError)
  })

  it(`register rejects a schema without static db`, () => {
    expect(() => env.register(MissingDbNameSchema)).toThrow(LmdbError)
  })

  it(`register rejects collision with an existing dbName`, () => {
    env.register(UserSchema)
    expect(() => env.register(SameDbNameSchema)).toThrow(LmdbDuplicateDbNameError)
  })

  it(`two different schemas with distinct dbNames can coexist`, async () => {
    env.register(UserSchema)
    env.register(SessionSchema)
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `Alice`})
    await env.sub(SessionSchema).put(`s1`, {sid: `s1`, data: `hello`})
    expect((await env.sub(UserSchema).get(`u1`))?.name).toBe(`Alice`)
    expect((await env.sub(SessionSchema).get(`s1`))?.data).toBe(`hello`)
  })
})

describe(`LmdbEnv read-only mode`, () => {
  it(`readOnly option is stored and enforced`, async () => {
    const dir = createTestDir(`lmdb-env-readonly-`)
    const writeEnv = new LmdbEnv({path: dir})
    writeEnv.register(UserSchema)
    await writeEnv.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`})
    await writeEnv.close()

    const roEnv = new LmdbEnv({path: dir, readOnly: true})
    try {
      expect(roEnv.readOnly).toBe(true)
      roEnv.register(UserSchema)
      expect(roEnv.sub(UserSchema).get(`u1`)?.name).toBe(`A`)
      await expect(roEnv.sub(UserSchema).put(`u2`, {id: `u2`, name: `B`})).rejects.toThrow(LmdbReadOnlyError)
      await expect(roEnv.sub(UserSchema).delete(`u1`)).rejects.toThrow(LmdbReadOnlyError)
      await expect(roEnv.sub(UserSchema).clear()).rejects.toThrow(LmdbReadOnlyError)
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
    reopen.register(EnvTestSimpleSchema)
    await reopen.sub(EnvTestSimpleSchema).put(`reopened`, 42)
    expect(reopen.sub(EnvTestSimpleSchema).get(`reopened`)).toBe(42)
    await reopen.close()
  })
})

describe(`LmdbEnv operations after close`, () => {
  beforeEach(async () => {
    await env.close()
  })

  it(`register throws LmdbEnvClosedError`, () => {
    expect(() => env.register(UserSchema)).toThrow(LmdbEnvClosedError)
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

  it(`env-level data ops throw LmdbEnvClosedError (B2)`, () => {
    expect(() => env.rootGetEntry(`k`)).toThrow(LmdbEnvClosedError)
    expect(() => env.rootGetRange()).toThrow(LmdbEnvClosedError)
    expect(() => env.rootGetCount()).toThrow(LmdbEnvClosedError)
    expect(() => env.rootDoesExist(`k`)).toThrow(LmdbEnvClosedError)
    expect(() => env.rootGetKeys()).toThrow(LmdbEnvClosedError)
    expect(() => env.openDB(`x`)).toThrow(LmdbEnvClosedError)
  })

  it(`transaction on a closed read-only env throws LmdbEnvClosedError, not LmdbReadOnlyError (B9)`, async () => {
    const roEnv = new LmdbEnv({path: env.path, maxDbs: 5, readOnly: true})
    await roEnv.close()
    await expect(roEnv.transaction(() => {})).rejects.toThrow(LmdbEnvClosedError)
  })
})

describe(`LmdbEnv.close resource cleanup`, () => {
  it(`L2: close() removes this env's keys from lmdb-js allDbs`, async () => {
    const dir = createTestDir(`lmdb-env-alldbs-`)
    const e = new LmdbEnv({path: dir, maxDbs: 5})
    e.register(UserSchema)
    e.register(SessionSchema)
    const key = basename(dir, extname(dir))
    const before = Array.from(allDbs.keys()).filter((n) => n.startsWith(key))
    expect(before.length).toBe(3) // root + user + session sub-DB stores

    await e.close()
    const after = Array.from(allDbs.keys()).filter((n) => n.startsWith(key))
    expect(after.length).toBe(0)
  })

  it(`C1: close() of one env does not remove another env's allDbs entries with the same basename`, async () => {
    const dirA = createTestDir(`lmdb-env-cross-a-`)
    const dirB = createTestDir(`lmdb-env-cross-b-`)
    const pathA = join(dirA, `store`)
    const pathB = join(dirB, `store`)
    const envA = new LmdbEnv({path: pathA, maxDbs: 5})
    const envB = new LmdbEnv({path: pathB, maxDbs: 5})
    envA.register(UserSchema)
    envB.register(SessionSchema)
    // envB opened last, so the shared root entry now points at envB's store
    const sharedRoot = allDbs.get(`store`)
    const envBStore = (envB as unknown as {_root: unknown})._root
    expect(sharedRoot).toBe(envBStore)

    await envA.close()

    // envB's root entry must survive envA's purge (identity check)
    expect(allDbs.has(`store`)).toBe(true)
    // envB's sub-DB entry must survive too
    expect(allDbs.has(`store-env-test-session`)).toBe(true)

    await envB.close()
    await rmWithRetry(dirA)
    await rmWithRetry(dirB)
  })

  it(`L3: getDb returns the same handle for repeated calls (same name+encoding)`, () => {
    const db1 = env.getDb(`audit-user`)
    const db2 = env.getDb(`audit-user`)
    expect(db1).toBe(db2)
  })

  it(`L3: getDb caches per encoding — different encodings get distinct handles`, () => {
    const db1 = env.getDb(`audit-user`)
    const db2 = env.getDb(`audit-user`, `json`)
    expect(db1).not.toBe(db2)
  })

  it(`L5: off() stops a previously attached commit listener`, async () => {
    env.register(UserSchema)
    let calls = 0
    const cb = () => {
      calls++
    }
    env.on(`beforecommit`, cb as any)
    env.off(`beforecommit`, cb as any)
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`})
    await env.committed
    expect(calls).toBe(0)
  })

  it(`L5: listener attached and not removed still fires`, async () => {
    env.register(UserSchema)
    let calls = 0
    const cb = () => {
      calls++
    }
    env.on(`beforecommit`, cb as any)
    await env.sub(UserSchema).put(`u1`, {id: `u1`, name: `A`})
    await env.committed
    expect(calls).toBeGreaterThan(0)
  })
})

describe(`LmdbEnv.put with options`, () => {
  it(`put(id, value, {noOverwrite}) works and respects noOverwrite`, async () => {
    expect(await env.rootPut(`k`, {v: 1})).toBe(true)
    expect(await env.rootPut(`k`, {v: 2}, {noOverwrite: true} as any)).toBe(false)
    expect(env.rootGetEntry(`k`)).toEqual({value: {v: 1}})
  })
})

describe(`LmdbEnv snapshot / durability`, () => {
  it(`committed resolves after a put`, async () => {
    await env.sub(EnvTestSimpleSchema).put(`a`, 1)
    await env.committed
    expect(await env.sub(EnvTestSimpleSchema).get(`a`)).toBe(1)
  })

  it(`flushed resolves after a put`, async () => {
    await env.sub(EnvTestSimpleSchema).put(`b`, 2)
    await env.flushed
    expect(await env.sub(EnvTestSimpleSchema).get(`b`)).toBe(2)
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
    await env.sub(EnvTestSimpleSchema).put(`bk1`, 100)
    await env.sub(EnvTestSimpleSchema).put(`bk2`, 200)

    const backupBase = createTestDir(`lmdb-backup-test-`)
    const destDir = join(backupBase, `snapshot`) // must not already exist
    try {
      await env.backup(destDir)

      const reopenEnv = new LmdbEnv({path: destDir, maxDbs: 5})
      try {
        reopenEnv.register(EnvTestSimpleSchema)
        expect(reopenEnv.sub(EnvTestSimpleSchema).get(`bk1`)).toBe(100)
        expect(reopenEnv.sub(EnvTestSimpleSchema).get(`bk2`)).toBe(200)
      } finally {
        await reopenEnv.close()
      }
    } finally {
      await rmWithRetry(backupBase)
    }
  })
})
