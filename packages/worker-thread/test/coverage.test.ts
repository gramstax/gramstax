import {describe, expect, it, mock} from "bun:test"
import {WorkerThreadExport} from "../src/export"
import {reportError, resetDefaultErrorHandler, setDefaultErrorHandler} from "../src/error-handler"
import {WorkerThreadGatewayClient} from "../src/gateway-client"
import {WorkerThreadGatewayServer} from "../src/gateway-server"
import {WorkerThreadInit} from "../src/init"
import {WorkerThreadLaunch} from "../src/launch"
import {LifecycleWorker} from "./fixtures/lifecycle-worker"
import {sleep, waitFor, withTimeout} from "./helpers"

const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`

let counter = 0
function uniquePath() {
  counter += 1
  return `wcov-${process.pid}-${Date.now()}-${counter}`
}

class StubWorker extends WorkerThreadInit {}

describe(`coverage-error-handler`, () => {
  it(`resetDefaultErrorHandler restores the silent drop`, () => {
    expect(() => reportError(new Error(`initial`))).not.toThrow()
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => {
      seen.push(err)
    })
    reportError(new Error(`x`))
    expect(seen).toHaveLength(1)
    resetDefaultErrorHandler()
    reportError(new Error(`y`))
    expect(seen).toHaveLength(1)
  })
})

describe(`coverage-helpers`, () => {
  it(`waitFor rejects on timeout`, async () => {
    await expect(waitFor(() => false, 60, 10)).rejects.toThrow(/timed out/)
  })
})

describe(`coverage-init-handleOnMessage`, () => {
  it(`routes rpc.make rejection to onError`, async () => {
    const seen: unknown[] = []
    setDefaultErrorHandler((err) => {
      seen.push(err)
    })
    try {
      const inst = new (class extends WorkerThreadInit {})()
      inst.rpc.make = mock(async () => {
        throw new Error(`boom-make`)
      })
      inst.handleOnMessage({method: `mtdNope`} as never)
      await sleep(20)
      expect(seen).toHaveLength(1)
    } finally {
      resetDefaultErrorHandler()
    }
  })

  it(`calls fixture worker methods directly in-process`, async () => {
    const worker = new LifecycleWorker()
    expect(worker.mtdAdd(2, 3)).toBe(5)
    worker.mtdHang()
    await worker.onBeforeExit()
    expect(worker.beforeExitRan).toBe(true)
  })
})

describe(`coverage-launch-handlers`, () => {
  it(`handleOnMessage rejection goes to safeEmitError`, async () => {
    const worker = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    try {
      await withTimeout(worker.ready(), 10_000, `ready`)
      const seen: unknown[] = []
      worker.on(`error`, (err) => {
        seen.push(err)
      })
      worker.rpc.make = mock(async () => {
        throw new Error(`boom-launch`)
      })
      await worker.handleOnMessage({method: `mtdNope`} as never)
      await sleep(20)
      expect(seen).toHaveLength(1)
    } finally {
      await worker.kill()
    }
  }, 20_000)

  it(`sigint and sigterm handlers kill the worker`, async () => {
    const w1 = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(w1.ready(), 10_000, `w1 ready`)
    const exit1 = new Promise((resolve) => w1.once(`exit`, resolve))
    ;(w1 as unknown as {sigintHandler: () => void}).sigintHandler()
    await withTimeout(exit1, 10_000, `w1 exit`)
    const w2 = new WorkerThreadLaunch(LIFECYCLE_FIXTURE, [])
    await withTimeout(w2.ready(), 10_000, `w2 ready`)
    const exit2 = new Promise((resolve) => w2.once(`exit`, resolve))
    ;(w2 as unknown as {sigtermHandler: () => void}).sigtermHandler()
    await withTimeout(exit2, 10_000, `w2 exit`)
  }, 30_000)
})

describe(`coverage-gateway-failures`, () => {
  it(`connect rejects via close event during handshake`, async () => {
    const client = new WorkerThreadGatewayClient()
    try {
      const pending = client.connect(`dead-${process.pid}-${Date.now()}`)
      const prevented = pending.catch((e: unknown) => e)
      ;(client.client as unknown as {emit: (ev: string, ...a: unknown[]) => void}).emit(`close`, `boom`)
      const err = await withTimeout(prevented, 5_000, `close rejection`)
      expect((err as Error).message).toMatch(/gateway connection failed/)
    } finally {
      await client.destroy()
    }
  }, 15_000)

  it(`server dispatch rejection goes to safeEmitError`, async () => {
    const server = new WorkerThreadGatewayServer()
    const seen: unknown[] = []
    server.on(`error`, (err) => {
      seen.push(err)
    })
    ;(server.rpc as unknown as Map<string, unknown>).set(`fake-conn`, {
      make: async () => {
        throw new Error(`boom-dispatch`)
      }
    })
    ;(server.server as unknown as {emit: (ev: string, ...a: unknown[]) => void}).emit(`message`, {method: `ping`, params: []}, {id: `fake-conn`})
    await sleep(20)
    expect(seen).toHaveLength(1)
    await server.close()
  }, 15_000)
})

describe(`coverage-export-proxy`, () => {
  it(`gateway proxy lazily creates the client on first call`, async () => {
    const path = uniquePath()
    const server = new WorkerThreadGatewayServer()
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path)
    const owner = new StubWorker()
    try {
      await withTimeout(server.start(path, {mtdAdd: (a: number, b: number) => a + b}), 10_000, `server start`)
      const instance = new Gateway(owner)
      expect(await withTimeout((instance as unknown as {mtdAdd: (a: number, b: number) => Promise<number>}).mtdAdd(2, 3), 10_000, `proxy call`)).toBe(
        5
      )
    } finally {
      for (const c of (owner as unknown as {gatewayClients: Map<string, {close: () => Promise<void>}>}).gatewayClients.values()) {
        await c.close()
      }
      await server.close()
    }
  }, 20_000)

  it(`init takes the worker branch when argv matches`, () => {
    const saved = process.argv[2]
    process.argv[2] = `for-worker-branch-probe`
    try {
      const out = WorkerThreadExport.init({path: `worker-branch-probe`, WTInit: StubWorker}) as unknown as {launchGatewayClient: unknown}
      expect(typeof out.launchGatewayClient).toBe(`function`)
    } finally {
      if (saved === undefined) {
        delete process.argv[2]
      } else {
        process.argv[2] = saved
      }
    }
  })

  it(`main proxy routes lifecycle passthroughs and throws before launch`, async () => {
    const Job = WorkerThreadExport.init({path: `${import.meta.dir}/fixtures/lifecycle-worker.ts`, WTInit: LifecycleWorker}) as any
    expect(() => Job.request(`m`, [])).toThrow(/not launched yet/)
    expect(() => Job.kill()).toThrow(/not launched yet/)
    expect(() => Job.send(`m`)).toThrow(/not launched yet/)
    expect(() => Job.shutdown()).toThrow(/not launched yet/)
    expect(() => Job.mtdAdd(1, 2)).toThrow(/not launched yet/)
    const worker: {shutdown: (ms: number) => Promise<unknown>} = await withTimeout(Job.launchWorker(), 10_000, `launch`)
    try {
      const sum = await withTimeout(Job.mtdAdd(1, 2), 10_000, `proxy route`)
      expect(sum).toBe(3)
      const notFound = await withTimeout(Job.request(`mtdAdd`, [2, 3]).catch((e: unknown) => e), 10_000, `request route`)
      expect((notFound as Error).message).toMatch(/not found/)
    } finally {
      await withTimeout(worker.shutdown(5_000), 10_000, `cleanup`)
    }
  }, 30_000)

  it(`wrap receives a main proxy with lifecycle passthroughs`, async () => {
    const Job = WorkerThreadExport.init({
      path: `${import.meta.dir}/fixtures/lifecycle-worker.ts`,
      WTInit: LifecycleWorker,
      wrap: (main: unknown) => ({
        callThrough: (method: string, ...args: unknown[]) => (main as Record<string, (...a: unknown[]) => unknown>)[method]!(...args)
      })
    }) as any
    const worker: {shutdown: (ms: number) => Promise<unknown>} = await withTimeout(Job.launchWorker(), 10_000, `launch`)
    try {
      const sum = await withTimeout(Job.callThrough(`mtdAdd`, 1, 2), 10_000, `mtd route`)
      expect(sum).toBe(3)
      const sum2 = await withTimeout(Job.callThrough(`request`, `mtdAdd`, [2, 3]), 10_000, `request passthrough`)
      expect(sum2).toBe(5)
    } finally {
      await withTimeout(worker.shutdown(5_000), 10_000, `cleanup`)
    }
  }, 30_000)
})
