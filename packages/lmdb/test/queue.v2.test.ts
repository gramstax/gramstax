/**
 * Phase 3 (B3) — Queue v2 single-transaction enqueue/dequeue.
 *
 * v2 changes:
 * - enqueue bumps the sequence counter AND stores the payload in ONE
 *   synchronous transaction (previously two commits: counter txn + async
 *   payload put).
 * - dequeue reads the head via a synchronous cursor and removes it in ONE
 *   synchronous transaction (no async first() holding the write lock).
 *
 * FIFO semantics are unchanged from v1 — the migration must not break
 * ordering, size, idempotent construction, or empty-dequeue behavior.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbQueue} from "../src/queue"
import {LmdbSchema, t} from "../src/schema"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface Job {
  id: string
  payload: string
}

class JobsSchema extends LmdbSchema {
  static db = `jobs`
  static key = t.string()
  static value = t.object<Job>()
}

let tmpDir: string
let env: LmdbEnv
let queue: LmdbQueue<typeof JobsSchema>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-queue-v2-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  queue = new LmdbQueue(env, JobsSchema)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbQueue v2 (single-txn)`, () => {
  it(`enqueue twice: size() === 2 and peek returns FIFO head`, async () => {
    const id1 = await queue.enqueue({id: `j1`, payload: `a`})
    const id2 = await queue.enqueue({id: `j2`, payload: `b`})
    expect(await queue.size()).toBe(2)
    const head = await queue.peek()
    expect(head?.[0]).toBe(id1)
    expect(head?.[1]).toEqual({id: `j1`, payload: `a`})
    // ids are strictly increasing zero-padded sequences
    expect(id1 < id2).toBe(true)
  })

  it(`dequeue returns FIFO [id, job] and shrinks size`, async () => {
    await queue.enqueue({id: `j1`, payload: `a`})
    await queue.enqueue({id: `j2`, payload: `b`})
    const first = await queue.dequeue()
    expect(first).toEqual([expect.any(String), {id: `j1`, payload: `a`}])
    expect(await queue.size()).toBe(1)
    const second = await queue.dequeue()
    expect(second?.[1]).toEqual({id: `j2`, payload: `b`})
    expect(await queue.size()).toBe(0)
    expect(await queue.dequeue()).toBeUndefined()
  })

  it(`constructing a second LmdbQueue with the same dbName does not throw (idempotent)`, async () => {
    expect(() => new LmdbQueue(env, JobsSchema)).not.toThrow()
    const second = new LmdbQueue(env, JobsSchema)
    await queue.enqueue({id: `j1`, payload: `a`})
    expect(await second.size()).toBe(1)
    expect((await second.dequeue())?.[1]).toEqual({id: `j1`, payload: `a`})
  })

  it(`enqueue performs exactly one synchronous transaction commit`, async () => {
    // v1 enqueue = counter txn (async transaction) + async payload put → the
    // public transactionSync is never invoked. v2 must invoke it exactly once
    // per enqueue. Monkey-patch the instance to count invocations.
    const envAny = env as unknown as {rootTransactionSync: (...args: unknown[]) => unknown}
    const original = envAny.rootTransactionSync
    let calls = 0
    envAny.rootTransactionSync = function (this: unknown, ...args: unknown[]): unknown {
      calls++
      return original.apply(this, args)
    }
    try {
      await queue.enqueue({id: `j1`, payload: `single-commit`})
      await queue.enqueue({id: `j2`, payload: `single-commit-2`})
    } finally {
      envAny.rootTransactionSync = original
    }
    expect(calls).toBe(2)
  })
})