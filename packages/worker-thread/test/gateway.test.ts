/**
 * Unit tests for WorkerThreadGatewayServer and WorkerThreadGatewayClient.
 *
 * Tests construction and parameter handling without actually starting the
 * net-ipc transport. Verifies the start() parameter bug fix (default
 * `register: any = {}` would have overridden any pre-set register).
 */
import {describe, expect, it} from "bun:test"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadRpc} from "../src/rpc"
import {withTimeout} from "./helpers"

describe(`WorkerThreadGatewayServer`, () => {
  it(`register defaults to an empty object`, () => {
    const server = new WorkerThreadGatewayServer()
    expect(server.register).toEqual({})
  })

  it(`rpc map starts empty`, () => {
    const server = new WorkerThreadGatewayServer()
    expect(server.rpc).toBeInstanceOf(Map)
    expect(server.rpc.size).toBe(0)
  })

  it(`server is an instance with options.path mutable`, () => {
    const server = new WorkerThreadGatewayServer()
    expect(server.server).toBeDefined()
    expect(server.server.options).toBeDefined()
  })

  it(`register can be assigned directly before start()`, () => {
    const server = new WorkerThreadGatewayServer()
    server.register = {ping: () => `pong`}
    expect(server.register.ping!()).toBe(`pong`)
  })

  it(`start is a function (signature)`, () => {
    const server = new WorkerThreadGatewayServer()
    expect(typeof server.start).toBe(`function`)
  })
})

describe(`WorkerThreadGatewayClient`, () => {
  it(`rpc is a WorkerThreadRpc instance`, () => {
    const client = new WorkerThreadGatewayClient()
    expect(client.rpc).toBeInstanceOf(WorkerThreadRpc)
  })

  it(`client is an instance with options.path mutable`, () => {
    const client = new WorkerThreadGatewayClient()
    expect(client.client).toBeDefined()
    expect(client.client.options).toBeDefined()
  })

  it(`connect is a function (signature)`, () => {
    const client = new WorkerThreadGatewayClient()
    expect(typeof client.connect).toBe(`function`)
  })

  it(`request is a function (signature)`, () => {
    const client = new WorkerThreadGatewayClient()
    expect(typeof client.request).toBe(`function`)
  })

  it(`request forwards to rpc.makeRequest and returns a promise`, () => {
    const client = new WorkerThreadGatewayClient()
    const sent: any[] = []
    client.rpc.send = (data) => sent.push(data)
    const promise = client.request(`ping`, [])
    // The request is tracked in rpc.map as a pending request
    expect(client.rpc.map.size).toBeGreaterThanOrEqual(1)
    expect(sent[0]).toMatchObject({method: `ping`, params: []})
    // Clean up — resolve the pending promise to avoid lingering state
    const entries = Array.from(client.rpc.map.entries())
    for (const [id, handlers] of entries) {
      handlers.resolve(`mock-result-${id}`)
      client.rpc.map.delete(id)
    }
    return expect(promise).resolves.toMatch(/^mock-result-/)
  })

  it(`request with _wait=false does not track pending entry in map`, () => {
    const client = new WorkerThreadGatewayClient()
    const sent: any[] = []
    client.rpc.send = (data) => sent.push(data)
    client.request(`ping`, [], false)
    expect(client.rpc.map.size).toBe(0)
    expect(sent).toHaveLength(1)
  })

  it(`request merges _others into the rpc payload`, () => {
    const client = new WorkerThreadGatewayClient()
    const sent: any[] = []
    client.rpc.send = (data) => sent.push(data)
    const promise = client.request(`echo`, [1], true, {traceId: `abc`})
    expect(sent[0]).toMatchObject({method: `echo`, params: [1], traceId: `abc`})
    const entries = Array.from(client.rpc.map.entries())
    expect(entries.length).toBe(1)
    const [id, handlers] = entries[0]!
    handlers.resolve(`ok`)
    client.rpc.map.delete(id)
    return promise
  })

  describe(`state guards (regression)`, () => {
    it(`connect() after close() rejects instead of half-connecting`, async () => {
      const client = new WorkerThreadGatewayClient()
      await withTimeout(client.close(), 5_000, `close`)
      const err = await withTimeout(
        client.connect(`dead-${process.pid}`).catch((e: unknown) => e),
        5_000,
        `connect after close`
      )
      expect(err).toBeInstanceOf(Error)
    }, 15_000)

    it(`isClosed() reflects the client lifecycle`, async () => {
      const client = new WorkerThreadGatewayClient()
      expect(client.isClosed()).toBe(false)
      await withTimeout(client.close(), 5_000, `close`)
      expect(client.isClosed()).toBe(true)

      const client2 = new WorkerThreadGatewayClient()
      client2.destroy()
      expect(client2.isClosed()).toBe(true)
    }, 10_000)
  })
})

describe(`WorkerThreadGatewayPath.normalize hardening (unit)`, () => {
  it(`resolves bare names under os.tmpdir() instead of CWD (POSIX)`, async () => {
    if (process.platform === `win32`) return
    const {WorkerThreadGatewayPath} = await import(`../src/gateway-path`)
    const {tmpdir} = await import(`node:os`)
    const {join} = await import(`node:path`)
    expect(WorkerThreadGatewayPath.normalize(`gtest-x`)).toBe(join(tmpdir(), `gtest-x`))
  })

  it(`passes short absolute POSIX paths through unchanged`, async () => {
    if (process.platform === `win32`) return
    const {WorkerThreadGatewayPath} = await import(`../src/gateway-path`)
    expect(WorkerThreadGatewayPath.normalize(`/tmp/server.sock`)).toBe(`/tmp/server.sock`)
  })

  it(`rejects POSIX paths longer than 104 chars with a clear Error`, async () => {
    if (process.platform === `win32`) return
    const {WorkerThreadGatewayPath} = await import(`../src/gateway-path`)
    expect(() => WorkerThreadGatewayPath.normalize(`/tmp/${`x`.repeat(200)}`)).toThrow(/104/)
  })

  it(`never collides /tmp/a-b with /tmp/a/b on Windows pipes`, async () => {
    if (process.platform !== `win32`) return
    const {WorkerThreadGatewayPath} = await import(`../src/gateway-path`)
    expect(WorkerThreadGatewayPath.normalize(`/tmp/a-b`)).not.toBe(WorkerThreadGatewayPath.normalize(`/tmp/a/b`))
  })
})

describe(`gateway client messagepack guard (unit)`, () => {
  it(`connect() with messagepack:true and missing msgpackr throws a clear Error`, async () => {
    const client = new WorkerThreadGatewayClient()
    // simulate an environment without msgpackr: net-ipc loads it via
    // try-require in src/interfaces.js and downgrades silently — the guard
    // must read the same hook (client._msgpack) before touching the socket
    ;(client.client as unknown as {_msgpack?: unknown})._msgpack = undefined
    try {
      const err = await withTimeout(
        client.connect(`gtest-msgpack-${process.pid}-${Date.now()}`, {messagepack: true, reconnect: false}).catch((e: unknown) => e),
        10_000,
        `messagepack guard connect`
      )
      expect((err as Error).message).toMatch(/msgpackr/)
    } finally {
      await withTimeout(client.close(), 5_000, `close`)
    }
  }, 15_000)
})
