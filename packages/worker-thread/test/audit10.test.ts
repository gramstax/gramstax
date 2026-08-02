/**
 * Tenth audit round — regression tests for defensive fixes and
 * the last untested race.
 *
 * @remarks
 * Covers: concurrent `connect()` calls settling without hanging, a throwing
 * default error handler not crashing the transport, and `kill()` swallowing
 * terminate rejections.
 */
import {afterEach, describe, expect, it } from "bun:test"
import {reportError, setDefaultErrorHandler} from "../src/error-handler"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadLaunch} from "../src/launch"
import {withTimeout } from "./helpers"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`

describe(`audit round 10 (final)`, () => {
  afterEach(() => {
    setDefaultErrorHandler(() => {})
  })

  it(`concurrent connect() calls settle: one resolves, one rejects`, async () => {
    const path = `audit10-${process.pid}-${Date.now()}`
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `server start`)
      const results = await withTimeout(
        Promise.allSettled([client.connect(path), client.connect(path)]),
        10_000,
        `concurrent connects`
      )
      expect(results.filter((r) => r.status === `fulfilled`).length).toBe(1)
      expect(results.filter((r) => r.status === `rejected`).length).toBe(1)
      expect(await withTimeout(client.request(`ping`, []), 10_000, `ping`)).toBe(`pong`)
    } finally {
      await client.close()
      await server.close()
    }
  }, 25_000)

  it(`a throwing default error handler never crashes the transport`, () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => {
      seen.push(err)
      throw new Error(`handler exploded`)
    })
    expect(() => reportError(new Error(`transport error`))).not.toThrow()
    expect(seen).toHaveLength(1)
  })

  it(`kill() resolves even after the worker has fully exited`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.kill(), 10_000, `first kill`)
    await withTimeout(worker.kill(), 10_000, `kill after exit`)
  }, 25_000)
})
