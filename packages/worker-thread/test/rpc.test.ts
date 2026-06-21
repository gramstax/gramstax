/**
 * Unit tests for WorkerThreadRpc — pure logic, no worker threads.
 *
 * Tests the JSON-RPC dispatcher's request/result/error handling without
 * spawning any actual worker threads. Uses a stub `send` function to
 * capture outgoing messages and feeds back canned responses.
 */
import {describe, it, expect, beforeEach} from "bun:test"
import {WorkerThreadRpc} from "../src/rpc"
import type {ITMapRpc} from "../src/rpc"

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
    rpc = new WorkerThreadRpc(send, register)
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
      rpc.makeRequest(`add`, [1, 1])
      rpc.makeRequest(`add`, [2, 2])
      rpc.makeRequest(`add`, [3, 3])
      const ids = sentMessages.map((m) => m.id)
      expect(new Set(ids).size).toBe(3)
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
})
