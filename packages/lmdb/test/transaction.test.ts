/**
 * Integration tests for LmdbTransaction lifecycle with real LMDB.
 *
 * Tests the wrapper around `lmdb`'s callback-based transaction model.
 * - `env.transaction(fn)` wraps `rootDb.childTransaction(callback)`. The
 *   wrapper detects `tx.abort()` and returns the LMDB `ABORT` sentinel;
 *   otherwise returns the result normally and LMDB commits.
 * - `env.readTransaction(fn)` wraps `rootDb.useReadTransaction()`. The raw
 *   LMDB read transaction is released when the wrapper finalizes.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {createTestDir} from "./test-helpers"

import {LmdbEnv} from "../src/env"
import {LmdbTransactionDoneError, LmdbTransactionError} from "../src/errors"
import {LmdbRepository} from "../src/repository"
import {LmdbTransaction} from "../src/transaction"
import {rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
}

interface Session {
  id: string
  userId: string
}

class UserRepository extends LmdbRepository<User, string> {
  static dbName = `user-tx`
}

class SessionRepository extends LmdbRepository<Session, string> {
  static dbName = `session-tx`
}

let tmpDir: string
let env: LmdbEnv
let userRepo: UserRepository
let sessionRepo: SessionRepository

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-tx-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  userRepo = env.register(UserRepository)
  sessionRepo = env.register(SessionRepository)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbTransaction lifecycle (write via env.transaction)`, () => {
  it(`commits writes to both repositories atomically`, async () => {
    await env.transaction(() => {
      userRepo.set(`u1`, {id: `u1`, name: `Alice`})
      sessionRepo.set(`s1`, {id: `s1`, userId: `u1`})
    })

    expect(await userRepo.get(`u1`)).toEqual({id: `u1`, name: `Alice`})
    expect(await sessionRepo.get(`s1`)).toEqual({id: `s1`, userId: `u1`})
  })

  it(`marks the wrapper as committed after tx.commit()`, async () => {
    const tx = await env.transaction((tx) => {
      userRepo.set(`u1`, {id: `u1`, name: `Bob`})
      tx.commit()
      return tx
    })
    expect(tx.done).toBe(true)
    expect(tx.isCommitted).toBe(true)
    expect(tx.isAborted).toBe(false)
    expect(tx.lifecycle).toBe(`committed`)
  })

  it(`throws when commit is called twice`, async () => {
    const tx = await env.transaction((tx) => {
      userRepo.set(`u1`, {id: `u1`, name: `X`})
      tx.commit()
      return tx
    })
    expect(() => tx.commit()).toThrow(LmdbTransactionDoneError)
  })

  it(`commit on already-done tx throws LmdbTransactionDoneError`, async () => {
    const tx = await env.transaction((tx) => {
      tx.abort()
      return tx
    })
    expect(() => tx.commit()).toThrow(LmdbTransactionDoneError)
  })
})

describe(`LmdbTransaction abort (write via env.transaction)`, () => {
  it(`rolls back writes when tx.abort() is called inside the callback`, async () => {
    await env.transaction((tx) => {
      userRepo.set(`u1`, {id: `u1`, name: `Rolled`})
      sessionRepo.set(`s1`, {id: `s1`, userId: `u1`})
      tx.abort()
    })

    expect(await userRepo.get(`u1`)).toBeUndefined()
    expect(await sessionRepo.get(`s1`)).toBeUndefined()
  })

  it(`marks the wrapper as aborted after tx.abort()`, async () => {
    const tx = await env.transaction((tx) => {
      tx.abort()
      return tx
    })
    expect(tx.done).toBe(true)
    expect(tx.isAborted).toBe(true)
    expect(tx.isCommitted).toBe(false)
    expect(tx.lifecycle).toBe(`aborted`)
  })

  it(`abort is idempotent — second call is a no-op`, async () => {
    const tx = await env.transaction((tx) => {
      tx.abort()
      return tx
    })
    expect(() => tx.abort()).not.toThrow()
    expect(tx.done).toBe(true)
  })

  it(`env.transaction wraps user throws in LmdbTransactionError`, async () => {
    try {
      await env.transaction(() => {
        userRepo.set(`u1`, {id: `u1`, name: `Ghost`})
        throw new Error(`intentional`)
      })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(LmdbTransactionError)
      expect((e as LmdbTransactionError).cause).toBeInstanceOf(Error)
      expect(((e as LmdbTransactionError).cause as Error).message).toBe(`intentional`)
    }
  })

  it(`rollback on throw is atomic — neither repo's writes survive`, async () => {
    await userRepo.set(`existing`, {id: `existing`, name: `Pre`})

    try {
      await env.transaction(() => {
        userRepo.set(`existing`, {id: `existing`, name: `Should rollback`})
        sessionRepo.set(`new-session`, {id: `new-session`, userId: `existing`})
        throw new Error(`fail`)
      })
    } catch {
      // expected
    }

    expect((await userRepo.get(`existing`))?.name).toBe(`Pre`)
    expect(await sessionRepo.get(`new-session`)).toBeUndefined()
  })
})

describe(`LmdbTransaction.done flag`, () => {
  it(`starts as 'active' (done === false)`, () => {
    const tx = new LmdbTransaction()
    expect(tx.done).toBe(false)
    expect(tx.lifecycle).toBe(`active`)
    expect(tx.isCommitted).toBe(false)
    expect(tx.isAborted).toBe(false)
  })
})

describe(`env.transaction with async callbacks`, () => {
  it(`commits async callback writes atomically and returns the value`, async () => {
    const result = await env.transaction(async () => {
      await userRepo.set(`u1`, {id: `u1`, name: `Async`})
      await sessionRepo.set(`s1`, {id: `s1`, userId: `u1`})
      return {ok: true}
    })
    expect(result).toEqual({ok: true})
    expect(await userRepo.get(`u1`)).toEqual({id: `u1`, name: `Async`})
    expect(await sessionRepo.get(`s1`)).toEqual({id: `s1`, userId: `u1`})
  })

  it(`tx.abort() after an await rolls back all writes`, async () => {
    await userRepo.set(`existing`, {id: `existing`, name: `Pre`})
    await env.transaction(async (tx) => {
      await userRepo.set(`existing`, {id: `existing`, name: `Ghost`})
      await sessionRepo.set(`s1`, {id: `s1`, userId: `existing`})
      tx.abort()
    })
    expect((await userRepo.get(`existing`))?.name).toBe(`Pre`)
    expect(await sessionRepo.get(`s1`)).toBeUndefined()
  })

  it(`tx.abort() before the first await rolls back`, async () => {
    await env.transaction(async (tx) => {
      tx.abort()
      await userRepo.set(`u3`, {id: `u3`, name: `Aborted`})
    })
    expect(await userRepo.get(`u3`)).toBeUndefined()
  })

  it(`async throw after an await rolls back and wraps in LmdbTransactionError`, async () => {
    try {
      await env.transaction(async () => {
        await userRepo.set(`u2`, {id: `u2`, name: `Partial`})
        throw new Error(`async boom`)
      })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(LmdbTransactionError)
      expect((e as LmdbTransactionError).cause).toBeInstanceOf(Error)
      expect(((e as LmdbTransactionError).cause as Error).message).toBe(`async boom`)
    }
    expect(await userRepo.get(`u2`)).toBeUndefined()
  })
})

describe(`env.readTransaction`, () => {
  it(`reads committed data via snapshot`, async () => {
    await userRepo.set(`u1`, {id: `u1`, name: `Carol`})

    const snapshot = await env.readTransaction(async (tx) => {
      return await userRepo.get(`u1`, tx)
    })
    expect(snapshot).toEqual({id: `u1`, name: `Carol`})
  })

  it(`finalizes the read txn after callback resolves`, async () => {
    const tx = await env.readTransaction(async (tx) => {
      await userRepo.get(`u1`, tx)
      return tx
    })
    expect(tx.done).toBe(true)
    expect(tx.isAborted).toBe(true)
  })

  it(`read transaction sees writes committed before env.readTransaction started`, async () => {
    await userRepo.set(`u1`, {id: `u1`, name: `Before`})

    const entries = await env.readTransaction(async (tx) => {
      return await userRepo.entries({}, tx)
    })
    expect(entries).toEqual([[`u1`, {id: `u1`, name: `Before`}]])
  })

  it(`readTransaction releases raw txn even on error`, async () => {
    let captured: LmdbTransaction | undefined
    try {
      await env.readTransaction(async (tx) => {
        captured = tx
        throw new Error(`read-fail`)
      })
      expect.unreachable()
    } catch (e) {
      expect((e as Error).message).toBe(`read-fail`)
    }
    expect(captured?.done).toBe(true)
  })
})

describe(`env.readTransaction raw txn release`, () => {
  it(`releases raw read txn even when user calls tx.commit() inside`, async () => {
    await userRepo.set(`u1`, {id: `u1`, name: `A`})
    const before = env.readerList().split(`\n`).filter(Boolean).length
    await env.readTransaction(async (tx) => {
      await userRepo.get(`u1`, tx)
      tx.commit()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    const after = env.readerList().split(`\n`).filter(Boolean).length
    expect(after).toBe(before)
  })

  it(`tx.abort() inside readTransaction still releases exactly once`, async () => {
    await userRepo.set(`u1`, {id: `u1`, name: `A`})
    const before = env.readerList().split(`\n`).filter(Boolean).length
    await env.readTransaction(async (tx) => {
      await userRepo.get(`u1`, tx)
      tx.abort()
      tx.abort()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(env.readerList().split(`\n`).filter(Boolean).length).toBe(before)
  })
})

describe(`read-only env transactions`, () => {
  it(`readTransaction works on read-only envs`, async () => {
    const dir = createTestDir(`lmdb-readonly-tx-`)
    const writeEnv = new LmdbEnv({path: dir, maxDbs: 5})
    const writeUsers = writeEnv.register(UserRepository)
    await writeUsers.set(`u1`, {id: `u1`, name: `Initial`})
    await writeEnv.close()

    const roEnv = new LmdbEnv({path: dir, maxDbs: 5, readOnly: true})
    try {
      const roUsers = roEnv.register(UserRepository)
      const got = await roEnv.readTransaction(async (tx) => {
        return await roUsers.get(`u1`, tx)
      })
      expect(got).toEqual({id: `u1`, name: `Initial`})
    } finally {
      await roEnv.close()
      await rmWithRetry(dir)
    }
  })
})
