/**
 * Unit tests for WorkerThreadRpc — pure logic, no worker threads.
 *
 * Tests the JSON-RPC dispatcher's request/result/error handling without
 * spawning any actual worker threads. Uses a stub `send` function to
 * capture outgoing messages and feeds back canned responses.
 */
import {beforeEach, describe, expect, it } from "bun:test"
import type {ITMapRpc} from "../src/rpc"
import {WorkerThreadRpc} from "../src/rpc"

describe(`WorkerThreadRpc`, () => {
  let sentMessages: any[]
  let rpc: WorkerThreadRpc

  beforeEach(() => {
    sentMessages = []
    const register = {
      add: (a: number, b: number) => a + b,
      greet: (name: string) => `Hello ${name}`,
      fail: () => {
        throw new Error(`boom`)
      },
      asyncMethod: async (x: number) => x * 2
    }
    const send = (data: any) => {
      sentMessages.push(data)
    }
    rpc = new WorkerThreadRpc(send as any, register)
  })

  describe(`makeRequest (outgoing)`, () => {
    it(`sends a request with id, method, params`, () => {
      rpc.makeRequest(`add`, [1, 2])
      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0]).toMatchObject({
        method: `add`,
        params: [1, 2]
      })
      expect(typeof sentMessages[0].id).toBe(`number`)
    })

    it(`returns a promise that resolves with the result`, async () => {
      const promise = rpc.makeRequest(`add`, [2, 3])
      // Simulate response from the wire
      const req = sentMessages[0]
      await rpc.make({id: req.id, result: 5})
      expect(await promise).toBe(5)
    })

    it(`returns a promise that rejects on error response`, async () => {
      const promise = rpc.makeRequest(`fail`, [])
      const req = sentMessages[0]
      await rpc.make({id: req.id, error: {message: `boom`, name: `Error`}})
      await expect(promise).rejects.toEqual({message: `boom`, name: `Error`})
    })

    it(`supports fire-and-forget mode (_wait=false)`, () => {
      const result = rpc.makeRequest(`add`, [1, 2], false)
      // When _wait=false, the function returns the send result (not a promise)
      expect(result).toBeUndefined()
      expect(sentMessages).toHaveLength(1)
    })

    it(`merges _others into the payload`, () => {
      rpc.makeRequest(`add`, [1, 2], true, {sessionId: `abc`})
      expect(sentMessages[0]).toMatchObject({
        method: `add`,
        params: [1, 2],
        sessionId: `abc`
      })
    })

    it(`generates unique ids across calls`, () => {
      const ids = new Set<number>()
      for (let i = 0; i < 100; i++) {
        ids.add(rpc.makeId())
      }
      if (ids.size < 100) {
        console.log(`DUPLICATE IDS: size=${ids.size}`)
      }
      expect(ids.size).toBe(100) // Math.random should not duplicate in 100 calls
    })

    it(`sends all three makeRequest calls to the send function`, () => {
      rpc.makeRequest(`add`, [1, 1], false)
      rpc.makeRequest(`add`, [2, 2], false)
      rpc.makeRequest(`add`, [3, 3], false)
      expect(sentMessages.length).toBe(3)
      expect(sentMessages[0].method).toBe(`add`)
      expect(sentMessages[1].method).toBe(`add`)
      expect(sentMessages[2].method).toBe(`add`)
    })
  })

  describe(`make (incoming)`, () => {
    it(`dispatches a request to the registered method`, async () => {
      const promise = rpc.make({id: 1, method: `add`, params: [10, 20]})
      // The send is called with the result
      await promise
      expect(sentMessages[0]).toMatchObject({id: 1, result: 30})
    })

    it(`supports async registered methods`, async () => {
      await rpc.make({id: 2, method: `asyncMethod`, params: [7]})
      expect(sentMessages[0]).toMatchObject({id: 2, result: 14})
    })

    it(`catches errors from the registered method and sends error response`, async () => {
      await rpc.make({id: 3, method: `fail`, params: []})
      expect(sentMessages[0].id).toBe(3)
      expect(sentMessages[0].error).toBeDefined()
      expect(sentMessages[0].error.message).toBe(`boom`)
    })

    it(`rejects when method is not registered`, async () => {
      await rpc.make({id: 4, method: `doesNotExist`, params: []})
      expect(sentMessages[0].id).toBe(4)
      expect(sentMessages[0].error.message).toMatch(/not found/)
    })

    it(`rejects when method exists but is not a function`, async () => {
      // Manually inject a non-function into the register
      ;(rpc.register as any).notAFunction = `hello`
      await rpc.make({id: 5, method: `notAFunction`, params: []})
      expect(sentMessages[0].error.message).toMatch(/not function/)
    })

    it(`resolves a pending request when a result message arrives`, async () => {
      const promise = rpc.makeRequest(`add`, [1, 2])
      const req = sentMessages[0]
      await rpc.make({id: req.id, result: 3})
      expect(await promise).toBe(3)
    })

    it(`rejects a pending request when an error message arrives`, async () => {
      const promise = rpc.makeRequest(`add`, [1, 2])
      const req = sentMessages[0]
      await rpc.make({id: req.id, error: {message: `nope`, name: `Error`}})
      await expect(promise).rejects.toEqual({message: `nope`, name: `Error`})
    })

    it(`ignores result/error messages with no matching id`, async () => {
      // No pending request for id=999
      await rpc.make({id: 999, result: `orphan`})
      // No new outgoing message
      expect(sentMessages).toHaveLength(0)
    })
  })

  describe(`makeId`, () => {
    it(`returns a number`, () => {
      const id = rpc.makeId()
      expect(typeof id).toBe(`number`)
    })

    it(`returns a non-NaN number`, () => {
      const id = rpc.makeId()
      expect(Number.isNaN(id)).toBe(false)
    })
  })

  describe(`map lifecycle`, () => {
    it(`removes pending request from map after result`, async () => {
      const promise = rpc.makeRequest(`add`, [1, 2])
      const req = sentMessages[0]
      const internalMap = rpc.map as ITMapRpc
      expect(internalMap.has(req.id)).toBe(true)
      await rpc.make({id: req.id, result: 3})
      expect(internalMap.has(req.id)).toBe(false)
      expect(await promise).toBe(3)
    })
  })

  describe(`timeout (P0-1)`, () => {
    it(`rejects a pending request after timeoutMs`, async () => {
      const promise = rpc.makeRequest(`add`, [1, 2], true, undefined, 30)
      await expect(promise).rejects.toThrow(/timeout after 30ms/)
    })

    it(`removes the timed-out entry from the pending map`, async () => {
      const promise = rpc.makeRequest(`add`, [1, 2], true, undefined, 30)
      await expect(promise).rejects.toThrow()
      expect(rpc.map.size).toBe(0)
    })

    it(`does not time out when a result arrives first`, async () => {
      const promise = rpc.makeRequest(`add`, [1, 2], true, undefined, 200)
      const req = sentMessages[0]
      await rpc.make({id: req.id, result: 3})
      expect(await promise).toBe(3)
      expect(rpc.map.size).toBe(0)
    })
  })

  describe(`rejectAllPending (P0-1)`, () => {
    it(`rejects every pending request and empties the map`, async () => {
      const p1 = rpc.makeRequest(`add`, [1, 2])
      const p2 = rpc.makeRequest(`add`, [3, 4])
      expect(rpc.map.size).toBe(2)
      rpc.rejectAllPending(new Error(`worker died`))
      await expect(p1).rejects.toThrow(/worker died/)
      await expect(p2).rejects.toThrow(/worker died/)
      expect(rpc.map.size).toBe(0)
    })

    it(`wraps non-Error values into an Error`, async () => {
      const p1 = rpc.makeRequest(`add`, [1, 2])
      rpc.rejectAllPending(`boom`)
      await expect(p1).rejects.toThrow(/boom/)
    })
  })

  describe(`middleware (P1-7)`, () => {
    it(`can mutate params before dispatch`, async () => {
      rpc.use(async (ctx, next) => {
        ctx.params = [Number(ctx.params[0]) + 1, Number(ctx.params[1])]
        await next()
      })
      await rpc.make({id: 10, method: `add`, params: [1, 2]})
      expect(sentMessages[0]).toMatchObject({id: 10, result: 4})
    })

    it(`can short-circuit by setting result without calling next`, async () => {
      rpc.use(async (ctx) => {
        ctx.result = `short-circuited`
      })
      await rpc.make({id: 11, method: `add`, params: [1, 2]})
      expect(sentMessages[0]).toMatchObject({id: 11, result: `short-circuited`})
    })

    it(`propagates middleware throws as error responses`, async () => {
      rpc.use(async () => {
        throw new Error(`blocked by middleware`)
      })
      await rpc.make({id: 12, method: `add`, params: [1, 2]})
      expect(sentMessages[0].id).toBe(12)
      expect(sentMessages[0].error.message).toBe(`blocked by middleware`)
    })

    it(`runs middlewares in registration order`, async () => {
      const order: string[] = []
      rpc.use(async (_ctx, next) => {
        order.push(`first-before`)
        await next()
        order.push(`first-after`)
      })
      rpc.use(async (_ctx, next) => {
        order.push(`second-before`)
        await next()
        order.push(`second-after`)
      })
      await rpc.make({id: 13, method: `add`, params: [1, 2]})
      expect(order).toEqual([`first-before`, `second-before`, `second-after`, `first-after`])
    })
  })

  describe(`context merge (P1-7)`, () => {
    it(`merges rpc.context into every outgoing payload`, () => {
      rpc.context = {traceId: `trace-123`}
      rpc.makeRequest(`add`, [1, 2])
      expect(sentMessages[0]).toMatchObject({traceId: `trace-123`})
    })

    it(`lets per-call _others override context`, () => {
      rpc.context = {traceId: `trace-123`}
      rpc.makeRequest(`add`, [1, 2], true, {traceId: `override`})
      expect(sentMessages[0]).toMatchObject({traceId: `override`})
    })
  })
})
