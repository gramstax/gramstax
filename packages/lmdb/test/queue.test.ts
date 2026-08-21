/**
 * F11 — FIFO queue primitive over LMDB.
 *
 * Single writer transaction for dequeue ensures at-least-once semantics
 * across processes.
 */
import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {LmdbEnv} from "../src/env"
import {LmdbQueue} from "../src/queue"
import {createTestDir, rmWithRetry} from "./test-helpers"

interface Job {
  id: string
  payload: string
}

let tmpDir: string
let env: LmdbEnv
let queue: LmdbQueue<Job>

beforeEach(async () => {
  tmpDir = createTestDir(`lmdb-queue-test-`)
  env = new LmdbEnv({path: tmpDir, maxDbs: 10})
  queue = new LmdbQueue<Job>(env, `jobs`)
})

afterEach(async () => {
  await env.close()
  await rmWithRetry(tmpDir)
})

describe(`LmdbQueue`, () => {
  it(`enqueue returns an id and peek sees it without removing`, async () => {
    const id = await queue.enqueue({id: `j1`, payload: `hello`})
    expect(typeof id).toBe(`string`)
    const peeked = await queue.peek()
    expect(peeked).toEqual([id, {id: `j1`, payload: `hello`}])
    expect(await queue.size()).toBe(1)
    // peek does not remove
    expect(await queue.peek()).toEqual([id, {id: `j1`, payload: `hello`}])
  })

  it(`dequeue returns FIFO order and removes`, async () => {
    await queue.enqueue({id: `j1`, payload: `a`})
    await queue.enqueue({id: `j2`, payload: `b`})
    const first = await queue.dequeue()
    expect(first?.[1]).toEqual({id: `j1`, payload: `a`})
    expect(await queue.size()).toBe(1)
    const second = await queue.dequeue()
    expect(second?.[1]).toEqual({id: `j2`, payload: `b`})
    expect(await queue.size()).toBe(0)
  })

  it(`dequeue on empty returns undefined`, async () => {
    expect(await queue.dequeue()).toBeUndefined()
    expect(await queue.peek()).toBeUndefined()
  })

  it(`clear drains the queue`, async () => {
    await queue.enqueue({id: `j1`, payload: `a`})
    await queue.enqueue({id: `j2`, payload: `b`})
    await queue.clear()
    expect(await queue.size()).toBe(0)
    expect(await queue.peek()).toBeUndefined()
  })

  it(`enqueue after dequeue preserves FIFO`, async () => {
    await queue.enqueue({id: `j1`, payload: `a`})
    await queue.dequeue()
    await queue.enqueue({id: `j2`, payload: `b`})
    expect((await queue.peek())?.[1]).toEqual({id: `j2`, payload: `b`})
  })
})
