/**
 * Third audit round — targeted regression tests for bugs found by code review.
 *
 * @remarks
 * Covers: `_others`/`context` corrupting the RPC envelope, `launchWorker`
 * leaking the previous worker, `createGatewayServer` leaking the previous
 * server, `connect()` after `close()`, and missing worker file spawn errors.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadExport} from "../src/export"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadInit} from "../src/init"
import {WorkerThreadLaunch} from "../src/launch"
import {WorkerThreadRpc} from "../src/rpc"
import {withTimeout } from "./helpers"
import {LifecycleWorker} from "./fixtures/lifecycle-worker"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`

describe(`audit round 3`, () => {
  describe(`RPC envelope integrity`, () => {
    it(`_others cannot override the reserved id/method/params fields`, () => {
      const sent: any[] = []
      const rpc = new WorkerThreadRpc((data) => sent.push(data), {add: (a: number, b: number) => a + b})
      rpc.makeRequest(`add`, [1, 2], true, {id: 999, method: `evil`, params: [`x`]})
      expect(sent[0]!.method).toBe(`add`)
      expect(sent[0]!.params).toEqual([1, 2])
      expect(sent[0]!.id).not.toBe(999)
    })

    it(`context cannot override the reserved id/method/params fields`, () => {
      const sent: any[] = []
      const rpc = new WorkerThreadRpc((data) => sent.push(data), {})
      rpc.context = {id: 777, method: `hijack`}
      rpc.makeRequest(`add`, [1, 2])
      expect(sent[0]!.method).toBe(`add`)
      expect(sent[0]!.id).not.toBe(777)
    })
  })

  describe(`re-launch lifecycle`, () => {
    it(`launchWorker can be called multiple times — each worker stays independent`, async () => {
      const Job = WorkerThreadExport.init({path: LIFECYCLE_FIXTURE, WTInit: LifecycleWorker})
      const w1 = await withTimeout(Job.launchWorker(), 10_000, `first launch`)
      const w2 = await withTimeout(Job.launchWorker(), 10_000, `second launch`)
      // both workers must be alive and independent — launching the same Job
      // multiple times is the intended way to scale out
      expect(w2.threadId).not.toBe(w1.threadId)
      expect(await withTimeout(w1.request(`mtdAdd`, [2, 3]), 10_000, `w1 request`)).toBe(5)
      expect(await withTimeout(w2.request(`mtdAdd`, [4, 5]), 10_000, `w2 request`)).toBe(9)
      await withTimeout(w1.shutdown(5_000), 10_000, `w1 cleanup`)
      await withTimeout(w2.shutdown(5_000), 10_000, `w2 cleanup`)
    }, 30_000)

    it(`createGatewayServer twice closes the previous server`, async () => {
      class W extends WorkerThreadInit {}
      const worker = new W()
      const path1 = `audit3-${process.pid}-${Date.now()}-a`
      const path2 = `audit3-${process.pid}-${Date.now()}-b`
      await withTimeout(worker.createGatewayServer(path1, {ping: () => `pong`}), 10_000, `first server`)
      const first = worker.gatewayServer!
      await withTimeout(worker.createGatewayServer(path2, {ping: () => `pong`}), 10_000, `second server`)
      expect(worker.gatewayServer).not.toBe(first)
      // net-ipc nulls the raw server after close — the old socket must be released
      expect((first as any).server.server).toBeNull()
      await worker.gatewayServer?.close()
    }, 20_000)
  })

  describe(`client state guards`, () => {
    it(`connect() after close() rejects instead of half-connecting`, async () => {
      const client = new WorkerThreadGatewayClient()
      await withTimeout(client.close(), 5_000, `close`)
      const err = await withTimeout(client.connect(`audit3-${process.pid}`).catch((e: unknown) => e), 5_000, `connect after close`)
      expect(err).toBeInstanceOf(Error)
    }, 15_000)

    it(`spawning a missing worker file rejects ready() without hanging`, async () => {
      let worker: WorkerThreadLaunch | undefined
      try {
        worker = new WorkerThreadLaunch(`${import.meta.dir}/fixtures/does-not-exist.ts`, [])
      } catch (err) {
        expect(err).toBeInstanceOf(Error)
        return
      }
      const err = await withTimeout(worker.ready().catch((e: unknown) => e), 10_000, `ready`)
      expect(err).toBeInstanceOf(Error)
    }, 20_000)
  })
})
