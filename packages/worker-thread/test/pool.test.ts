/**
 * Unit tests for WorkerThreadPool — pure logic with mocked WorkerThreadLaunch.
 *
 * Tests the pool's add/get/kill/broadcast logic without spawning real worker
 * threads. Uses fake worker objects that satisfy the WorkerThreadLaunch shape.
 */
import {describe, it, expect, beforeEach} from "bun:test"
import {WorkerThreadPool} from "../src/pool"
import type {WorkerThreadLaunch} from "../src/launch"

/**
 * Build a fake WorkerThreadLaunch object.
 * Records `kill()` and `request()` calls for assertion.
 */
function makeMockWorker(id: number) {
  const killCalls = {count: 0}
  const requestCalls: Array<{method: string; params: any; wait: boolean}> = []
  const worker = {
    threadId: id,
    kill() {
      killCalls.count += 1
    },
    async request(method: string, params: any, wait = true) {
      requestCalls.push({method, params, wait})
      return `${id}:${method}`
    }
  } as unknown as WorkerThreadLaunch
  return {worker, killCalls, requestCalls}
}

describe(`WorkerThreadPool`, () => {
  let w1: ReturnType<typeof makeMockWorker>
  let w2: ReturnType<typeof makeMockWorker>
  let w3: ReturnType<typeof makeMockWorker>

  beforeEach(() => {
    w1 = makeMockWorker(101)
    w2 = makeMockWorker(202)
    w3 = makeMockWorker(303)
  })

  describe(`construction`, () => {
    it(`initializes with given workers via addMany`, () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      expect(pool.threadCount).toBe(2)
      expect(pool.getInstance(101)).toBe(w1.worker)
      expect(pool.getInstance(202)).toBe(w2.worker)
    })

    it(`starts with empty thread map and zero count when no workers given`, () => {
      const pool = new WorkerThreadPool([])
      expect(pool.threadCount).toBe(0)
      expect(pool.getInstance(999)).toBeUndefined()
    })
  })

  describe(`add / getInstance`, () => {
    it(`add() inserts a worker and increments threadCount`, () => {
      const pool = new WorkerThreadPool([])
      pool.add(w1.worker)
      expect(pool.threadCount).toBe(1)
      expect(pool.getInstance(101)).toBe(w1.worker)
    })

    it(`addMany() inserts all workers in order`, () => {
      const pool = new WorkerThreadPool([])
      pool.addMany([w1.worker, w2.worker, w3.worker])
      expect(pool.threadCount).toBe(3)
      expect(pool.getInstance(101)).toBe(w1.worker)
      expect(pool.getInstance(202)).toBe(w2.worker)
      expect(pool.getInstance(303)).toBe(w3.worker)
    })

    it(`getInstance returns undefined for unknown threadId`, () => {
      const pool = new WorkerThreadPool([w1.worker])
      expect(pool.getInstance(999)).toBeUndefined()
    })

    it(`re-adding a worker with same threadId overwrites the entry and increments count`, () => {
      const pool = new WorkerThreadPool([w1.worker])
      const replacement = makeMockWorker(101).worker
      pool.add(replacement)
      expect(pool.threadCount).toBe(2)
      expect(pool.getInstance(101)).toBe(replacement)
    })
  })

  describe(`kill`, () => {
    it(`calls kill() on the worker and removes it from the map`, () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      pool.kill(101)
      expect(w1.killCalls.count).toBe(1)
      expect(pool.getInstance(101)).toBeUndefined()
      expect(pool.threadCount).toBe(1)
    })

    it(`returns the killed worker's threadId`, () => {
      const pool = new WorkerThreadPool([w1.worker])
      expect(pool.kill(101)).toBe(101)
    })

    it(`returns undefined for unknown threadId and does not throw`, () => {
      const pool = new WorkerThreadPool([])
      expect(pool.kill(999)).toBeUndefined()
      expect(pool.threadCount).toBe(0)
    })
  })

  describe(`killAll`, () => {
    it(`calls kill() on every worker and empties the pool`, () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker, w3.worker])
      pool.killAll()
      expect(w1.killCalls.count).toBe(1)
      expect(w2.killCalls.count).toBe(1)
      expect(w3.killCalls.count).toBe(1)
      expect(pool.threadCount).toBe(0)
      expect(pool.getInstance(101)).toBeUndefined()
      expect(pool.getInstance(202)).toBeUndefined()
      expect(pool.getInstance(303)).toBeUndefined()
    })

    it(`is a no-op on empty pool`, () => {
      const pool = new WorkerThreadPool([])
      expect(() => pool.killAll()).not.toThrow()
      expect(pool.threadCount).toBe(0)
    })
  })

  describe(`request (single)`, () => {
    it(`forwards method/params to the targeted worker`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      const result = await pool.request(101, `process`, [1, 2, 3])
      expect(result).toBe(`101:process`)
      expect(w1.requestCalls).toEqual([{method: `process`, params: [1, 2, 3], wait: true}])
      expect(w2.requestCalls).toEqual([])
    })

    it(`respects the _wait parameter and forwards it`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      await pool.request(101, `ping`, [], false)
      expect(w1.requestCalls[0]?.wait).toBe(false)
    })

    it(`returns undefined for unknown threadId`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      const result = await pool.request(999, `process`, [])
      expect(result).toBeUndefined()
    })
  })

  describe(`broadcastRequest`, () => {
    it(`sends the request to every worker and collects results`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker, w3.worker])
      const results = await pool.broadcastRequest(`getStatus`, [])
      expect(results).toEqual([`101:getStatus`, `202:getStatus`, `303:getStatus`])
      for (const w of [w1, w2, w3]) {
        expect(w.requestCalls).toEqual([{method: `getStatus`, params: [], wait: true}])
      }
    })

    it(`returns an empty array for an empty pool`, async () => {
      const pool = new WorkerThreadPool([])
      const results = await pool.broadcastRequest(`ping`, [])
      expect(results).toEqual([])
    })

    it(`preserves the order of workers as results`, async () => {
      const pool = new WorkerThreadPool([w3.worker, w1.worker, w2.worker])
      const results = await pool.broadcastRequest(`echo`, [`hi`])
      // Map preserves insertion order
      expect(results).toEqual([`303:echo`, `101:echo`, `202:echo`])
    })
  })
})
