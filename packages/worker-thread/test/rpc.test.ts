/**
 * Unit tests for WorkerThreadRpc — pure logic, no worker threads.
 *
 * Tests the JSON-RPC dispatcher's request/result/error handling without
 * spawning any actual worker threads. Uses a stub `send` function to
 * capture outgoing messages and feeds back canned responses.
 */
import {afterEach, beforeEach, describe, expect, it } from "bun:test"
import type {ITMapRpc} from "../src/rpc"
import * as RpcModule from "../src/rpc"
import {estimatePayloadSize, WorkerThreadRpc} from "../src/rpc"
import {setDefaultErrorHandler} from "../src/error-handler"
import {sleep, withTimeout } from "./helpers"

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

  describe(`envelope integrity (regression)`, () => {
    it(`_others cannot override the reserved id/method/params fields`, () => {
      rpc.makeRequest(`add`, [1, 2], true, {id: 999, method: `evil`, params: [`x`]})
      expect(sentMessages[0]!.method).toBe(`add`)
      expect(sentMessages[0]!.params).toEqual([1, 2])
      expect(sentMessages[0]!.id).not.toBe(999)
    })

    it(`context cannot override the reserved id/method/params fields`, () => {
      rpc.context = {id: 777, method: `hijack`}
      rpc.makeRequest(`add`, [1, 2])
      expect(sentMessages[0]!.method).toBe(`add`)
      expect(sentMessages[0]!.id).not.toBe(777)
    })
  })

  describe(`undefined result handling (regression)`, () => {
    it(`response carries null instead of undefined so the caller never hangs`, async () => {
      const sent: any[] = []
      const undefRpc = new WorkerThreadRpc((data) => sent.push(data), {returnsUndefined: () => undefined})
      const promise = undefRpc.makeRequest(`returnsUndefined`, []) as Promise<unknown>
      await undefRpc.make({id: sent[0]!.id, method: `returnsUndefined`, params: []})
      // the wire cannot carry undefined — the response must carry null
      expect(sent[1]).toMatchObject({id: sent[0]!.id, result: null})
      await undefRpc.make(sent[1]!)
      expect(await withTimeout(promise, 2000, `undefined result`)).toBe(null)
    })

    it(`short-circuited middleware without a result resolves instead of hanging`, async () => {
      const sent: any[] = []
      const shortRpc = new WorkerThreadRpc((data) => sent.push(data), {})
      shortRpc.use(async (ctx) => {
        ctx.result = undefined // short-circuit, forget to set a result
      })
      await shortRpc.make({id: 1, method: `whatever`, params: []})
      expect(sent[0]).toMatchObject({id: 1, result: null})
    })
  })

  describe(`malformed inbound payloads (regression)`, () => {
    it(`make() tolerates malformed payloads without crashing`, async () => {
      await rpc.make(null as any)
      await rpc.make(undefined as any)
      await rpc.make({} as any)
      await rpc.make({method: `x`} as any)
      await rpc.make({result: 5} as any)
      await rpc.make({id: 100, method: 123 as any, params: []} as any)
      await rpc.make({id: 101, method: `x`, params: null} as any)
      await rpc.make({id: 1, method: `add`, params: [2, 3]})
      // id-less payloads are dispatched but answered to nobody; the keyed
      // invalid requests produced error responses; the valid one produced a result
      expect(sentMessages).toHaveLength(3)
      const errors = sentMessages.filter((m) => m?.error !== undefined)
      expect(errors.map((m) => m?.id).sort()).toEqual([100, 101])
      expect(sentMessages.some((m) => m?.result === 5)).toBe(true)
    })

    it(`make() with non-array params responds with an error, not a hang`, async () => {
      await rpc.make({id: 1, method: `add`, params: `oops`} as any)
      expect(sentMessages[0]!.id).toBe(1)
      expect(sentMessages[0]!.error).toBeDefined()
    })

    it(`make() rejects a non-string method with an error envelope`, async () => {
      await rpc.make({id: 2, method: 123 as any, params: []} as any)
      const errMsg = sentMessages.find((m) => m?.id === 2)?.error
      expect(errMsg).toBeDefined()
    })

    it(`make() rejects non-array params with an error envelope on every runtime`, async () => {
      await rpc.make({id: 3, method: `add`, params: `oops`} as any)
      await rpc.make({id: 4, method: `add`, params: {a: 1, b: 2} as any} as any)
      const errors = sentMessages.filter((m) => m?.error !== undefined)
      expect(errors.map((m) => m?.id).sort()).toEqual([3, 4])
    })

    it(`make() handles id 0 correctly`, async () => {
      await rpc.make({id: 0, method: `add`, params: [1, 2]})
      expect(sentMessages[0]).toMatchObject({id: 0, result: 3})
    })
  })
})

/**
 * Regression tests for the rpc.ts hardening batch.
 *
 * Each item below first reproduces a claimed bug against the unfixed code
 * (red), then guards the fix (green). Behavior-neutral items (j, n) are
 * green-green guards documenting no observable change.
 */
function makeStubRpc(register?: Record<string, (...args: never[]) => unknown>) {
  const sent: any[] = []
  const stub = new WorkerThreadRpc((data) => {
    sent.push(data)
  }, register ?? {add: (a: number, b: number) => a + b})
  return {sent, stub}
}

describe(`regression (a): make() non-object guard`, () => {
  it(`ignores null/non-object payloads without throwing or replying`, async () => {
    const {sent, stub} = makeStubRpc()
    for (const bad of [null, undefined, 42, `nope`, true]) {
      await stub.make(bad as any)
    }
    expect(sent).toHaveLength(0)
  })
})

describe(`regression (b): prototype methods are not remotely callable`, () => {
  it(`rejects toString/constructor/hasOwnProperty with not-found errors`, async () => {
    const {sent, stub} = makeStubRpc()
    await stub.make({id: 1, method: `toString`, params: []})
    expect(sent[0]?.error).toBeDefined()
    expect(String(sent[0]?.error?.message ?? sent[0]?.error)).toMatch(/not found/)
    await stub.make({id: 2, method: `constructor`, params: []})
    expect(sent[1]?.error).toBeDefined()
    await stub.make({id: 3, method: `hasOwnProperty`, params: []})
    expect(sent[2]?.error).toBeDefined()
  })
})

describe(`regression (c): default request timeout`, () => {
  it(`exports DEFAULT_REQUEST_TIMEOUT_MS = 30000`, () => {
    expect((RpcModule as any).DEFAULT_REQUEST_TIMEOUT_MS).toBe(30000)
  })

  it(`new instances default defaultTimeoutMs to 30000`, () => {
    const {stub} = makeStubRpc()
    expect((stub as any).defaultTimeoutMs).toBe(30000)
  })

  it(`accepts defaultTimeoutMs via constructor options`, () => {
    const sent: any[] = []
    const stub = new WorkerThreadRpc((data) => sent.push(data), {}, {defaultTimeoutMs: 123} as any)
    expect((stub as any).defaultTimeoutMs).toBe(123)
  })

  it(`applies the instance default when timeoutMs is omitted`, async () => {
    const {stub} = makeStubRpc()
    ;(stub as any).defaultTimeoutMs = 40
    const promise = stub.makeRequest(`add`, [1, 2]) as Promise<unknown>
    await expect(withTimeout(promise, 2000, `instance default timeout`)).rejects.toThrow(/timeout after 40ms/)
  })

  it(`explicit timeoutMs overrides the instance default`, async () => {
    const {stub, sent} = makeStubRpc()
    ;(stub as any).defaultTimeoutMs = 30
    const promise = stub.makeRequest(`add`, [1, 2], true, undefined, 500) as Promise<unknown>
    promise.catch(() => {})
    await sleep(80)
    // would already have timed out under the 30ms default
    expect(stub.map.size).toBe(1)
    await stub.make({id: sent[0]!.id, result: 3})
    expect(await withTimeout(promise, 2000, `explicit override`)).toBe(3)
  })

  it(`explicit 0 stays infinite even with an instance default (back-compat)`, async () => {
    const {stub} = makeStubRpc()
    ;(stub as any).defaultTimeoutMs = 30
    const promise = stub.makeRequest(`add`, [1, 2], true, undefined, 0) as Promise<unknown>
    promise.catch(() => {})
    await sleep(80)
    expect(stub.map.size).toBe(1)
    stub.rejectAllPending(new Error(`cleanup`))
    await expect(promise).rejects.toThrow(/cleanup/)
  })

  it(`throws TypeError on negative/NaN/non-number timeoutMs`, () => {
    const {stub} = makeStubRpc()
    for (const bad of [-5, NaN, `fast`]) {
      let threw: unknown = null
      try {
        const ret = stub.makeRequest(`add`, [1, 2], true, undefined, bad as any) as unknown as Promise<unknown>
        if (ret && typeof (ret as any).catch === `function`) {
          ;(ret as any).catch(() => {})
          stub.rejectAllPending(new Error(`cleanup`))
        }
      } catch (err) {
        threw = err
      }
      expect(threw).toBeInstanceOf(TypeError)
    }
    expect(stub.map.size).toBe(0)
  })
})

describe(`regression (d): timeout timer is unrefd`, () => {
  it(`calls unref on the timer right after creation`, () => {
    const g = globalThis as any
    const origSetTimeout = g.setTimeout
    let unrefCalled = false
    const fake = (...args: any[]): any => {
      const t = origSetTimeout(...args)
      const prev = t?.unref?.bind(t)
      if (typeof prev === `function`) {
        t.unref = (...rest: any[]) => {
          unrefCalled = true
          return prev(...rest)
        }
      }
      return t
    }
    g.setTimeout = fake
    const {stub} = makeStubRpc()
    try {
      const promise = stub.makeRequest(`add`, [1, 2], true, undefined, 50) as Promise<unknown>
      promise.catch(() => {})
      expect(unrefCalled).toBe(true)
      stub.rejectAllPending(new Error(`cleanup`))
    } finally {
      g.setTimeout = origSetTimeout
    }
  })
})

describe(`regression (e): single-call next() guard`, () => {
  it(`second next() call throws and surfaces as an error response`, async () => {
    const sent: any[] = []
    let calls = 0
    const stub = new WorkerThreadRpc((data) => sent.push(data), {add: () => {
      calls++
      return 1
    }})
    stub.use(async (_ctx, next) => {
      await next()
      await next()
    })
    await stub.make({id: 1, method: `add`, params: []})
    expect(calls).toBe(1)
    expect(sent[0]?.error).toBeDefined()
    expect(String(sent[0]?.error?.message ?? sent[0]?.error)).toMatch(/multiple|next/)
  })
})

describe(`regression (f): undefined results resolve via key presence`, () => {
  it(`resolves a pending request when result is present-but-undefined (msgpack)`, async () => {
    const {sent, stub} = makeStubRpc()
    const promise = stub.makeRequest(`add`, [1, 2]) as Promise<unknown>
    await stub.make({id: sent[0]!.id, result: undefined})
    expect(await withTimeout(promise, 1000, `undefined result`)).toBeUndefined()
  })
})

describe(`regression (g): mixed envelope resolves pending first`, () => {
  it(`prefers pending resolution over request dispatch when both apply`, async () => {
    const {sent, stub} = makeStubRpc()
    const promise = stub.makeRequest(`add`, [1, 2]) as Promise<unknown>
    await stub.make({id: sent[0]!.id, method: `add`, params: [1, 2], result: 99} as any)
    expect(await withTimeout(promise, 1000, `mixed envelope`)).toBe(99)
    expect(sent).toHaveLength(1)
  })
})

describe(`regression (h): transport-send failures route to reportError`, () => {
  afterEach(() => {
    setDefaultErrorHandler(() => {})
  })

  it(`reports synchronous send throws from make()`, async () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => seen.push(err))
    try {
      const boom = new WorkerThreadRpc(() => {
        throw new Error(`transport down`)
      }, {add: () => 1})
      await boom.make({id: 1, method: `add`, params: []})
      expect(seen.length).toBeGreaterThan(0)
    } finally {
      setDefaultErrorHandler(() => {})
    }
  })

  it(`reports async send rejections from make()`, async () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => seen.push(err))
    try {
      const boom = new WorkerThreadRpc(() => Promise.reject(new Error(`async transport down`)), {add: () => 1})
      await boom.make({id: 2, method: `add`, params: []})
      await sleep(20)
      expect(seen.length).toBeGreaterThan(0)
    } finally {
      setDefaultErrorHandler(() => {})
    }
  })
})

describe(`regression (i): id-less inbound skips the reply`, () => {
  it(`dispatches id-less requests but answers nobody`, async () => {
    const sent: any[] = []
    let calls = 0
    const stub = new WorkerThreadRpc((data) => sent.push(data), {add: (a: number, b: number) => {
      calls++
      return a + b
    }})
    await stub.make({method: `add`, params: [1, 2]} as any)
    expect(calls).toBe(1)
    expect(sent).toHaveLength(0)
    await stub.make({method: `nope`, params: []} as any)
    expect(sent).toHaveLength(0)
  })
})

describe(`regression (j): single-spread payload guard`, () => {
  it(`builds a correct envelope when others is undefined`, () => {
    const {sent, stub} = makeStubRpc()
    stub.makeRequest(`add`, [1, 2])
    expect(sent[0]).toMatchObject({method: `add`, params: [1, 2]})
    expect(typeof sent[0].id).toBe(`number`)
  })
})

describe(`regression (k): estimatePayloadSize counts Map/Set entries`, () => {
  it(`handles empty Map/Set as zero`, () => {
    expect(estimatePayloadSize(new Map())).toBe(0)
    expect(estimatePayloadSize(new Set())).toBe(0)
  })

  it(`counts Map keys and values instead of Object.keys undercount`, () => {
    expect(estimatePayloadSize(new Map([[`k`, `vvv`]]))).toBe(8)
  })

  it(`counts Set items`, () => {
    expect(estimatePayloadSize(new Set([`ab`]))).toBe(4)
  })
})

describe(`regression (l): non-number response id reports and ignores`, () => {
  afterEach(() => {
    setDefaultErrorHandler(() => {})
  })

  it(`reportErrors and sends nothing on a string response id`, async () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => seen.push(err))
    try {
      const {sent, stub} = makeStubRpc()
      await stub.make({id: `str`, result: 5} as any)
      expect(seen.length).toBeGreaterThan(0)
      expect(sent).toHaveLength(0)
    } finally {
      setDefaultErrorHandler(() => {})
    }
  })
})

describe(`regression (n): makeRequest stays positional`, () => {
  it(`keeps runtime arity so positional callers are unaffected`, () => {
    const {stub} = makeStubRpc()
    expect(stub.makeRequest.length).toBe(2)
  })
})

describe(`regression (o): duplex plumbing is never remotely callable`, () => {
  it(`denies send/request/kill/init/handleOnMessage/gateway factories, allows shutdown`, async () => {
    const {sent, stub} = makeStubRpc({
      send: () => 1,
      request: () => 2,
      kill: () => 3,
      init: () => 4,
      handleOnMessage: () => 5,
      createGatewayServer: () => 6,
      createGatewayClient: () => 7,
      shutdown: () => 8,
      mtdOk: () => 9
    } as any)
    const denied = [`send`, `request`, `kill`, `init`, `handleOnMessage`, `createGatewayServer`, `createGatewayClient`]
    for (const [i, method] of denied.entries()) {
      await stub.make({id: 100 + i, method, params: []})
    }
    expect(sent.filter((m) => m?.error !== undefined)).toHaveLength(denied.length)
    await stub.make({id: 200, method: `shutdown`, params: []})
    await stub.make({id: 201, method: `mtdOk`, params: []})
    expect(sent.find((m) => m?.id === 200)?.result).toBe(8)
    expect(sent.find((m) => m?.id === 201)?.result).toBe(9)
  })
})
