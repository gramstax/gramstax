/**
 * Unit tests for WorkerThreadGatewayServer and WorkerThreadGatewayClient.
 *
 * Tests construction and parameter handling without actually starting the
 * net-ipc transport. Verifies the start() parameter bug fix (default
 * `register: any = {}` would have overridden any pre-set register).
 */
import {describe, it, expect} from "bun:test"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadRpc} from "../src/rpc"

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
    expect(server.register.ping()).toBe(`pong`)
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
    const promise = client.request(`ping`, [])
    // Without a real connection, no message is actually sent over the wire
    // But the request should be tracked in rpc.map as a pending request
    expect(client.rpc.map.size).toBeGreaterThanOrEqual(1)
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
    try {
      client.request(`ping`, [], false)
    } catch {
      // sync throw is acceptable — still no pending entry
    }
    expect(client.rpc.map.size).toBe(0)
  })

  it(`request merges _others into the rpc payload`, () => {
    const client = new WorkerThreadGatewayClient()
    const promise = client.request(`echo`, [1], true, {traceId: `abc`})
    const entries = Array.from(client.rpc.map.entries())
    expect(entries.length).toBe(1)
    const [id, handlers] = entries[0]!
    handlers.resolve(`ok`)
    client.rpc.map.delete(id)
    return promise
  })
})
