/**
 * Eleventh audit round — deterministic post-exit RPC behavior and
 * cross-runtime envelope validation.
 *
 * @remarks
 * W1: `request()` after worker exit must reject with a clear error on every
 * runtime (Node throws from postMessage, other runtimes may silently drop —
 * the pending entry would then hang until timeout or forever).
 * W2: `make()` must reject non-string methods and non-array params with an
 * error envelope on every runtime (V8 spreads string params as chars,
 * Bun throws — divergent behavior without an explicit gate).
 */
import {describe, expect, it} from "bun:test"
import {WorkerThreadLaunch} from "../src/launch"
import {WorkerThreadRpc} from "../src/rpc"
import {sleep, withTimeout} from "./helpers"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`

describe(`audit round 11`, () => {
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

  it(`make() rejects a non-string method with an error envelope`, async () => {
    const sent: any[] = []
    const rpc = new WorkerThreadRpc((data) => sent.push(data), {add: (a: number, b: number) => a + b})
    await rpc.make({id: 1, method: 123 as any, params: []} as any)
    const errMsg = sent.find((m) => m?.id === 1)?.error
    expect(errMsg).toBeDefined()
  })

  it(`make() rejects non-array params with an error envelope on every runtime`, async () => {
    const sent: any[] = []
    const rpc = new WorkerThreadRpc((data) => sent.push(data), {add: (a: number, b: number) => a + b})
    await rpc.make({id: 1, method: `add`, params: `oops`} as any)
    await rpc.make({id: 2, method: `add`, params: {a: 1, b: 2} as any} as any)
    const errors = sent.filter((m) => m?.error !== undefined)
    expect(errors.map((m) => m?.id).sort()).toEqual([1, 2])
  })
})
