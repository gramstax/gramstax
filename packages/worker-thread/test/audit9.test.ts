/**
 * Ninth audit round — targeted regression tests for robustness gaps.
 *
 * @remarks
 * Covers: malformed RPC payloads, allow-list semantics for absent methods,
 * and pool round-robin cursor consistency after mid-rotation removal.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import type {WorkerThreadLaunch} from "../src/launch"
import {WorkerThreadPool} from "../src/pool"
import {WorkerThreadRpc} from "../src/rpc"
import {withTimeout } from "./helpers"

describe(`audit round 9`, () => {
  it(`make() tolerates malformed payloads without crashing`, async () => {
    const sent: any[] = []
    const rpc = new WorkerThreadRpc((data) => sent.push(data), {add: (a: number, b: number) => a + b})
    await rpc.make({} as any)
    await rpc.make({method: `x`} as any)
    await rpc.make({result: 5} as any)
    await rpc.make({id: `str`, result: 5} as any)
    await rpc.make({method: 123 as any, params: []} as any)
    await rpc.make({method: `x`, params: null} as any)
    await rpc.make({id: 1, method: `add`, params: [2, 3]})
    // invalid requests produced error responses; the valid one produced a result
    const errors = sent.filter((m) => m?.error !== undefined)
    expect(errors.length).toBeGreaterThanOrEqual(2)
    expect(sent.some((m) => m?.result === 5)).toBe(true)
  })

  it(`allow-list reports 'not allowed' (not 'not found') for absent methods`, async () => {
    const path = `audit9-${process.pid}-${Date.now()}`
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

  it(`pool round-robin cursor stays consistent after mid-rotation removal`, async () => {
    const calls: Record<number, number> = {1: 0, 2: 0, 3: 0}
    const makeMock = (id: number) => {
      const handlers: Array<() => void> = []
      return {
        threadId: id,
        kill() {},
        async request() {
          calls[id] = (calls[id] ?? 0) + 1
          return `${id}`
        },
        on(event: string, cb: () => void) {
          if (event === `exit`) handlers.push(cb)
          return this
        },
        emitExit() {
          for (const cb of handlers) cb()
        }
      } as unknown as WorkerThreadLaunch & {emitExit: () => void}
    }
    const w1 = makeMock(1)
    const w2 = makeMock(2)
    const w3 = makeMock(3)
    const pool = new WorkerThreadPool([w1, w2, w3])
    await pool.execute(`m`, []) // w1, cursor 1
    ;(w2 as unknown as {emitExit: () => void}).emitExit() // remove w2 mid-rotation
    await pool.execute(`m`, []) // w3 (index 1), cursor 2
    await pool.execute(`m`, []) // cursor 2 >= 2 → reset 0 → w1
    expect(pool.threadCount).toBe(2)
    expect(calls).toEqual({1: 2, 2: 0, 3: 1})
  })
})
