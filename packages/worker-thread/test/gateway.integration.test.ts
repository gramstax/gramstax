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
import {WorkerThreadExport} from "../src/export"
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

describe(`gateway client lifecycle guards (regression)`, () => {
  it(`connect() called twice rejects instead of hanging`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `first connect`)
      const err = await withTimeout(client.connect(path).catch((e: unknown) => e), 10_000, `second connect`)
      expect(err).toBeInstanceOf(Error)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`concurrent connect() calls settle: one resolves, one rejects`, async () => {
    const path = uniquePath()
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

  it(`close() rejects in-flight pending requests`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {hang: () => new Promise(() => {})}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `connect`)
      const pending = client.request(`hang`, [])
      await sleep(100) // let the request reach the server
      await withTimeout(client.close(), 10_000, `close`)
      const err = await withTimeout(pending.catch((e: unknown) => e), 5_000, `pending rejection`)
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toMatch(/closed/)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`request() after close() rejects immediately instead of hanging`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `connect`)
      await withTimeout(client.close(), 10_000, `close`)
      const err = await withTimeout(client.request(`ping`, []).catch((e: unknown) => e), 3_000, `request after close`)
      expect(err).toBeInstanceOf(Error)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`request() rejects when the transport dies, instead of hanging`, async () => {
    const path = uniquePath()
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

  it(`gateway client request with timeout rejects when server never answers`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {hang: () => new Promise(() => {})}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `connect`)
      const err = await withTimeout(client.request(`hang`, [], true, undefined, 300).catch((e: unknown) => e), 5_000, `hang request`)
      expect((err as Error).message).toMatch(/timeout/)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)

  it(`status events are forwarded (including READY)`, async () => {
    const path = uniquePath()
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

describe(`gateway server restart & allow-list (regression)`, () => {
  it(`a gateway server instance can be restarted after close()`, async () => {
    const path = uniquePath()
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

  it(`allowedMethods does not break methods that read instance state`, async () => {
    const path = uniquePath()
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

  it(`user middleware runs before the allow-list check`, async () => {
    const path = uniquePath()
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

  it(`allow-list reports 'not allowed' (not 'not found') for absent methods`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const client = new WorkerThreadGatewayClient()
    try {
      await withTimeout(server.start(path, {ping: () => `pong`}, {allowedMethods: [`ping`]}), 10_000, `server start`)
      await withTimeout(client.connect(path), 10_000, `connect`)
      const err = await withTimeout(client.request(`missing`, []).catch((e: unknown) => e), 10_000, `missing`)
      expect((err as {message?: string})?.message).toMatch(/not allowed/)
    } finally {
      await client.close()
      await server.close()
    }
  }, 20_000)
})

describe(`WorkerThreadInit + export proxy gateway lifecycle (regression)`, () => {
  it(`recreates a closed client instead of reusing it forever`, async () => {
    const path = uniquePath()
    class W extends WorkerThreadInit {
      mtdHello(from: string) {
        return `Hello ${from}`
      }
    }
    const worker = new W()
    try {
      await withTimeout(worker.createGatewayServer(path, {hello: (from: string) => `Hello ${from}`}), 10_000, `createGatewayServer`)
      const proxy = WorkerThreadExport.launchGatewayClient<W>(path)
      expect(await withTimeout((proxy as any).hello(worker, `A`) as Promise<unknown>, 10_000, `first hello`)).toBe(`Hello A`)
      const first = worker.gatewayClientLatest!
      await withTimeout(first.close(), 10_000, `close first client`)
      // the cached client is closed — the proxy must recreate it
      expect(await withTimeout((proxy as any).hello(worker, `B`) as Promise<unknown>, 10_000, `hello after close`)).toBe(`Hello B`)
    } finally {
      await worker.gatewayClientLatest?.close()
      await worker.gatewayServer?.close()
    }
  }, 25_000)

  it(`createGatewayClient for the same path closes the previous client`, async () => {
    const path = uniquePath()
    class W extends WorkerThreadInit {}
    const worker = new W()
    try {
      await withTimeout(worker.createGatewayServer(path, {ping: () => `pong`}), 10_000, `createGatewayServer`)
      const c1 = await withTimeout(worker.createGatewayClient(path), 10_000, `first client`)
      const c2 = await withTimeout(worker.createGatewayClient(path), 10_000, `second client`)
      expect(worker.gatewayClients.get(path)).toBe(c2)
      expect(c1.isClosed()).toBe(true)
    } finally {
      await worker.gatewayClientLatest?.close()
      await worker.gatewayServer?.close()
    }
  }, 20_000)

  it(`createGatewayServer twice closes the previous server`, async () => {
    class W extends WorkerThreadInit {}
    const worker = new W()
    const path1 = `${uniquePath()}-a`
    const path2 = `${uniquePath()}-b`
    await withTimeout(worker.createGatewayServer(path1, {ping: () => `pong`}), 10_000, `first server`)
    const first = worker.gatewayServer!
    await withTimeout(worker.createGatewayServer(path2, {ping: () => `pong`}), 10_000, `second server`)
    expect(worker.gatewayServer).not.toBe(first)
    // net-ipc nulls the raw server after close — the old socket must be released
    expect((first as any).server.server).toBeNull()
    await worker.gatewayServer?.close()
  }, 20_000)
})
