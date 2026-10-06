/**
 * Integration tests for `env.transactionFast()`.
 *
 * `transactionFast` commits through lmdb-js `db.transaction()`, which runs the
 * commit on the writer thread instead of blocking the main thread. That path
 * records a callback error and rethrows it but never calls `mdb_txn_abort`, so
 * the native transaction commits either way.
 *
 * These tests pin both halves of that contract:
 * - the fast path is a real atomic write transaction (not just two writes),
 * - and the missing rollback is loud (`tx.abort()` throws, a throwing callback
 *   reports that its writes were committed) rather than silent.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbError} from "../src/errors"
import {LmdbSchema, t} from "../src/schema"
import type {LmdbEnvSub} from "../src/sub"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface Item {
  id: string
  qty: number
}

class ItemSchema extends LmdbSchema {
  static db = `item-fast`
  static key = t.string()
  static value = t.object<Item>()
}

class LedgerSchema extends LmdbSchema {
  static db = `ledger-fast`
  static key = t.string()
  static value = t.object<{itemId: string}>()
}

class CounterSchema extends LmdbSchema {
  static db = `counter-fast`
  static key = t.string()
  static value = t.number()
}

let tmpDir: string
let env: LmdbEnv
let items: LmdbEnvSub<typeof ItemSchema>
let ledger: LmdbEnvSub<typeof LedgerSchema>

beforeEach(() => {
  tmpDir = createTestDir(`lmdb-txfast-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 6})
  items = env.register(ItemSchema)
  ledger = env.register(LedgerSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`transactionFast — commit path`, () => {
  it(`commits writes to two repositories atomically`, async () => {
    await env.transactionFast(() => {
      items.putSync(`i1`, {id: `i1`, qty: 5})
      ledger.putSync(`l1`, {itemId: `i1`})
    })

    expect(items.get(`i1`)).toEqual({id: `i1`, qty: 5})
    expect(ledger.get(`l1`)).toEqual({itemId: `i1`})
  })

  it(`returns the callback's value`, async () => {
    const result = await env.transactionFast(() => {
      items.putSync(`i1`, {id: `i1`, qty: 1})
      return 42
    })
    expect(result).toBe(42)
  })

  it(`supports an async callback`, async () => {
    await env.transactionFast(async () => {
      await Promise.resolve()
      items.putSync(`i1`, {id: `i1`, qty: 2})
    })
    expect(items.get(`i1`)).toEqual({id: `i1`, qty: 2})
  })

  it(`survives a throw inside an async callback and still commits what it wrote`, async () => {
    await expect(
      env.transactionFast(async () => {
        await Promise.resolve()
        items.putSync(`i1`, {id: `i1`, qty: 9})
        throw new Error(`boom`)
      })
    ).rejects.toThrow(LmdbError)

    await env.committed
    expect(items.get(`i1`)).toEqual({id: `i1`, qty: 9})
  })
})

describe(`transactionFast — rollback is unavailable and says so`, () => {
  it(`throws from tx.abort() instead of silently doing nothing`, async () => {
    let caught: unknown
    try {
      await env.transactionFast((tx) => {
        tx.abort()
      })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(LmdbError)
    const message = String((caught as Error).message)
    expect(message).toContain(`Cannot abort`)
    expect(message).toContain(`transactionFast`)
    expect(message).toContain(`transaction()`)
  })

  it(`reports that a throwing callback's writes were committed`, async () => {
    const err = await env
      .transactionFast(() => {
        items.putSync(`i1`, {id: `i1`, qty: 3})
        throw new Error(`boom`)
      })
      .then(
        () => undefined,
        (e: unknown) => e
      )

    expect(err).toBeInstanceOf(LmdbError)
    expect(String((err as Error).message)).toContain(`cannot roll back`)
    expect(String((err as Error).message)).toContain(`committed`)
    expect((err as Error).cause).toBeInstanceOf(Error)
    expect(String((err as Error).cause)).toContain(`boom`)
  })
})

describe(`transactionFast — guards`, () => {
  it(`rejects on a read-only env`, async () => {
    const roDir = createTestDir(`lmdb-txfast-ro-`)
    const writer = new LmdbEnv({path: roDir, maxDbs: 4})
    writer.register(CounterSchema)
    await writer.close()

    const ro = new LmdbEnv({path: roDir, maxDbs: 4, readOnly: true})
    try {
      await expect(ro.transactionFast(() => 1)).rejects.toThrow(LmdbError)
    } finally {
      await ro.close()
      await rmWithRetry(roDir)
    }
  })

  it(`throws after close`, async () => {
    const closing = new LmdbEnv({path: createTestDir(`lmdb-txfast-closed-`), maxDbs: 4})
    await closing.close()
    await expect(closing.transactionFast(() => 1)).rejects.toThrow(LmdbError)
  })
})

describe(`transaction() keeps rollback (regression gate)`, () => {
  it(`still rolls back on tx.abort()`, async () => {
    await env.transaction((tx) => {
      items.putSync(`i1`, {id: `i1`, qty: 7})
      ledger.putSync(`l1`, {itemId: `i1`})
      tx.abort()
    })

    expect(items.get(`i1`)).toBeUndefined()
    expect(ledger.get(`l1`)).toBeUndefined()
  })

  it(`still rolls back when the callback throws`, async () => {
    await expect(
      env.transaction(() => {
        items.putSync(`i1`, {id: `i1`, qty: 7})
        throw new Error(`boom`)
      })
    ).rejects.toThrow(`Transaction failed`)

    await env.committed
    expect(items.get(`i1`)).toBeUndefined()
  })
})

describe(`call sites moved onto transactionFast`, () => {
  it(`putMany still writes every row`, async () => {
    const entries: Array<[string, Item]> = Array.from({length: 25}, (_, i) => {
      const key = `i${String(i).padStart(3, "0")}`
      return [key, {id: key, qty: i}]
    })
    await items.putMany(entries, 10, {sorted: true})

    expect(items.count()).toBe(25)
    expect(items.get(`i000`)).toEqual({id: `i000`, qty: 0})
    expect(items.get(`i024`)).toEqual({id: `i024`, qty: 24})
  })

  it(`deleteByPrefix still removes the whole prefix`, async () => {
    await items.putMany(
      [
        [`a1`, {id: `a1`, qty: 1}],
        [`a2`, {id: `a2`, qty: 2}],
        [`b1`, {id: `b1`, qty: 3}]
      ],
      undefined,
      {sorted: true}
    )

    expect(await items.deleteByPrefix(`a`)).toBe(2)
    expect(items.get(`a1`)).toBeUndefined()
    expect(items.get(`a2`)).toBeUndefined()
    expect(items.get(`b1`)).toEqual({id: `b1`, qty: 3})
  })

  // `purgeExpired` is deliberately NOT on transactionFast: it counts the
  // `removeSync` return value, and under lmdb-js `db.transaction()` the queued
  // removals are not reflected in that return value the way `transactionSync`
  // reflects them. Covered end-to-end in `ttl.test.ts`.
  it(`purgeExpired still removes expired rows`, async () => {
    class SessionSchema extends LmdbSchema {
      static db = `session-fast`
      static key = t.string()
      static value = t.object<{token: string}>()
      static ttl = 0
    }
    const sessions = env.register(SessionSchema)
    await sessions.put(`s1`, {token: `keep`}, {ttlMs: 60_000})
    await sessions.put(`s2`, {token: `drop`}, {ttlMs: 1})

    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(await sessions.purgeExpired()).toBe(1)
    expect(sessions.get(`s1`)).toEqual({token: `keep`})
    expect(sessions.get(`s2`)).toBeUndefined()
  })
})
