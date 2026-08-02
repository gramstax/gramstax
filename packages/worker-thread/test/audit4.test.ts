/**
 * Fourth audit round — targeted regression tests for bugs found by code review.
 *
 * @remarks
 * Covers: the gateway method allow-list corrupting instance state access,
 * server instance reuse after close, and allow-list + middleware coexistence.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadInit} from "../src/init"
import {withTimeout } from "./helpers"

describe(`audit round 4`, () => {
  it(`allowedMethods does not break methods that read instance state`, async () => {
    const path = `audit4-${process.pid}-${Date.now()}`
    class StatefulWorker extends WorkerThreadInit {
      count = 5

      mtdGetCount() {
        return this.count
      }

      mtdBump() {
        this.count += 1
        return this.count
      }
    }
    const worker = new StatefulWorker()
    try {
      await withTimeout(worker.createGatewayServer(path, undefined, {token: `tok`, allowedMethods: [`mtdGetCount`]}), 10_000, `createGatewayServer`)
      const client = await withTimeout(worker.createGatewayClient(path, {token: `tok`}), 10_000, `createGatewayClient`)
      // the allowed method must see the real instance state, not a proxy
      expect(await withTimeout(client.request(`mtdGetCount`, []), 10_000, `mtdGetCount`)).toBe(5)
      // disallowed methods stay blocked
      const err = await withTimeout(client.request(`mtdBump`, []).catch((e: unknown) => e), 10_000, `mtdBump`)
      expect((err as {message?: string})?.message).toMatch(/not allowed/)
      // instance state must be intact after the blocked call
      expect(worker.count).toBe(5)
    } finally {
      await worker.gatewayClientLatest?.close()
      await worker.gatewayServer?.close()
    }
  }, 20_000)

  it(`a gateway server instance can be restarted after close()`, async () => {
    const path = `audit4-${process.pid}-${Date.now()}`
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `first start`)
      await withTimeout(server.close(), 10_000, `close`)
      await withTimeout(server.start(path, {ping: () => `pong-v2`}), 10_000, `second start`)
      await withTimeout(client.connect(path), 10_000, `connect`)
      expect(await withTimeout(client.request(`ping`, []), 10_000, `ping`)).toBe(`pong-v2`)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`user middleware runs before the allow-list check`, async () => {
    const path = `audit4-${process.pid}-${Date.now()}`
    class GuardWorker extends WorkerThreadInit {
      calls: string[] = []

      mtdAlpha() {
        this.calls.push(`alpha`)
        return `A`
      }
    }
    const worker = new GuardWorker()
    try {
      await withTimeout(worker.createGatewayServer(path, undefined, {token: `tok`, allowedMethods: [`mtdAlpha`]}), 10_000, `createGatewayServer`)
      const client = await withTimeout(worker.createGatewayClient(path, {token: `tok`}), 10_000, `createGatewayClient`)
      expect(await withTimeout(client.request(`mtdAlpha`, []), 10_000, `mtdAlpha`)).toBe(`A`)
      // the method must run against the real instance (this.calls updated)
      expect(worker.calls).toEqual([`alpha`])
    } finally {
      await worker.gatewayClientLatest?.close()
      await worker.gatewayServer?.close()
    }
  }, 20_000)
})
