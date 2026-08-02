/**
 * Fifth audit round — targeted regression tests for bugs found by code review.
 *
 * @remarks
 * Covers: requests after `close()` hanging, runtime worker crashes rejecting
 * pending requests, malformed RPC payloads, and Job proxies after a failed
 * launch.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadExport} from "../src/export"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadLaunch} from "../src/launch"
import {WorkerThreadRpc} from "../src/rpc"
import {sleep, withTimeout } from "./helpers"
import {LifecycleWorker} from "./fixtures/lifecycle-worker"

const CRASH_FIXTURE = `${import.meta.dir}/fixtures/crash-worker.ts`
const RUNTIME_CRASH_FIXTURE = `${import.meta.dir}/fixtures/runtime-crash-worker.ts`

describe(`audit round 5`, () => {
  it(`request() after close() rejects immediately instead of hanging`, async () => {
    const path = `audit5-${process.pid}-${Date.now()}`
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

  it(`pending requests reject when the worker crashes at runtime`, async () => {
    const worker = new WorkerThreadLaunch(RUNTIME_CRASH_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    const pending = worker.request(`mtdHang`, [])
    // the worker throws at ~200ms — pending must reject, not hang
    const err = await withTimeout(pending.catch((e: unknown) => e), 10_000, `pending rejection`)
    expect(err).toBeInstanceOf(Error)
    await sleep(300) // let the exit settle
  }, 20_000)

  it(`make() with non-array params responds with an error, not a hang`, async () => {
    const sent: any[] = []
    const rpc = new WorkerThreadRpc((data) => sent.push(data), {add: (a: number, b: number) => a + b})
    await rpc.make({id: 1, method: `add`, params: `oops`} as any)
    expect(sent[0]!.id).toBe(1)
    expect(sent[0]!.error).toBeDefined()
  })

  it(`make() handles id 0 correctly`, async () => {
    const sent: any[] = []
    const rpc = new WorkerThreadRpc((data) => sent.push(data), {add: (a: number, b: number) => a + b})
    await rpc.make({id: 0, method: `add`, params: [1, 2]})
    expect(sent[0]).toMatchObject({id: 0, result: 3})
  })

  it(`job methods reject cleanly after a failed launch (worker crashed at boot)`, async () => {
    const Job = WorkerThreadExport.init({path: CRASH_FIXTURE, WTInit: LifecycleWorker})
    await withTimeout(Job.launchWorker().catch(() => {}), 10_000, `launch`)
    const err = await withTimeout((Job as any).mtdAdd(1, 2).catch((e: unknown) => e), 5_000, `method after failed launch`)
    expect(err).toBeInstanceOf(Error)
  }, 20_000)
})
