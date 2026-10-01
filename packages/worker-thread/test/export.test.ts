/**
 * Unit tests for WorkerThreadExport — proxy structure and main-thread detection.
 *
 * Tests the Proxy/constructor behavior of `launchGatewayClient` and the
 * main-thread path of `init()`. We never call `launchWorker()` here, so no
 * real worker threads are spawned.
 */
import {describe, expect, it} from "bun:test"
import {WorkerThreadExport} from "../src/export"
import {WorkerThreadInit} from "../src/init"
import {LifecycleWorker} from "./fixtures/lifecycle-worker"
import {sleep, withTimeout} from "./helpers"

class StubWorker extends WorkerThreadInit {
  mtdAdd(a: number, b: number) {
    return a + b
  }

  async mtdGreet(name: string) {
    return `Hi ${name}`
  }
}

describe(`WorkerThreadExport.launchGatewayClient`, () => {
  const path = `/tmp/does-not-matter-${Date.now()}.sock`

  it(`returns a callable proxy/constructor (typeof function)`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path)
    expect(typeof Gateway).toBe(`function`)
  })

  it(`proxy has no 'then' property (not a thenable)`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path)
    expect((Gateway as any).then).toBeUndefined()
  })

  it(`accessing a string property returns a function`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path)
    expect(typeof (Gateway as any).mtdAdd).toBe(`function`)
    expect(typeof (Gateway as any).mtdGreet).toBe(`function`)
  })

  it(`accessing a Symbol property returns undefined (not coerced to string)`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path)
    expect((Gateway as any)[Symbol.iterator]).toBeUndefined()
    expect((Gateway as any)[Symbol.toPrimitive]).toBeUndefined()
  })

  it(`returned function is callable with owner + args (proxy only — no real call)`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path)
    const fn = (Gateway as any).mtdAdd
    expect(typeof fn).toBe(`function`)
    expect(fn.length).toBeGreaterThanOrEqual(1)
  })

  it(`usable as a constructor: new Gateway(owner) returns another proxy`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path)
    const owner = new StubWorker()
    const instance = new (Gateway as any)(owner)
    expect(typeof instance).toBe(`object`)
    expect(typeof instance.mtdAdd).toBe(`function`)
  })

  it(`accepts connection options (token/messagepack) and still returns a proxy`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(path, {token: `s3cret`, messagepack: true})
    expect(typeof Gateway).toBe(`function`)
    expect(typeof (Gateway as any).mtdAdd).toBe(`function`)
  })
})

describe(`WorkerThreadExport.init (main-thread path)`, () => {
  const fakePath = `/tmp/fake-worker-${Date.now()}.ts`

  it(`returns a proxy (typeof object)`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    expect(typeof Job).toBe(`object`)
  })

  it(`proxy has no 'then' property (not a thenable)`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    expect((Job as any).then).toBeUndefined()
  })

  it(`exposes launchWorker and launchGatewayClient as functions`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    expect(typeof (Job as any).launchWorker).toBe(`function`)
    expect(typeof (Job as any).launchGatewayClient).toBe(`function`)
  })

  it(`accessing a worker method returns a function`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    expect(typeof (Job as any).mtdAdd).toBe(`function`)
    expect(typeof (Job as any).mtdGreet).toBe(`function`)
  })

  it(`calling a worker method before launchWorker throws with helpful message`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    expect(() => (Job as any).mtdAdd(1, 2)).toThrow(/not launched/i)
  })

  it(`error message includes the path for debugging`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    expect(() => (Job as any).mtdAdd(1, 2)).toThrow(new RegExp(fakePath.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`)))
  })

  it(`launchGatewayClient returns a callable gateway proxy (no workers spawned)`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    const Gateway = (Job as any).launchGatewayClient(`/tmp/some-server-${Date.now()}.sock`)
    expect(typeof Gateway).toBe(`function`)
    expect(typeof Gateway.mtdAdd).toBe(`function`)
  })

  it(`launchGatewayClient throws when no path is provided (DX guard)`, () => {
    const Job = WorkerThreadExport.init({
      path: fakePath,
      WTInit: StubWorker
    })
    expect(() => (Job as any).launchGatewayClient()).toThrow(/requires a gateway server path/)
  })
})

describe(`WorkerThreadExport Job proxy (real worker threads)`, () => {
  const LIFECYCLE_FIXTURE = `${import.meta.dir}/fixtures/lifecycle-worker.ts`
  const CRASH_FIXTURE = `${import.meta.dir}/fixtures/crash-worker.ts`

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

  it(`Job.shutdown() terminates the worker (lifecycle passthrough)`, async () => {
    const Job = WorkerThreadExport.init({path: LIFECYCLE_FIXTURE, WTInit: LifecycleWorker})
    await withTimeout(Job.launchWorker(), 10_000, `launch`)
    // the Job proxy must expose shutdown() as a lifecycle passthrough that
    // TERMINATES the worker — not an RPC to the worker's drain method
    await withTimeout((Job as any).shutdown(5_000), 10_000, `job shutdown`)
    await sleep(300)
    const err = await withTimeout(
      (Job as any).mtdAdd(1, 2).catch((e: unknown) => e),
      5_000,
      `method after shutdown`
    )
    expect(err).toBeInstanceOf(Error)
  }, 25_000)

  it(`job methods reject cleanly after a failed launch (worker crashed at boot)`, async () => {
    const Job = WorkerThreadExport.init({path: CRASH_FIXTURE, WTInit: LifecycleWorker})
    await withTimeout(
      Job.launchWorker().catch(() => {}),
      10_000,
      `launch`
    )
    const err = await withTimeout(
      (Job as any).mtdAdd(1, 2).catch((e: unknown) => e),
      5_000,
      `method after failed launch`
    )
    expect(err).toBeInstanceOf(Error)
  }, 20_000)
})

describe(`WorkerThreadExport regression (a–k fixes)`, () => {
  const sock = `/tmp/regression-${Date.now()}.sock`
  const DENIED = [`toString`, `constructor`, `__proto__`, `prototype`, `inspect`, `then`]

  it(`(a) magic props on the gateway static proxy never become RPC calls`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(sock) as any
    for (const prop of DENIED) {
      if (prop === `prototype`) {
        // Own property of the constructor function — reachable but a plain
        // object, never an RPC closure.
        expect(typeof Gateway[prop]).not.toBe(`function`)
      } else {
        expect(Gateway[prop]).toBeUndefined()
      }
    }
    expect(Gateway[Symbol.iterator]).toBeUndefined()
    expect(typeof Gateway.mtdAdd).toBe(`function`)
  })

  it(`(a) magic props on the gateway constructor proxy never become RPC calls`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(sock) as any
    const instance = new Gateway(new StubWorker())
    for (const prop of DENIED) expect(instance[prop]).toBeUndefined()
    expect(instance[Symbol.iterator]).toBeUndefined()
    expect(typeof instance.mtdAdd).toBe(`function`)
  })

  it(`(a) magic/symbol props on the Job proxy never become RPC calls, then-guard intact`, () => {
    const Job = WorkerThreadExport.init({path: `/tmp/fake-regression-${Date.now()}.ts`, WTInit: StubWorker}) as any
    for (const prop of DENIED) expect(Job[prop]).toBeUndefined()
    expect(Job[Symbol.iterator]).toBeUndefined()
    expect(typeof Job.mtdAdd).toBe(`function`)
  })

  it(`(a) result proxy has-trap matches get-trap (string non-denied → true)`, () => {
    const Job = WorkerThreadExport.init({path: `/tmp/fake-has-${Date.now()}.ts`, WTInit: StubWorker}) as any
    expect(`mtdAdd` in Job).toBe(true)
    expect(`toString` in Job).toBe(false)
    expect(`then` in Job).toBe(false)
  })

  it(`(b) per-prop closures are cached (no per-access allocation)`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(sock) as any
    expect(Gateway.mtdAdd).toBe(Gateway.mtdAdd)
    const Job = WorkerThreadExport.init({path: `/tmp/fake-cache-${Date.now()}.ts`, WTInit: StubWorker}) as any
    expect(Job.mtdAdd).toBe(Job.mtdAdd)
    const instance = new Gateway(new StubWorker())
    expect(instance.mtdAdd).toBe(instance.mtdAdd)
  })

  it(`(j) gateway constructor preserves name/length; instanceof is not supported`, () => {
    const Gateway = WorkerThreadExport.launchGatewayClient<StubWorker>(sock) as any
    expect(Gateway.length).toBe(1)
    expect(typeof Gateway.name).toBe(`string`)
    expect(Gateway.name.length).toBeGreaterThan(0)
    expect(Gateway.name).not.toBe(`ctor`)
    const instance = new Gateway(new StubWorker())
    expect(instance instanceof Gateway).toBe(false)
  })

  it(`(k) factory shutdown() terminates ALL launched workers (latest-wins routing)`, async () => {
    const Job = WorkerThreadExport.init({path: `${import.meta.dir}/fixtures/lifecycle-worker.ts`, WTInit: LifecycleWorker})
    const w1 = await withTimeout(Job.launchWorker(), 10_000, `first launch`)
    const w2 = await withTimeout(Job.launchWorker(), 10_000, `second launch`)
    expect(w2.threadId).not.toBe(w1.threadId)
    expect(await withTimeout<number>((Job as any).mtdAdd(1, 2), 10_000, `routes to latest`)).toBe(3)
    await withTimeout((Job as any).shutdown(5_000), 15_000, `factory shutdown`)
    await sleep(300)
    expect(
      await withTimeout(
        w1.request(`mtdAdd`, [1, 2]).catch((e: unknown) => e),
        5_000,
        `w1 dead`
      )
    ).toBeInstanceOf(Error)
    expect(
      await withTimeout(
        w2.request(`mtdAdd`, [1, 2]).catch((e: unknown) => e),
        5_000,
        `w2 dead`
      )
    ).toBeInstanceOf(Error)
  }, 30_000)
})

describe(`WorkerThreadExport has-trap typo safety (oracle follow-up)`, () => {
  it(`reports false for unknown methods instead of over-claiming`, () => {
    const Job = WorkerThreadExport.init({path: `/tmp/fake-has-typo-${Date.now()}.ts`, WTInit: StubWorker}) as any
    expect(`mtdAdd` in Job).toBe(true)
    expect(`launchWorker` in Job).toBe(true)
    expect(`mtdTypo` in Job).toBe(false)
    expect(`toString` in Job).toBe(false)
  })
})
