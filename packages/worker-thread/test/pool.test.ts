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

    it(`re-adding a worker with same threadId replaces the entry WITHOUT incrementing count (re-add is idempotent; count mirrors the live registry, not the number of add() calls — the old count-2 assertion encoded the inflation bug)`, () => {
      const pool = new WorkerThreadPool([w1.worker])
      const replacement = makeMockWorker(101).worker
      pool.add(replacement)
      expect(pool.threadCount).toBe(1)
      expect(pool.getInstance(101)).toBe(replacement)
    })

    it(`add() returns the threadId it registered the worker under`, () => {
      const pool = new WorkerThreadPool([])
      const worker = makeMockWorker(42).worker
      expect(pool.add(worker)).toBe(42)
    })

    it(`add() returns the same threadId when re-adding the same instance without changing threadCount`, () => {
      const pool = new WorkerThreadPool([])
      const worker = makeMockWorker(42).worker
      expect(pool.add(worker)).toBe(42)
      expect(pool.add(worker)).toBe(42)
      expect(pool.threadCount).toBe(1)
    })

    it(`addMany() returns threadIds in input order`, () => {
      const pool = new WorkerThreadPool([])
      const a = makeMockWorker(3).worker
      const b = makeMockWorker(1).worker
      const c = makeMockWorker(2).worker
      expect(pool.addMany([a, b, c])).toEqual([3, 1, 2])
    })

    it(`addMany() on an empty array returns an empty array`, () => {
      const pool = new WorkerThreadPool([])
      expect(pool.addMany([])).toEqual([])
    })
  })

  describe(`kill`, () => {
    it(`calls kill() on the worker and removes it from the map`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      await pool.kill(101)
      expect(w1.killCalls.count).toBe(1)
      expect(pool.getInstance(101)).toBeUndefined()
      expect(pool.threadCount).toBe(1)
    })

    it(`returns the killed worker's threadId`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      expect(await pool.kill(101)).toBe(101)
    })

    it(`returns undefined for unknown threadId and does not throw`, async () => {
      const pool = new WorkerThreadPool([])
      expect(await pool.kill(999)).toBeUndefined()
      expect(pool.threadCount).toBe(0)
    })
  })

  describe(`killAll`, () => {
    it(`calls kill() on every worker and empties the pool`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker, w3.worker])
      await pool.killAll()
      expect(w1.killCalls.count).toBe(1)
      expect(w2.killCalls.count).toBe(1)
      expect(w3.killCalls.count).toBe(1)
      expect(pool.threadCount).toBe(0)
      expect(pool.getInstance(101)).toBeUndefined()
      expect(pool.getInstance(202)).toBeUndefined()
      expect(pool.getInstance(303)).toBeUndefined()
    })

    it(`is a no-op on empty pool`, async () => {
      const pool = new WorkerThreadPool([])
      await expect(pool.killAll()).resolves.toBeUndefined()
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

    it(`throws Error(unknown threadId ...) for unknown threadId (fail-fast replaces the old silent-undefined miss; no in-repo/example caller depends on undefined — verified via git grep)`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      let caught: unknown
      try {
        await pool.request(999, `process`, [])
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toMatch(/unknown threadId 999/)
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

    it(`rejects on an empty pool`, async () => {
      const pool = new WorkerThreadPool([])
      await expect(pool.broadcastRequest(`ping`, [])).rejects.toThrow(`WorkerThreadPool is empty`)
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

    it(`throws when the pool is empty`, async () => {
      const pool = new WorkerThreadPool([])
      await expect(pool.execute(`process`, [])).rejects.toThrow(/empty/)
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

  describe(`regression: re-add guard (no count inflation, no listener leak)`, () => {
    function makeTrackedWorker(id: number) {
      const exitHandlers: Array<() => void> = []
      const offCalls: Array<() => void> = []
      const worker = {
        threadId: id,
        kill() {},
        async request(method: string) {
          return `${id}:${method}`
        },
        on(event: string, cb: () => void) {
          if (event === `exit`) exitHandlers.push(cb)
          return worker
        },
        off(event: string, cb: () => void) {
          if (event === `exit`) {
            const at = exitHandlers.indexOf(cb)
            if (at >= 0) exitHandlers.splice(at, 1)
            offCalls.push(cb)
          }
          return worker
        },
        emitExit() {
          for (const cb of [...exitHandlers]) cb()
        }
      } as unknown as WorkerThreadLaunch & {emitExit: () => void}
      return {worker, exitHandlers, offCalls, emitExit: () => worker.emitExit()}
    }

    it(`re-adding the SAME instance does not inflate threadCount`, () => {
      const pool = new WorkerThreadPool([])
      const w = makeTrackedWorker(101)
      pool.add(w.worker)
      pool.add(w.worker)
      expect(pool.thread.size).toBe(1)
      expect(pool.threadCount).toBe(1)
    })

    it(`re-adding the same threadId does not stack exit listeners`, () => {
      const pool = new WorkerThreadPool([])
      const w = makeTrackedWorker(101)
      pool.add(w.worker)
      pool.add(w.worker)
      expect(w.exitHandlers).toHaveLength(1)
      w.emitExit()
      expect(pool.threadCount).toBe(0)
      // a stacked second listener would decrement twice → -1
      expect(pool.threadCount).toBe(0)
    })

    it(`re-adding a DIFFERENT instance under the same threadId replaces without inflating count`, () => {
      const pool = new WorkerThreadPool([])
      const first = makeTrackedWorker(101)
      const second = makeTrackedWorker(101)
      pool.add(first.worker)
      pool.add(second.worker)
      expect(pool.threadCount).toBe(1)
      expect(pool.getInstance(101)).toBe(second.worker)
    })
  })

  describe(`regression: kill/remove detaches the stored exit listener`, () => {
    it(`kill() off()s the exit listener so a late exit cannot double-decrement`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      await pool.kill(101)
      expect(pool.threadCount).toBe(0)
      w1.emitExit()
      expect(pool.threadCount).toBe(0)
    })
  })

  describe(`regression: killAll snapshot + error isolation + cursor reset`, () => {
    it(`kills every worker even when one kill() throws, then throws an aggregate`, async () => {
      const bad = makeMockWorker(404)
      bad.worker.kill = () => {
        throw new Error(`boom-404`)
      }
      const pool = new WorkerThreadPool([w1.worker, bad.worker, w2.worker])
      let caught: unknown
      try {
        await pool.killAll()
      } catch (err) {
        caught = err
      }
      expect(caught).toBeDefined()
      expect(caught).toBeInstanceOf(AggregateError)
      expect(((caught as AggregateError).errors as Array<unknown>).map(String).join(`;`)).toMatch(/boom-404/)
      expect(w1.killCalls.count).toBe(1)
      expect(w2.killCalls.count).toBe(1)
      // the loop never aborts: workers after the failure are still killed;
      // the failed worker itself stays registered (its kill did not complete)
      expect(pool.getInstance(101)).toBeUndefined()
      expect(pool.getInstance(202)).toBeUndefined()
      expect(pool.getInstance(404)).toBeDefined()
      expect(pool.threadCount).toBe(1)
    })

    it(`resets the round-robin cursor to 0`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      await pool.execute(`process`, [1])
      await pool.execute(`process`, [2])
      await pool.killAll()
      const fresh = makeMockWorker(505)
      pool.add(fresh.worker)
      await pool.execute(`process`, [3])
      expect(fresh.requestCalls).toHaveLength(1)
    })
  })

  describe(`regression: broadcastSettled envelopes`, () => {
    it(`returns per-worker ok envelopes and never rejects on worker failure`, async () => {
      const failing = makeMockWorker(404)
      failing.worker.request = (async () => {
        throw new Error(`worker-404-down`)
      }) as unknown as typeof failing.worker.request
      const pool = new WorkerThreadPool([w1.worker, failing.worker])
      const results = await pool.broadcastSettled(`ping`, [])
      expect(results).toHaveLength(2)
      expect(results[0]).toMatchObject({threadId: 101, ok: true, result: `101:ping`})
      expect(results[1]?.threadId).toBe(404)
      expect(results[1]?.ok).toBe(false)
      expect(String((results[1] as {error: unknown}).error)).toMatch(/worker-404-down/)
    })

    it(`rejects on empty pool (programming error, not a worker outcome)`, async () => {
      const pool = new WorkerThreadPool([])
      let caught: unknown
      try {
        await pool.broadcastSettled(`ping`, [])
      } catch (err) {
        caught = err
      }
      expect(caught).toBeDefined()
      expect(String(caught)).toMatch(/empty/)
    })
  })

  describe(`regression: request() unknown threadId throws`, () => {
    it(`throws Error(unknown threadId ...) instead of resolving undefined`, async () => {
      const pool = new WorkerThreadPool([w1.worker])
      let caught: unknown
      try {
        await pool.request(999, `process`, [])
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toMatch(/unknown threadId 999/)
    })
  })

  describe(`regression: execute dispatch order lock (round-robin sequence identical)`, () => {
    it(`dispatches strictly 1-2-3-1-2-3 across six calls`, async () => {
      const seen: Array<number> = []
      const makeRecording = (id: number) => {
        const handlers: Array<() => void> = []
        return {
          threadId: id,
          kill() {},
          async request() {
            seen.push(id)
            return `${id}`
          },
          on(event: string, cb: () => void) {
            if (event === `exit`) handlers.push(cb)
            return this
          }
        } as unknown as WorkerThreadLaunch
      }
      const pool = new WorkerThreadPool([makeRecording(1), makeRecording(2), makeRecording(3)])
      for (let n = 0; n < 6; n += 1) {
        await pool.execute(`m`, [])
      }
      expect(seen).toEqual([1, 2, 3, 1, 2, 3])
    })

    it(`cursor rebalances modulo live size after shrink (never dispatches out of bounds)`, async () => {
      const seen: Array<number> = []
      const makeRecording = (id: number) => {
        const handlers: Array<() => void> = []
        const self = {
          threadId: id,
          kill() {},
          async request() {
            seen.push(id)
            return `${id}`
          },
          on(event: string, cb: () => void) {
            if (event === `exit`) handlers.push(cb)
            return self
          },
          emitExit() {
            for (const cb of [...handlers]) cb()
          }
        } as unknown as WorkerThreadLaunch & {emitExit: () => void}
        return self
      }
      const a = makeRecording(1)
      const b = makeRecording(2)
      const c = makeRecording(3)
      const pool = new WorkerThreadPool([a, b, c])
      await pool.execute(`m`, []) // 1
      await pool.execute(`m`, []) // 2
      await pool.execute(`m`, []) // 3, cursor wraps to 0
      await pool.execute(`m`, []) // 1, cursor 1
      b.emitExit() // shrink to [1,3] while cursor is 1
      await pool.execute(`m`, []) // must resolve to a live worker, not throw/undefined
      await pool.execute(`m`, [])
      expect(pool.threadCount).toBe(2)
      expect(seen.slice(0, 4)).toEqual([1, 2, 3, 1])
      for (const id of seen.slice(4)) {
        expect([1, 3]).toContain(id)
      }
    })
  })

  describe(`phase 5: breaking coherence`, () => {
    it(`broadcastRequest rejects on an empty pool, matching execute and broadcastSettled`, async () => {
      const pool = new WorkerThreadPool([])
      await expect(pool.broadcastRequest(`ping`, [])).rejects.toThrow(/empty/)
    })

    it(`threadCount always equals thread.size after add, re-add, and worker-exit removal`, () => {
      const pool = new WorkerThreadPool([])
      expect(pool.threadCount).toBe(pool.thread.size)
      pool.add(w1.worker)
      expect(pool.threadCount).toBe(pool.thread.size)
      pool.add(w1.worker)
      expect(pool.threadCount).toBe(pool.thread.size)
      pool.add(w2.worker)
      expect(pool.threadCount).toBe(pool.thread.size)
      w1.emitExit()
      expect(pool.threadCount).toBe(pool.thread.size)
      expect(pool.threadCount).toBe(1)
    })

    it(`kill() awaits termination before the registry entry disappears`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker])
      await pool.kill(101)
      expect(w1.killCalls.count).toBe(1)
      expect(pool.threadCount).toBe(1)
      expect(pool.threadCount).toBe(pool.thread.size)
      expect(pool.getInstance(101)).toBeUndefined()
    })

    it(`killAll() awaits every worker's termination`, async () => {
      const pool = new WorkerThreadPool([w1.worker, w2.worker, w3.worker])
      await pool.killAll()
      expect(w1.killCalls.count).toBe(1)
      expect(w2.killCalls.count).toBe(1)
      expect(w3.killCalls.count).toBe(1)
      expect(pool.threadCount).toBe(0)
      expect(pool.threadCount).toBe(pool.thread.size)
    })
  })
})
