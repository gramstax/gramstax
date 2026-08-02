/**
 * Sixth audit round — targeted regression tests for bugs found by code review.
 *
 * @remarks
 * Covers: `Job.shutdown()` proxy semantics, concurrent double shutdown, and
 * malformed inbound messages.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadExport} from "../src/export"
import {WorkerThreadLaunch} from "../src/launch"
import {sleep, withTimeout } from "./helpers"
import {LifecycleWorker} from "./fixtures/lifecycle-worker"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`

describe(`audit round 6`, () => {
  it(`Job.shutdown() terminates the worker (lifecycle passthrough)`, async () => {
    const Job = WorkerThreadExport.init({path: LIFECYCLE_FIXTURE, WTInit: LifecycleWorker})
    await withTimeout(Job.launchWorker(), 10_000, `launch`)
    // the Job proxy must expose shutdown() as a lifecycle passthrough that
    // TERMINATES the worker — not an RPC to the worker's drain method
    await withTimeout((Job as any).shutdown(5_000), 10_000, `job shutdown`)
    await sleep(300)
    const err = await withTimeout((Job as any).mtdAdd(1, 2).catch((e: unknown) => e), 5_000, `method after shutdown`)
    expect(err).toBeInstanceOf(Error)
  }, 25_000)

  it(`two concurrent shutdown() calls do not hang`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    const results = await withTimeout(Promise.allSettled([worker.shutdown(5_000), worker.shutdown(5_000)]), 15_000, `concurrent shutdowns`)
    expect(results.every((r) => r.status === `fulfilled`)).toBe(true)
  }, 25_000)

  it(`a malformed inbound message is ignored without crashing`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    // send a non-RPC message straight to the worker — must be a no-op
    worker.send({hello: `world`} as any)
    await sleep(100)
    expect(await withTimeout(worker.request(`mtdAdd`, [2, 3]), 10_000, `rpc after malformed`)).toBe(5)
    await worker.kill()
  }, 20_000)
})
