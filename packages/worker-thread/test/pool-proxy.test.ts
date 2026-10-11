import {describe, expect, it} from "bun:test"
import type {WorkerThreadLaunch} from "../src/launch"
import {WorkerThreadPool} from "../src/pool"

/**
 * Build a fake WorkerThreadLaunch object.
 * Records `request()` calls for assertion.
 */
function makeMockWorker(id: number, opts?: {fail?: boolean}) {
  const requestCalls: Array<{method: string; params: unknown}> = []
  const timeoutCalls: Array<number | undefined> = []
  const exitHandlers: Array<() => void> = []
  const worker = {
    threadId: id,
    kill() {},
    async request(method: string, params: unknown, _wait = true, _others?: unknown, timeoutMs?: number) {
      requestCalls.push({method, params})
      timeoutCalls.push(timeoutMs)
      if (opts?.fail === true) throw new Error(`boom-${id}`)
      return `mtdPing:${id}`
    },
    on(event: string, cb: () => void) {
      if (event === `exit`) exitHandlers.push(cb)
      return worker
    }
  } as unknown as WorkerThreadLaunch
  return {worker, requestCalls, timeoutCalls}
}

describe(`WorkerThreadPool proxy`, () => {
  it(`bare mtd call goes round-robin`, async () => {
    const w1 = makeMockWorker(1)
    const w2 = makeMockWorker(2)
    const pool = new WorkerThreadPool([w1.worker, w2.worker])
    const typed = pool as unknown as {mtdPing: (a?: number) => Promise<string>}
    const r1 = await typed.mtdPing(7)
    const r2 = await typed.mtdPing(8)
    expect(r1).toBe(`mtdPing:1`)
    expect(r2).toBe(`mtdPing:2`)
    expect([w1.requestCalls[0]?.params, w2.requestCalls[0]?.params]).toEqual([[7], [8]])
  })

  it(`{mode: "broadcast"} fans out and keeps order`, async () => {
    const w1 = makeMockWorker(1)
    const w2 = makeMockWorker(2)
    const pool = new WorkerThreadPool([w1.worker, w2.worker])
    const typed = pool as unknown as {mtdPing: (a?: number, o?: {mode?: string; timeoutMs?: number}) => Promise<string[]>}
    const results = await typed.mtdPing(7, {mode: `broadcast`})
    expect(results).toEqual([`mtdPing:1`, `mtdPing:2`])
    expect([w1.requestCalls[0]?.params, w2.requestCalls[0]?.params]).toEqual([[7], [7]])
  })

  it(`{mode: "settled"} settles per worker`, async () => {
    const w1 = makeMockWorker(1)
    const w2 = makeMockWorker(2, {fail: true})
    const pool = new WorkerThreadPool([w1.worker, w2.worker])
    const typed = pool as unknown as {mtdPing: (o?: {mode?: string}) => Promise<Array<{ok: boolean}>>}
    const settled = await typed.mtdPing({mode: `settled`})
    expect(settled.map((s) => s.ok)).toEqual([true, false])
  })

  it(`timeoutMs is forwarded and not sent as a parameter`, async () => {
    const w1 = makeMockWorker(1)
    const pool = new WorkerThreadPool([w1.worker])
    const typed = pool as unknown as {mtdPing: (o?: {timeoutMs?: number}) => Promise<string>}
    await typed.mtdPing({timeoutMs: 5000})
    expect(w1.requestCalls[0]?.params).toEqual([])
    expect(w1.timeoutCalls[0]).toBe(5000)
  })

  it(`an unknown mode throws`, () => {
    const w1 = makeMockWorker(1)
    const pool = new WorkerThreadPool([w1.worker])
    const typed = pool as unknown as {mtdPing: (o?: {mode?: string}) => Promise<string>}
    let message = ``
    try {
      typed.mtdPing({mode: `broacast`})
    } catch (err) {
      message = String(err)
    }
    expect(message).toContain(`WorkerThreadPool: unknown mode 'broacast'`)
  })

  it(`a plain object worker parameter is NOT read as options`, async () => {
    const w1 = makeMockWorker(1)
    const pool = new WorkerThreadPool([w1.worker])
    const typed = pool as unknown as {mtdSave: (o: {path: string; retries: number}) => Promise<string>}
    await typed.mtdSave({path: `/tmp/x`, retries: 3})
    expect(w1.requestCalls[0]?.params).toEqual([{path: `/tmp/x`, retries: 3}])
  })

  it(`non-mtd properties are not intercepted`, () => {
    const w1 = makeMockWorker(1)
    const pool = new WorkerThreadPool([w1.worker])
    expect(typeof pool.execute === `function`).toBe(true)
    expect(typeof pool.kill === `function`).toBe(true)
    expect(pool.threadCount).toBe(1)
  })

  it(`the dispatch closure is memoised`, () => {
    const w1 = makeMockWorker(1)
    const pool = new WorkerThreadPool([w1.worker])
    const typed = pool as unknown as {mtdPing: (a?: number) => Promise<string>}
    const first = typed.mtdPing
    expect(typed.mtdPing).toBe(first)
  })
})
