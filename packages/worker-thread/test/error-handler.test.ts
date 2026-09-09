/**
 * Tests for the package-wide default error handler.
 *
 * @remarks
 * Library code never writes to the console — errors without an instance
 * `error` listener are routed to `setDefaultErrorHandler` (silent by
 * default), so consumers control where errors go.
 */
import {afterEach, describe, expect, it } from "bun:test"
import {reportError, setDefaultErrorHandler} from "../src/error-handler"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {waitFor, withTimeout } from "./helpers"

describe(`default error handler`, () => {
  afterEach(() => {
    setDefaultErrorHandler(() => {})
  })

  it(`routes errors through setDefaultErrorHandler`, () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => seen.push(err))
    reportError(new Error(`boom`))
    expect(seen).toHaveLength(1)
    expect((seen[0] as Error).message).toBe(`boom`)
  })

  it(`is silent by default — no throw, no output`, () => {
    expect(() => reportError(new Error(`quiet`))).not.toThrow()
  })

  it(`routes gateway transport errors to the default handler when no listeners`, async () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => seen.push(err))
    const path = `eh-${process.pid}-${Date.now()}`
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `server start`)
      await withTimeout(client.connect(path, {reconnect: false}), 10_000, `connect`)
      // Simulate a raw socket transport failure (peer reset): the socket must
      // be guarded by our error listener, and with no instance 'error'
      // listener the error has to be routed to the default handler.
      client.client.connection?.emit(`error`, Object.assign(new Error(`socket reset`), {code: `ECONNRESET`}))
      await withTimeout(waitFor(() => seen.length > 0, 5_000), 8_000, `error routed to default handler`)
      expect(seen.length).toBeGreaterThan(0)
    } finally {
      await client.destroy()
      await server.close()
    }
  }, 20_000)

  it(`a throwing default error handler never crashes the transport`, () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => {
      seen.push(err)
      throw new Error(`handler exploded`)
    })
    expect(() => reportError(new Error(`transport error`))).not.toThrow()
    expect(seen).toHaveLength(1)
  })
})

describe(`regression (m): setDefaultErrorHandler validation`, () => {
  afterEach(() => {
    setDefaultErrorHandler(() => {})
  })

  it(`throws TypeError on non-function arguments`, () => {
    for (const bad of [123, `handler`, null, {}, true]) {
      expect(() => setDefaultErrorHandler(bad as any)).toThrow(TypeError)
    }
  })

  it(`calling with undefined resets to the silent default`, () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => seen.push(err))
    reportError(new Error(`before reset`))
    expect(seen).toHaveLength(1)
    setDefaultErrorHandler(undefined as any)
    expect(() => reportError(new Error(`after reset`))).not.toThrow()
    expect(seen).toHaveLength(1)
    // a fresh handler can be installed after the reset
    setDefaultErrorHandler((err) => seen.push(err))
    reportError(new Error(`after reinstall`))
    expect(seen).toHaveLength(2)
  })
})
