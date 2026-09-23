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
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"
import {LmdbTransaction} from "../src/transaction"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface User {
  id: string
  name: string
}

interface Session {
  id: string
  userId: string
}

class UserSchema extends LmdbSchema {
  static db = `user-tx`
  static key = t.string()
  static value = t.object<User>()
}

class SessionSchema extends LmdbSchema {
  static db = `session-tx`
  static key = t.string()
  static value = t.object<Session>()
}

class IndexedUserSchema extends LmdbSchema {
  static db = `user-idx-tx`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index()
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

let tmpDir: string
let env: LmdbEnv
let userRepo: LmdbEnvSub<typeof UserSchema>
let sessionRepo: LmdbEnvSub<typeof SessionSchema>
let indexedRepo: LmdbEnvSub<typeof IndexedUserSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-tx-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 5})
  userRepo = env.register(UserSchema)
  sessionRepo = env.register(SessionSchema)
  indexedRepo = env.register(IndexedUserSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbTransaction lifecycle (write via env.transaction)`, () => {
  it(`commits writes to both repositories atomically`, async () => {
    await env.transaction(() => {
      userRepo.put(`u1`, {id: `u1`, name: `Alice`})
      sessionRepo.put(`s1`, {id: `s1`, userId: `u1`})
    })

    expect(await userRepo.get(`u1`)).toEqual({id: `u1`, name: `Alice`})
    expect(await sessionRepo.get(`s1`)).toEqual({id: `s1`, userId: `u1`})
  })

  it(`marks the wrapper as committed after tx.commit()`, async () => {
    const tx = await env.transaction((tx) => {
      userRepo.put(`u1`, {id: `u1`, name: `Bob`})
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
      userRepo.put(`u1`, {id: `u1`, name: `X`})
      tx.commit()
      return tx
    })
    expect(() => tx.commit()).toThrow(LmdbError)
  })

  it(`commit on already-done tx throws LmdbError`, async () => {
    const tx = await env.transaction((tx) => {
      tx.abort()
      return tx
    })
    expect(() => tx.commit()).toThrow(LmdbError)
  })
})

describe(`LmdbTransaction abort (write via env.transaction)`, () => {
  it(`rolls back writes when tx.abort() is called inside the callback`, async () => {
    await env.transaction((tx) => {
      userRepo.put(`u1`, {id: `u1`, name: `Rolled`})
      sessionRepo.put(`s1`, {id: `s1`, userId: `u1`})
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

  it(`env.transaction wraps user throws in LmdbError`, async () => {
    try {
      await env.transaction(() => {
        userRepo.put(`u1`, {id: `u1`, name: `Ghost`})
        throw new Error(`intentional`)
      })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(LmdbError)
      expect((e as LmdbError & {cause?: unknown}).cause).toBeInstanceOf(Error)
      expect(((e as LmdbError & {cause?: unknown}).cause as Error).message).toBe(`intentional`)
    }
  })

  it(`rollback on throw is atomic — neither repo's writes survive`, async () => {
    await userRepo.put(`existing`, {id: `existing`, name: `Pre`})

    try {
      await env.transaction(() => {
        userRepo.put(`existing`, {id: `existing`, name: `Should rollback`})
        sessionRepo.put(`new-session`, {id: `new-session`, userId: `existing`})
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
      await userRepo.put(`u1`, {id: `u1`, name: `Async`})
      await sessionRepo.put(`s1`, {id: `s1`, userId: `u1`})
      return {ok: true}
    })
    expect(result).toEqual({ok: true})
    expect(await userRepo.get(`u1`)).toEqual({id: `u1`, name: `Async`})
    expect(await sessionRepo.get(`s1`)).toEqual({id: `s1`, userId: `u1`})
  })

  it(`tx.abort() after an await rolls back all writes`, async () => {
    await userRepo.put(`existing`, {id: `existing`, name: `Pre`})
    await env.transaction(async (tx) => {
      await userRepo.put(`existing`, {id: `existing`, name: `Ghost`})
      await sessionRepo.put(`s1`, {id: `s1`, userId: `existing`})
      tx.abort()
    })
    expect((await userRepo.get(`existing`))?.name).toBe(`Pre`)
    expect(await sessionRepo.get(`s1`)).toBeUndefined()
  })

  it(`tx.abort() before the first await rolls back`, async () => {
    await env.transaction(async (tx) => {
      tx.abort()
      await userRepo.put(`u3`, {id: `u3`, name: `Aborted`})
    })
    expect(await userRepo.get(`u3`)).toBeUndefined()
  })

  it(`async throw after an await rolls back and wraps in LmdbError`, async () => {
    try {
      await env.transaction(async () => {
        await userRepo.put(`u2`, {id: `u2`, name: `Partial`})
        throw new Error(`async boom`)
      })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(LmdbError)
      expect((e as LmdbError & {cause?: unknown}).cause).toBeInstanceOf(Error)
      expect(((e as LmdbError & {cause?: unknown}).cause as Error).message).toBe(`async boom`)
    }
    expect(await userRepo.get(`u2`)).toBeUndefined()
  })

  it(`async tx.abort() returns the callback's value (same as sync, B6)`, async () => {
    const result = await env.transaction(async (tx) => {
      tx.abort()
      return 42
    })
    expect(result).toBe(42)
  })
})

describe(`env.transaction serialization (concurrent)`, () => {
  it(`an aborting transaction cannot roll back another transaction's committed write`, async () => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    await Promise.all([
      env.transaction(async (tx) => {
        await sleep(30)
        await userRepo.put(`u1`, {id: `u1`, name: `A`}, tx)
        tx.abort()
      }),
      env.transaction(async () => {
        await sleep(10)
        await sessionRepo.put(`s1`, {id: `s1`, userId: `u1`})
      })
    ])

    expect(await sessionRepo.get(`s1`)).toEqual({id: `s1`, userId: `u1`})
    expect(await userRepo.get(`u1`)).toBeUndefined()
  })

  it(`nested transaction() inside a synchronous callback still works (no deadlock)`, async () => {
    const result = await env.transaction(async () => {
      await userRepo.put(`u1`, {id: `u1`, name: `A`})
      const cur = userRepo.get(`u1`)
      await userRepo.put(`u1`, {id: cur?.id ?? `u1`, name: `A-prime`})
      return `ok`
    })
    expect(result).toBe(`ok`)
    expect(await userRepo.get(`u1`)).toEqual({id: `u1`, name: `A-prime`})
  })
})

describe(`env.readTransaction`, () => {
  it(`reads committed data via snapshot`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `Carol`})

    const snapshot = await env.readTransaction(async () => {
      return await userRepo.get(`u1`)
    })
    expect(snapshot).toEqual({id: `u1`, name: `Carol`})
  })

  it(`finalizes the read txn after callback resolves`, async () => {
    const tx = await env.readTransaction(async (tx) => {
      await userRepo.get(`u1`)
      return tx
    })
    expect(tx.done).toBe(true)
    expect(tx.isAborted).toBe(false)
    expect(tx.lifecycle).toBe(`released`)
  })

  it(`read transaction sees writes committed before env.readTransaction started`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `Before`})

    const entries = await env.readTransaction(async () => {
      return await userRepo.entries()
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

  it(`two sequential readTransactions in the same tick both succeed (L1)`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})
    // No setTimeout between — the shared-readTxn EINVAL regression fires here.
    const first = await env.readTransaction(async () => userRepo.get(`u1`))
    const second = await env.readTransaction(async () => userRepo.get(`u1`))
    expect(first).toEqual({id: `u1`, name: `A`})
    expect(second).toEqual({id: `u1`, name: `A`})
  })

  it(`concurrent readTransactions all succeed (L1)`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})
    const results = await Promise.all(Array.from({length: 10}, () => env.readTransaction(async () => userRepo.get(`u1`))))
    for (const r of results) {
      expect(r).toEqual({id: `u1`, name: `A`})
    }
  })

  it(`a plain get() right after readTransaction works (L1)`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})
    await env.readTransaction(async () => userRepo.get(`u1`))
    // Same tick, no setTimeout — previously the shared readTxn was left dead
    // until the next macrotask, so this get() hit EINVAL.
    expect(userRepo.get(`u1`)).toEqual({id: `u1`, name: `A`})
  })

  it(`get(key, tx) pins the snapshot across a concurrent committed write`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})

    const [inside] = await Promise.all([
      env.readTransaction(async (tx) => {
        const before = userRepo.get(`u1`, tx)
        await sleep(30) // let the concurrent writer commit
        const after = userRepo.get(`u1`, tx)
        return {before: before?.name, after: after?.name}
      }),
      (async () => {
        await sleep(10)
        await userRepo.put(`u1`, {id: `u1`, name: `B`}) // commits while the read txn is open
      })()
    ])

    expect(inside).toEqual({before: `A`, after: `A`}) // pinned snapshot
    expect(userRepo.get(`u1`)?.name).toBe(`B`) // write visible after release
  })

  it(`has/count/entries/iterate with tx read the pinned snapshot`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})
    await userRepo.put(`u2`, {id: `u2`, name: `A2`})

    const inside = await env.readTransaction(async (tx) => {
      const countBefore = userRepo.count(tx)
      const hasU1 = userRepo.has(`u1`, tx)
      const entriesBefore = await userRepo.entries({}, tx)
      const iteratedBefore: string[] = []
      for await (const [k] of userRepo.iterate({}, tx)) iteratedBefore.push(k)

      await userRepo.put(`u3`, {id: `u3`, name: `C`}) // writer adds a key

      const countAfter = userRepo.count(tx)
      const hasU3 = userRepo.has(`u3`, tx)
      const entriesAfter = await userRepo.entries({}, tx)
      const iteratedAfter: string[] = []
      for await (const [k] of userRepo.iterate({}, tx)) iteratedAfter.push(k)
      return {countBefore, hasU1, entriesBefore, iteratedBefore, countAfter, hasU3, entriesAfter, iteratedAfter}
    })

    expect(inside.countBefore).toBe(2)
    expect(inside.hasU1).toBe(true)
    expect(inside.entriesBefore.map(([k]) => k)).toEqual([`u1`, `u2`])
    expect(inside.iteratedBefore).toEqual([`u1`, `u2`])
    expect(inside.countAfter).toBe(2) // pinned — u3 not visible
    expect(inside.hasU3).toBe(false)
    expect(inside.entriesAfter.map(([k]) => k)).toEqual([`u1`, `u2`])
    expect(inside.iteratedAfter).toEqual([`u1`, `u2`])
    expect(userRepo.count()).toBe(3) // visible after release
  })

  it(`findByIndex(query, tx) reads the pinned snapshot for unique and non-unique indexes`, async () => {
    await indexedRepo.put(1, {id: 1, username: `alice`})
    await indexedRepo.put(2, {id: 2, username: `bob`})

    const inside = await env.readTransaction(async (tx) => {
      const uniqueBefore = await indexedRepo.findByIndex({id: 1}, tx)
      const nonUniqueBefore = await indexedRepo.findByIndex({username: `alice`}, tx)

      await indexedRepo.put(1, {id: 1, username: `carol`}) // writer re-indexes row 1

      const uniqueAfter = await indexedRepo.findByIndex({id: 1}, tx)
      const newIndexAfter = await indexedRepo.findByIndex({username: `carol`}, tx)
      return {uniqueBefore, nonUniqueBefore, uniqueAfter, newIndexAfter}
    })

    expect(inside.uniqueBefore).toEqual({id: 1, username: `alice`})
    expect(inside.nonUniqueBefore).toEqual([{id: 1, username: `alice`}])
    expect(inside.uniqueAfter).toEqual({id: 1, username: `alice`}) // pinned — still old row
    expect(inside.newIndexAfter).toEqual([]) // pinned — carol not indexed yet
    expect(await indexedRepo.findByIndex({id: 1})).toEqual({id: 1, username: `carol`}) // visible after release
    expect(await indexedRepo.findByIndex({username: `carol`})).toEqual([{id: 1, username: `carol`}])
  })
})

describe(`env.readTransaction raw txn release`, () => {
  it(`releases raw read txn even when user calls tx.commit() inside`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})
    const before = env.readerList().split(`\n`).filter(Boolean).length
    await env.readTransaction(async (tx) => {
      await userRepo.get(`u1`)
      tx.commit()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    // done() keeps the env's shared read txn alive (renewed on the next
    // event turn) — the slot count must stay bounded, not grow per call.
    const after = env.readerList().split(`\n`).filter(Boolean).length
    expect(after).toBeLessThanOrEqual(before + 1)
  })

  it(`tx.abort() inside readTransaction still releases exactly once`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})
    const before = env.readerList().split(`\n`).filter(Boolean).length
    await env.readTransaction(async (tx) => {
      await userRepo.get(`u1`)
      tx.abort()
      tx.abort()
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    const after = env.readerList().split(`\n`).filter(Boolean).length
    expect(after).toBeLessThanOrEqual(before + 1)
  })

  it(`repeated readTransactions do not grow the reader-slot count`, async () => {
    await userRepo.put(`u1`, {id: `u1`, name: `A`})
    const first = env.readerList().split(`\n`).filter(Boolean).length
    for (let i = 0; i < 20; i++) {
      await env.readTransaction(async () => {
        await userRepo.get(`u1`)
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
    const after = env.readerList().split(`\n`).filter(Boolean).length
    // 20 sequential transactions may reuse at most one additional shared
    // slot (the env's readTxn); any more indicates a per-call leak.
    expect(after).toBeLessThanOrEqual(first + 1)
  })
})

describe(`read-only env transactions`, () => {
  it(`readTransaction works on read-only envs`, async () => {
    const dir = createTestDir(`lmdb-readonly-tx-`)
    const writeEnv = new LmdbEnv({path: dir, maxDbs: 5})
    const writeUsers = writeEnv.register(UserSchema)
    await writeUsers.put(`u1`, {id: `u1`, name: `Initial`})
    await writeEnv.close()

    const roEnv = new LmdbEnv({path: dir, maxDbs: 5, readOnly: true})
    try {
      const roUsers = roEnv.register(UserSchema)
      const got = await roEnv.readTransaction(async () => {
        return await roUsers.get(`u1`)
      })
      expect(got).toEqual({id: `u1`, name: `Initial`})
    } finally {
      await roEnv.close()
      await rmWithRetry(dir)
    }
  })
})
