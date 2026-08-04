/**
 * Unit tests for WorkerThreadPool — pure logic with mocked WorkerThreadLaunch.
 *
 * Tests the pool's add/get/kill/broadcast logic without spawning real worker
 * threads. Uses fake worker objects that satisfy the WorkerThreadLaunch shape.
 */
import {beforeEach, describe, expect, it } from "bun:test"
import type {WorkerThreadLaunch} from "../src/launch"
import {WorkerThreadPool} from "../src/pool"

/**
 * Build a fake WorkerThreadLaunch object.
 * Records `kill()` and `request()` calls for assertion.
 */
function makeMockWorker(id: number) {
  const killCalls = {count: 0}
  const requestCalls: Array<{method: string; params: any; wait: boolean}> = []
  const timeoutCalls: Array<number | undefined> = []
  const exitHandlers: Array<() => void> = []
  const worker = {
    threadId: id,
    kill() {
      killCalls.count += 1
    },
    async request(method: string, params: any, wait = true, _others?: any, timeoutMs?: number) {
      requestCalls.push({method, params, wait})
      timeoutCalls.push(timeoutMs)
      return `${id}:${method}`
    },
    on(event: string, cb: () => void) {
      if (event === `exit`) exitHandlers.push(cb)
      return worker
    },
    emitExit() {
      for (const cb of exitHandlers) cb()
    }
  } as unknown as WorkerThreadLaunch & {emitExit: () => void}
  return {worker, killCalls, requestCalls, timeoutCalls, emitExit: () => worker.emitExit()}
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

  describe(`execute (P0-3)`, () => {
    it(`dispatches round-robin across all workers`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker, w3.worker])
      await pool.execute(`process`, [1])
      await pool.execute(`process`, [2])
      await pool.execute(`process`, [3])
      expect(w1.requestCalls).toEqual([{method: `process`, params: [1], wait: true}])
      expect(w2.requestCalls).toEqual([{method: `process`, params: [2], wait: true}])
      expect(w3.requestCalls).toEqual([{method: `process`, params: [3], wait: true}])
    })

    it(`wraps around to the first worker`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      await pool.execute(`process`, [1])
      await pool.execute(`process`, [2])
      await pool.execute(`process`, [3])
      expect(w1.requestCalls).toHaveLength(2)
      expect(w2.requestCalls).toHaveLength(1)
    })

    it(`throws when the pool is empty`, () => {
      const pool = new WorkerThreadPool([])
      expect(() => pool.execute(`process`, [])).toThrow(/empty/)
    })

    it(`forwards the timeoutMs`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      await pool.execute(`process`, [], 1234)
      expect(w1.timeoutCalls).toEqual([1234])
    })
  })

  describe(`worker exit removal (P0-3)`, () => {
    it(`removes a worker when its exit event fires`, () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      expect(pool.threadCount).toBe(2)
      w1.emitExit()
      expect(pool.threadCount).toBe(1)
      expect(pool.getInstance(101)).toBeUndefined()
      expect(pool.getInstance(202)).toBeDefined()
    })

    it(`does not decrement twice when the same worker exits again`, () => {
      const pool = new WorkerThreadPool([w1.worker])
      w1.emitExit()
      w1.emitExit()
      expect(pool.threadCount).toBe(0)
    })
  })

  describe(`timeout passthrough (P0-1)`, () => {
    it(`forwards timeoutMs from request()`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      await pool.request(101, `process`, [], true, undefined, 999)
      expect(w1.timeoutCalls).toEqual([999])
    })

    it(`forwards timeoutMs from broadcastRequest()`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      await pool.broadcastRequest(`ping`, [], 555)
      expect(w1.timeoutCalls).toEqual([555])
      expect(w2.timeoutCalls).toEqual([555])
    })
  })

  describe(`cursor consistency (regression)`, () => {
    it(`round-robin cursor stays consistent after mid-rotation removal`, async () => {
      const calls: Record<number, number> = {1: 0, 2: 0, 3: 0}
      const makeMock = (id: number) => {
        const handlers: Array<() => void> = []
        return {
          threadId: id,
          kill() {},
          async request() {
            calls[id] = (calls[id] ?? 0) + 1
            return `${id}`
          },
          on(event: string, cb: () => void) {
            if (event === `exit`) handlers.push(cb)
            return this
          },
          emitExit() {
            for (const cb of handlers) cb()
          }
        } as unknown as WorkerThreadLaunch & {emitExit: () => void}
      }
      const w1 = makeMock(1)
      const w2 = makeMock(2)
      const w3 = makeMock(3)
      const pool = new WorkerThreadPool([w1, w2, w3])
      await pool.execute(`m`, []) // w1, cursor 1
      ;(w2 as unknown as {emitExit: () => void}).emitExit() // remove w2 mid-rotation
      await pool.execute(`m`, []) // w3 (index 1), cursor 2
      await pool.execute(`m`, []) // cursor 2 >= 2 → reset 0 → w1
      expect(pool.threadCount).toBe(2)
      expect(calls).toEqual({1: 2, 2: 0, 3: 1})
    })
  })
})
