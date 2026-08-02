/**
 * Unit tests for WorkerThreadInit — base class behavior in main-thread test context.
 *
 * In the test environment, `parentPort` from `node:worker_threads` is `null`
 * (because we run on the main thread). This makes the base class safe to
 * instantiate: the `?.` short-circuits both `init()` and `send()` paths.
 */
import {beforeEach, describe, expect, it } from "bun:test"
import {isMainThread, parentPort } from "node:worker_threads"
import {WorkerThreadInit} from "../src/init"
import {WorkerThreadRpc} from "../src/rpc"

class MinimalWorker extends WorkerThreadInit {
  mtdAdd(a: number, b: number) {
    return a + b
  }

  async mtdDouble(x: number) {
    return x * 2
  }

  mtdGetId() {
    return this.id
  }
}

describe(`WorkerThreadInit`, () => {
  describe(`environment (sanity)`, () => {
    it(`parentPort is null in main-thread test context`, () => {
      expect(parentPort).toBeNull()
    })

    it(`isMainThread is true in test context`, () => {
      expect(isMainThread).toBe(true)
    })
  })

  describe(`instance defaults`, () => {
    let worker: MinimalWorker

    beforeEach(() => {
      worker = new MinimalWorker()
    })

    it(`exposes process.argv as the argv property`, () => {
      expect(worker.argv).toBe(process.argv)
    })

    it(`id mirrors node:worker_threads threadId (always 0 on main thread)`, () => {
      expect(worker.id).toBe(0)
    })

    it(`pid mirrors process.pid`, () => {
      expect(worker.pid).toBe(process.pid)
    })

    it(`parentPort is null in main-thread test context`, () => {
      expect(worker.parentPort).toBeNull()
    })

    it(`gatewayClients starts as an empty Map`, () => {
      expect(worker.gatewayClients).toBeInstanceOf(Map)
      expect(worker.gatewayClients.size).toBe(0)
    })

    it(`gatewayServer is undefined initially`, () => {
      expect(worker.gatewayServer).toBeUndefined()
    })

    it(`gatewayClient getter returns gatewayClientLatest (undefined initially)`, () => {
      expect(worker.gatewayClient).toBeUndefined()
    })

    it(`rpc is a WorkerThreadRpc instance`, () => {
      expect(worker.rpc).toBeInstanceOf(WorkerThreadRpc)
    })
  })

  describe(`createGatewayServer`, () => {
    it(`is a function (signature) — path is required, no static fallback`, () => {
      const worker = new MinimalWorker()
      expect(typeof worker.createGatewayServer).toBe(`function`)
    })
  })

  describe(`send`, () => {
    it(`is a no-op when parentPort is null (no throw, no error)`, () => {
      const worker = new MinimalWorker()
      expect(() => worker.send({hello: `world`})).not.toThrow()
    })
  })

  describe(`request`, () => {
    it(`forwards method/params to rpc.makeRequest (pending entry in rpc.map)`, () => {
      const worker = new MinimalWorker()
      const promise = worker.request(`mtdAdd`, [1, 2]) as Promise<unknown>
      expect(worker.rpc.map.size).toBeGreaterThanOrEqual(1)
      promise.catch(() => {})
      worker.rpc.map.clear()
    })

    it(`respects _wait parameter (fire-and-forget returns send result)`, () => {
      const worker = new MinimalWorker()
      const result = worker.request(`mtdAdd`, [1, 2], false)
      // Fire-and-forget returns the send function's result, which is undefined (postMessage returns undefined)
      expect(result).toBeUndefined()
    })

    it(`merges _others into the payload (still tracked as pending entry)`, () => {
      const worker = new MinimalWorker()
      const promise = worker.request(`mtdAdd`, [1, 2], true, {traceId: `xyz`}) as Promise<unknown>
      expect(worker.rpc.map.size).toBeGreaterThanOrEqual(1)
      promise.catch(() => {})
      worker.rpc.map.clear()
    })
  })

  describe(`isMainThread static`, () => {
    it(`mirrors node:worker_threads isMainThread`, () => {
      expect(WorkerThreadInit.isMainThread).toBe(true)
    })
  })
})
