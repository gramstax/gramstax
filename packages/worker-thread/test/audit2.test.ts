/**
 * Second audit round — targeted regression tests for bugs found by code review.
 *
 * @remarks
 * Covers: undefined RPC results hanging the caller, the gateway proxy reusing
 * closed clients, close()/destroy() leaving pending requests hanging, and
 * createGatewayClient leaking the previous client for the same path.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadExport} from "../src/export"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadInit} from "../src/init"
import {WorkerThreadRpc} from "../src/rpc"
import {sleep, withTimeout } from "./helpers"

describe(`audit round 2`, () => {
  describe(`undefined RPC result`, () => {
    it(`response carries null instead of undefined so the caller never hangs`, async () => {
      const sent: any[] = []
      const rpc = new WorkerThreadRpc((data) => sent.push(data), {returnsUndefined: () => undefined})
      const promise = rpc.makeRequest(`returnsUndefined`, []) as Promise<unknown>
      await rpc.make({id: sent[0]!.id, method: `returnsUndefined`, params: []})
      // the wire cannot carry undefined — the response must carry null
      expect(sent[1]).toMatchObject({id: sent[0]!.id, result: null})
      await rpc.make(sent[1]!)
      expect(await withTimeout(promise, 2000, `undefined result`)).toBe(null)
    })

    it(`short-circuited middleware without a result resolves instead of hanging`, async () => {
      const sent: any[] = []
      const rpc = new WorkerThreadRpc((data) => sent.push(data), {})
      rpc.use(async (ctx) => {
        ctx.result = undefined // short-circuit, forget to set a result
      })
      await rpc.make({id: 1, method: `whatever`, params: []})
      expect(sent[0]).toMatchObject({id: 1, result: null})
    })
  })

  describe(`gateway proxy lifecycle`, () => {
    it(`recreates a closed client instead of reusing it forever`, async () => {
      const path = `audit2-${process.pid}-${Date.now()}`
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
      const path = `audit2-${process.pid}-${Date.now()}`
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
  })

  describe(`gateway client close semantics`, () => {
    it(`close() rejects in-flight pending requests`, async () => {
      const path = `audit2-${process.pid}-${Date.now()}`
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
  })
})
