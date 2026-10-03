/**
 * Unit tests for WorkerThreadInit — base class behavior in main-thread test context.
 *
 * In the test environment, `parentPort` from `node:worker_threads` is `null`
 * (because we run on the main thread). This makes the base class safe to
 * instantiate: the `?.` short-circuits both `init()` and `send()` paths.
 */
import {beforeEach, describe, expect, it} from "bun:test"
import {EventEmitter} from "node:events"
import {isMainThread, parentPort} from "node:worker_threads"
import {WorkerThreadErrorHandler} from "../src/error-handler"
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
      // Fire-and-forget returns the send function's result — now `false`
      // (send() reports delivery; parentPort is null on the main thread so
      // the payload is dropped). Updated from the old `undefined` assertion
      // to match the boolean send() contract.
      expect(result).toBe(false)
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

  describe(`regression: constructor defers readyResolve past subclass field init`, () => {
    it(`does not send readyResolve synchronously; field is set when it is sent`, async () => {
      const observed: Array<unknown> = []
      let syncSendCount = 0
      class FieldWorker extends WorkerThreadInit {
        value = 42
        override send(payload: Record<string, unknown>) {
          observed.push((this as unknown as {value?: unknown}).value)
          return super.send(payload)
        }
      }
      const worker = new FieldWorker()
      syncSendCount = observed.length
      expect(syncSendCount).toBe(0)
      expect(worker.value).toBe(42)
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(observed.length).toBeGreaterThanOrEqual(1)
      expect(observed[0]).toBe(42)
    })
  })

  describe(`regression: init() is idempotent`, () => {
    it(`second init() adds no duplicate message listener`, () => {
      const worker = new MinimalWorker()
      const port = new EventEmitter() as unknown as {postMessage: (payload: unknown) => void} & EventEmitter
      port.postMessage = () => {}
      ;(worker as unknown as {parentPort: unknown}).parentPort = port
      worker.init()
      worker.init()
      expect(port.listenerCount(`message`)).toBe(1)
    })
  })

  describe(`regression: shutdown() always cleans up + runs once`, () => {
    function makeShutdownWorker(hook: () => void | Promise<void>) {
      const worker = new MinimalWorker()
      let hookCalls = 0
      const closed = {server: 0, clients: 0}
      worker.onBeforeExit = () => {
        hookCalls += 1
        return hook()
      }
      ;(worker as unknown as {gatewayServer: unknown}).gatewayServer = {
        async close() {
          closed.server += 1
        }
      }
      const client = {
        async close() {
          closed.clients += 1
        }
      }
      worker.gatewayClients.set(`/tmp/regression.sock`, client as never)
      worker.gatewayClientLatest = client as never
      return {worker, hookCalls: () => hookCalls, closed}
    }

    it(`gateway cleanup runs even when onBeforeExit throws`, async () => {
      const {worker, closed} = makeShutdownWorker(() => {
        throw new Error(`flush-failed`)
      })
      let caught: unknown
      try {
        await worker.shutdown()
      } catch (err) {
        caught = err
      }
      expect(caught).toBeInstanceOf(Error)
      expect(closed.server).toBe(1)
      expect(closed.clients).toBe(1)
      expect(worker.gatewayClients.size).toBe(0)
      expect(worker.gatewayServer).toBeUndefined()
      expect(worker.gatewayClientLatest).toBeUndefined()
    })

    it(`second shutdown() returns true without re-running the hook`, async () => {
      let hookCalls = 0
      const worker = new MinimalWorker()
      worker.onBeforeExit = () => {
        hookCalls += 1
      }
      await worker.shutdown()
      const second = await worker.shutdown()
      expect(second).toBe(true)
      expect(hookCalls).toBe(1)
    })
  })

  describe(`regression: default onError forwards to WorkerThreadErrorHandler.report`, () => {
    it(`routes the error to WorkerThreadErrorHandler.setDefault (silent by default, observable when set)`, () => {
      const seen: Array<unknown> = []
      WorkerThreadErrorHandler.setDefault((err) => seen.push(err))
      try {
        const worker = new MinimalWorker()
        const boom = new Error(`rpc-boom`)
        worker.onError(boom)
        expect(seen).toEqual([boom])
      } finally {
        WorkerThreadErrorHandler.setDefault(() => {})
      }
    })

    it(`WorkerThreadErrorHandler.report itself is the observable seam`, () => {
      const seen: Array<unknown> = []
      WorkerThreadErrorHandler.setDefault((err) => seen.push(err))
      try {
        WorkerThreadErrorHandler.report(new Error(`direct`))
        expect(seen).toHaveLength(1)
      } finally {
        WorkerThreadErrorHandler.setDefault(() => {})
      }
    })
  })

  describe(`regression: send() returns boolean`, () => {
    it(`returns false when parentPort is null`, () => {
      const worker = new MinimalWorker()
      expect(worker.parentPort).toBeNull()
      expect(worker.send({hello: `world`})).toBe(false)
    })

    it(`returns true when parentPort accepts the message`, () => {
      const worker = new MinimalWorker()
      const posted: Array<unknown> = []
      ;(worker as unknown as {parentPort: unknown}).parentPort = {
        postMessage(payload: unknown) {
          posted.push(payload)
        }
      }
      expect(worker.send({hello: `world`})).toBe(true)
      expect(posted).toEqual([{hello: `world`}])
    })
  })
})
