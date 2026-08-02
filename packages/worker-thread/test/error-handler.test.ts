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
    const client = new WorkerThreadGatewayClient()
    try {
      // connecting to a nonexistent pipe fails fast and fires an error event
      await client.connect(`dead-pipe-${process.pid}-${Date.now()}`, {reconnect: false, retries: 1, maxRetryTime: 10}).catch(() => {})
      await withTimeout(waitFor(() => seen.length > 0, 5_000), 8_000, `error routed to default handler`)
      expect(seen.length).toBeGreaterThan(0)
    } finally {
      await client.destroy()
    }
  }, 15_000)
})
