/**
 * Seventh audit round — targeted regression tests for bugs found by code review.
 *
 * @remarks
 * Covers: requests hanging when the transport dies (net-ipc resolves send
 * failures with an Error object instead of rejecting), `isClosed()` state
 * transitions, and `status` event forwarding.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {sleep, withTimeout } from "./helpers"

describe(`audit round 7`, () => {
  it(`request() rejects when the transport dies, instead of hanging`, async () => {
    const path = `audit7-${process.pid}-${Date.now()}`
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `server start`)
      // reconnect disabled so the send fails immediately once the server dies
      await withTimeout(client.connect(path, {reconnect: false}), 10_000, `connect`)
      expect(await withTimeout(client.request(`ping`, []), 10_000, `ping`)).toBe(`pong`)

      // kill the server abruptly (no graceful END) — the client's socket dies
      await withTimeout(server.server.close(true), 10_000, `server close`)
      await sleep(500)

      const err = await withTimeout(client.request(`ping`, []).catch((e: unknown) => e), 5_000, `request after death`)
      expect(err).toBeInstanceOf(Error)
    } finally {
      await client.close()
      await server.close()
    }
  }, 25_000)

  it(`isClosed() reflects the client lifecycle`, async () => {
    const client = new WorkerThreadGatewayClient()
    expect(client.isClosed()).toBe(false)
    await withTimeout(client.close(), 5_000, `close`)
    expect(client.isClosed()).toBe(true)

    const client2 = new WorkerThreadGatewayClient()
    client2.destroy()
    expect(client2.isClosed()).toBe(true)
  }, 10_000)

  it(`status events are forwarded (including READY)`, async () => {
    const path = `audit7-${process.pid}-${Date.now()}`
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    const statuses: number[] = []
    client.on(`status`, (s: number) => statuses.push(s))
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `connect`)
      // 3 = READY per net-ipc's ClientStatus enum
      expect(statuses).toContain(3)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)
})
