/**
 * Eighth audit round — targeted regression tests for shutdown edge cases.
 *
 * @remarks
 * Covers: force-termination when the worker's `onBeforeExit` hook hangs or
 * throws, so `shutdown()` can never hang the caller.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadLaunch} from "../src/launch"
import {withTimeout } from "./helpers"

const HANG_FIXTURE = `${import.meta.dir}/fixtures/shutdown-hang-worker.ts`
const THROW_FIXTURE = `${import.meta.dir}/fixtures/shutdown-throw-worker.ts`

describe(`audit round 8`, () => {
  it(`shutdown() force-terminates a worker whose onBeforeExit hangs`, async () => {
    const worker = new WorkerThreadLaunch(HANG_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    const t0 = Date.now()
    await withTimeout(worker.shutdown(500), 5_000, `shutdown with hanging hook`)
    // the 500ms request timeout fired, then the worker was force-terminated
    expect(Date.now() - t0).toBeGreaterThanOrEqual(400)
    const err = await worker.request(`mtdAdd`, [1, 2]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
  }, 15_000)

  it(`shutdown() still terminates when onBeforeExit throws`, async () => {
    const worker = new WorkerThreadLaunch(THROW_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.shutdown(5_000), 10_000, `shutdown with throwing hook`)
    const err = await worker.request(`mtdAdd`, [1, 2]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
  }, 20_000)
})
