/**
 * Integration tests for WorkerThreadLaunch — real worker threads.
 *
 * @remarks
 * Spawns actual worker threads from fixtures. Every await on a thread-bound
 * promise is wrapped in `withTimeout` and every test passes a bounded
 * bun:test timeout, so the suite can never hang on a blocked thread.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadLaunch} from "../src/launch"
import {withTimeout } from "./helpers"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`
const CRASH_FIXTURE = `${import.meta.dir}/fixtures/crash-worker.ts`

describe(`WorkerThreadLaunch lifecycle (real threads)`, () => {
  it(`emits ready and supports RPC`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    const readyEvent = new Promise((resolve) => worker.once(`ready`, resolve))
    await withTimeout(worker.ready(), 10_000, `worker ready`)
    await withTimeout(readyEvent, 10_000, `ready event`)
    const sum = await withTimeout(worker.request(`mtdAdd`, [2, 3]), 10_000, `mtdAdd`)
    expect(sum).toBe(5)
    await worker.kill()
  }, 20_000)

  it(`rejects a request that exceeds timeoutMs`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `worker ready`)
    const hang = worker.request(`mtdHang`, [], true, undefined, 100)
    await expect(withTimeout(hang, 5_000, `hang timeout`)).rejects.toThrow(/timeout after 100ms/)
    await worker.kill()
  }, 20_000)

  it(`rejects pending requests when the worker is killed`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `worker ready`)
    const pending = worker.request(`mtdHang`, [])
    await worker.kill()
    await expect(withTimeout(pending, 5_000, `pending rejection`)).rejects.toThrow(/exited unexpectedly/)
  }, 20_000)

  it(`emits exit after kill`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `worker ready`)
    const exitEvent = new Promise<number>((resolve) => worker.once(`exit`, resolve))
    await worker.kill()
    await withTimeout(exitEvent, 10_000, `exit event`)
  }, 20_000)

  it(`shutdown drains onBeforeExit before terminating`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `worker ready`)
    const exitEvent = new Promise<number>((resolve) => worker.once(`exit`, resolve))
    const start = Date.now()
    await withTimeout(worker.shutdown(5_000), 10_000, `shutdown`)
    const elapsed = Date.now() - start
    await withTimeout(exitEvent, 10_000, `exit event`)
    // the fixture's onBeforeExit sleeps 150ms — a graceful drain must take >= ~100ms
    expect(elapsed).toBeGreaterThanOrEqual(100)
  }, 20_000)

  it(`ready() rejects and error event fires when the worker crashes at boot`, async () => {
    const worker = new WorkerThreadLaunch(CRASH_FIXTURE, [])
    const errorEvent = new Promise((resolve) => worker.once(`error`, resolve))
    await expect(withTimeout(worker.ready(), 10_000, `ready rejection`)).rejects.toThrow(/exited before signaling ready/)
    await withTimeout(errorEvent, 10_000, `error event`)
  }, 20_000)

  it(`validates the worker path`, () => {
    expect(() => new WorkerThreadLaunch(``, [])).toThrow(/non-empty worker path/)
  })
})
