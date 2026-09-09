/**
 * Integration tests for WorkerThreadLaunch — real worker threads.
 *
 * @remarks
 * Spawns actual worker threads from fixtures. Every await on a thread-bound
 * promise is wrapped in `withTimeout` and every test passes a bounded
 * bun:test timeout, so the suite can never hang on a blocked thread.
 *
 * Covers the full launch lifecycle (ready/RPC/kill/shutdown), crash and
 * exit resilience (pending rejection, post-exit requests, force-termination
 * of hanging or throwing `onBeforeExit` hooks) and input validation.
 */
import {describe, expect, it } from "bun:test"
import {WorkerThreadLaunch} from "../src/launch"
import {sleep, withTimeout } from "./helpers"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`
const CRASH_FIXTURE = `${import.meta.dir}/fixtures/crash-worker.ts`
const RUNTIME_CRASH_FIXTURE = `${import.meta.dir}/fixtures/runtime-crash-worker.ts`
const HANG_FIXTURE = `${import.meta.dir}/fixtures/shutdown-hang-worker.ts`
const THROW_FIXTURE = `${import.meta.dir}/fixtures/shutdown-throw-worker.ts`

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

  it(`validates the worker path`, () => {
    expect(() => new WorkerThreadLaunch(``, [])).toThrow(/non-empty worker path/)
  })
})

describe(`WorkerThreadLaunch exit & crash resilience`, () => {
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

  it(`pending requests reject when the worker crashes at runtime`, async () => {
    const worker = new WorkerThreadLaunch(RUNTIME_CRASH_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    const pending = worker.request(`mtdHang`, [])
    // the worker throws at ~200ms — pending must reject, not hang
    const err = await withTimeout(pending.catch((e: unknown) => e), 10_000, `pending rejection`)
    expect(err).toBeInstanceOf(Error)
    await sleep(300) // let the exit settle
  }, 20_000)

  it(`request() after worker exit rejects with a clear error on every runtime`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await worker.kill()
    await sleep(300) // let the exit event settle so `exited` is set

    const err = await worker.request(`mtdAdd`, [1, 2]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toMatch(/has exited/)
  }, 20_000)

  it(`fire-and-forget request after worker exit also rejects`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await worker.kill()
    await sleep(300)

    const err = await worker.request(`mtdAdd`, [1, 2], false).catch((e: unknown) => e)
    expect((err as Error).message).toMatch(/has exited/)
  }, 20_000)

  it(`kill() resolves even after the worker has fully exited`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.kill(), 10_000, `first kill`)
    await withTimeout(worker.kill(), 10_000, `kill after exit`)
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

describe(`WorkerThreadLaunch shutdown edge cases`, () => {
  it(`shutdown() is idempotent — calling it twice does not hang`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.shutdown(5_000), 10_000, `first shutdown`)
    await withTimeout(worker.shutdown(5_000), 10_000, `second shutdown`)
  }, 25_000)

  it(`two concurrent shutdown() calls do not hang`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    const results = await withTimeout(Promise.allSettled([worker.shutdown(5_000), worker.shutdown(5_000)]), 15_000, `concurrent shutdowns`)
    expect(results.every((r) => r.status === `fulfilled`)).toBe(true)
  }, 25_000)

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

describe(`WorkerThreadLaunch regression (a–k fixes)`, () => {
  it(`(c) explicit [undefined] argv normalizes to no-args`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [undefined] as unknown[])
    expect(worker.argv.length).toBe(0)
    await withTimeout(worker.ready(), 10_000, `ready`)
    expect(await withTimeout(worker.request(`mtdAdd`, [1, 2]), 10_000, `rpc`)).toBe(3)
    await worker.kill()
  }, 20_000)

  it(`(c) documents the argv slot convention (routing token at argv[2], user args from argv[3])`, async () => {
    // `export` reserves process.argv[2] for its routing token; raw launch
    // args start at argv[2] and user args follow at argv[3]+.
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [`user-arg`])
    expect(worker.argv).toEqual([`user-arg`])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await worker.kill()
  }, 20_000)

  it(`(d) kill() removes SIGINT/SIGTERM listeners (no pool leak)`, async () => {
    const beforeInt = process.listenerCount(`SIGINT`)
    const beforeTerm = process.listenerCount(`SIGTERM`)
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.kill(), 10_000, `kill`)
    await sleep(300)
    expect(process.listenerCount(`SIGINT`)).toBe(beforeInt)
    expect(process.listenerCount(`SIGTERM`)).toBe(beforeTerm)
  }, 20_000)

  it(`(e) send()/request() fail fast once kill() starts (no hang)`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    const killed = worker.kill()
    expect(() => worker.send({hello: `world`} as never)).toThrow(/exiting|exited/i)
    const err = await withTimeout(worker.request(`mtdAdd`, [1, 2]).catch((e: unknown) => e), 5_000, `request fail-fast`)
    expect(err).toBeInstanceOf(Error)
    await withTimeout(killed, 10_000, `kill settles`)
  }, 20_000)

  it(`(f) concurrent shutdown() calls share one in-flight drain`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    let drains = 0
    const orig = worker.rpc.makeRequest.bind(worker.rpc) as (...args: unknown[]) => unknown
    worker.rpc.makeRequest = ((...args: never[]) => {
      if (args[0] === `shutdown`) drains++
      return orig(...args)
    }) as typeof worker.rpc.makeRequest
    await withTimeout(Promise.all([worker.shutdown(5_000), worker.shutdown(5_000)]), 15_000, `concurrent shutdowns`)
    expect(drains).toBe(1)
  }, 25_000)

  it(`(g) shutdown() fast-paths when already exited (no 5s stall)`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.kill(), 10_000, `kill`)
    await sleep(300)
    const t0 = Date.now()
    await withTimeout(worker.shutdown(5_000), 3_000, `fast shutdown`)
    expect(Date.now() - t0).toBeLessThan(1_000)
  }, 20_000)

  it(`(h) ready() rejects after the worker died (no stale resolve)`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    await withTimeout(worker.kill(), 10_000, `kill`)
    await sleep(300)
    await expect(withTimeout(worker.ready(), 3_000, `post-mortem ready`)).rejects.toThrow(/exited/i)
  }, 20_000)

  it(`(i) kill() routes terminate() errors to the error event (never swallows)`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(worker.ready(), 10_000, `ready`)
    const seen = new Promise<unknown>((resolve) => worker.once(`error`, resolve))
    const thread = worker.thread as unknown as {terminate: () => Promise<number>}
    const origTerminate = thread.terminate.bind(thread)
    thread.terminate = () => Promise.reject(new Error(`boom-terminate`))
    await worker.kill()
    await withTimeout(seen, 5_000, `error event`)
    thread.terminate = origTerminate
    await withTimeout(worker.kill(), 10_000, `cleanup kill`)
    await sleep(200)
  }, 20_000)
})
