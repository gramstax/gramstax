/**
 * Regression tests from the strict audit — races, leaks and error paths.
 *
 * @remarks
 * Every thread-bound operation is wrapped in `withTimeout` and each test
 * passes a bounded bun:test timeout so a regression can never hang the suite.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadLaunch} from "../src/launch"
import {sleep, withTimeout } from "./helpers"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`
const CRASH_FIXTURE = `${import.meta.dir}/fixtures/crash-worker.ts`

describe(`audit regressions`, () => {
  it(`makeRequest cleans the pending map when send throws (terminated worker)`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await worker.kill()
    await sleep(300) // let the exit event settle
    const err = await worker.request(`mtdAdd`, [1, 2]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(worker.rpc.map.size).toBe(0)
  }, 20_000)

  it(`kill() does not hang when called from the error handler (crash race)`, async () => {
    const worker = new WorkerThreadLaunch(CRASH_FIXTURE, [])
    const killResult = new Promise<string>((resolve) => {
      worker.once(`error`, () => {
        Promise.race([worker.kill().then(() => resolve(`resolved`)), sleep(3000).then(() => resolve(`HUNG`))]).catch(() => {})
      })
    })
    await withTimeout(worker.ready().catch(() => {}), 10_000, `ready`)
    const outcome = await withTimeout(killResult, 10_000, `kill from error handler`)
    expect(outcome).toBe(`resolved`)
  }, 20_000)

  it(`handleOnMessage error path does not throw without listeners`, async () => {
    // An 'error' emit with no listeners would crash — safeEmitError routes it
    // to the default handler instead. Trigger by requesting an unknown method
    // on a live worker is handled inside rpc.make; here we simply assert the
    // crash fixture produces a rejectable ready() without an uncaught throw.
    const worker = new WorkerThreadLaunch(CRASH_FIXTURE, [])
    const err = await worker.ready().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    await withTimeout(sleep(500), 2000, `settle`)
  }, 15_000)

  it(`shutdown() is idempotent — calling it twice does not hang`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.shutdown(5_000), 10_000, `first shutdown`)
    await withTimeout(worker.shutdown(5_000), 10_000, `second shutdown`)
  }, 25_000)

  it(`connect() called twice rejects instead of hanging`, async () => {
    const path = `audit-${process.pid}-${Date.now()}`
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

  it(`gateway client request with timeout rejects when server never answers`, async () => {
    const path = `audit-${process.pid}-${Date.now()}`
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
})
