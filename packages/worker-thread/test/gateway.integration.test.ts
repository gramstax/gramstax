/**
 * Integration tests for the gateway — real Unix sockets / named pipes.
 *
 * @remarks
 * Covers auth, method allow-lists, messagepack encoding and auto-reconnect.
 * Every awaited socket operation is wrapped in `withTimeout`, every test
 * passes a bounded bun:test timeout, and cleanup runs in `finally` so a
 * failed test can never leak socket handles (which would hang the runner).
 *
 * Note: `expect(promise).rejects` with a pending socket-backed promise is
 * unreliable under bun test (the response never settles), so rejection
 * assertions resolve the promise first, then assert on the error.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {normalizeGatewayPath} from "../src/gateway-path"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadInit} from "../src/init"
import {sleep, withTimeout } from "./helpers"

let counter = 0
function uniquePath() {
  counter += 1
  return `gtest-${process.pid}-${Date.now()}-${counter}`
}

describe(`normalizeGatewayPath (P2-9)`, () => {
  it(`converts POSIX paths and bare names to named pipes on Windows`, () => {
    if (process.platform !== `win32`) return
    expect(normalizeGatewayPath(`gateway-main`)).toBe(`\\\\.\\pipe\\gateway-main`)
    expect(normalizeGatewayPath(`/tmp/server.sock`)).toBe(`\\\\.\\pipe\\tmp-server.sock`)
    expect(normalizeGatewayPath(`\\\\.\\pipe\\keep`)).toBe(`\\\\.\\pipe\\keep`)
  })

  it(`passes paths through unchanged on POSIX`, () => {
    if (process.platform === `win32`) return
    expect(normalizeGatewayPath(`/tmp/server.sock`)).toBe(`/tmp/server.sock`)
    expect(normalizeGatewayPath(`gateway-main`)).toBe(`gateway-main`)
  })
})

describe(`WorkerThreadGatewayServer/Client integration (real sockets)`, () => {
  it(`round-trips requests over a real socket`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`, add: (a: number, b: number) => a + b}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `client connect`)
      expect(await withTimeout(client.request(`ping`, []), 10_000, `ping`)).toBe(`pong`)
      expect(await withTimeout(client.request(`add`, [2, 3]), 10_000, `add`)).toBe(5)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`rejects empty paths (P2-10)`, async () => {
    const server = new WorkerThreadGatewayServer()
    const err1 = await server.start(``).catch((e: unknown) => e)
    expect((err1 as Error).message).toMatch(/non-empty socket path/)
    const client = new WorkerThreadGatewayClient()
    const err2 = await client.connect(``).catch((e: unknown) => e)
    expect((err2 as Error).message).toMatch(/non-empty socket path/)
  })

  it(`enforces the auth token (P1-6)`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const bad = new WorkerThreadGatewayClient()
    const good = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}, {token: `s3cret`}), 10_000, `server start`)
      const closed = new Promise((resolve) => bad.once(`close`, resolve))
      await withTimeout(bad.connect(path).catch(() => bad), 10_000, `unauthorized connect`)
      await withTimeout(closed, 10_000, `server should close unauthorized client`)

      await withTimeout(good.connect(path, {token: `s3cret`}), 10_000, `authorized connect`)
      expect(await withTimeout(good.request(`ping`, []), 10_000, `ping`)).toBe(`pong`)
    } finally {
      await bad.destroy()
      await good.close()
      await server.close()
    }
  }, 20_000)

  it(`restricts methods via allowedMethods (P1-6)`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`, secret: () => `classified`}, {allowedMethods: [`ping`]}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `client connect`)
      expect(await withTimeout(client.request(`ping`, []), 10_000, `ping`)).toBe(`pong`)
      const err = await withTimeout(client.request(`secret`, []), 10_000, `secret`).catch((e: unknown) => e)
      expect(err).toMatchObject({message: expect.stringContaining(`not allowed`)})
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`preserves Date/BigInt/undefined with messagepack (P2-11)`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {echo: (v: unknown) => v}), 10_000, `server start`)
      await withTimeout(client.connect(path, {messagepack: true}), 10_000, `client connect`)
      const result = (await withTimeout(client.request(`echo`, [{when: new Date(`2026-01-01T00:00:00.000Z`), big: 123n, nothing: undefined}]), 10_000, `echo`)) as {when: Date; big: bigint; nothing: undefined}
      expect(result.when).toBeInstanceOf(Date)
      expect(result.when.toISOString()).toBe(`2026-01-01T00:00:00.000Z`)
      expect(result.big).toBe(123n)
      expect(`nothing` in result).toBe(true)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`reconnects automatically after the server restarts (P0-2)`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    let server2: WorkerThreadGatewayServer | undefined
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `server start`)
      await withTimeout(client.connect(path, {reconnect: true, retries: 200, maxRetryTime: 200}), 10_000, `client connect`)
      expect(await withTimeout(client.request(`ping`, []), 10_000, `ping before restart`)).toBe(`pong`)

      // graceful close with reconnect allowed — simulates a server that restarts
      await withTimeout(server.server.close(true), 10_000, `server close`)
      await sleep(1000) // allow the named pipe to be released
      server2 = new WorkerThreadGatewayServer()
      await withTimeout(server2.start(path, {ping: () => `pong`}), 10_000, `server restart`)

      await withTimeout(
        (async () => {
          for (let i = 0; i < 100; i++) {
            try {
              const r = await client.request(`ping`, [])
              if (r === `pong`) return
            } catch {
              // not reconnected yet — keep polling
            }
            await sleep(100)
          }
          throw new Error(`client did not recover after server restart`)
        })(),
        15_000,
        `reconnect recovery`
      )
    } finally {
      await client.close()
      await server.close()
      await server2?.close()
    }
  }, 25_000)

  it(`works through WorkerThreadInit.createGatewayServer/Client with token (P1-6)`, async () => {
    const path = uniquePath()
    class GatewayWorker extends WorkerThreadInit {
      mtdHello(from: string) {
        return `Hello ${from}`
      }
    }
    const worker = new GatewayWorker()
    try {
      await withTimeout(worker.createGatewayServer(path, {hello: (from: string) => `Hello ${from}`}, {token: `tok`}), 10_000, `createGatewayServer`)
      const client = await withTimeout(worker.createGatewayClient(path, {token: `tok`}), 10_000, `createGatewayClient`)
      expect(await withTimeout(client.request(`hello`, [`world`]), 10_000, `hello`)).toBe(`Hello world`)
    } finally {
      await worker.gatewayClientLatest?.close()
      await worker.gatewayServer?.close()
    }
  }, 20_000)
})
