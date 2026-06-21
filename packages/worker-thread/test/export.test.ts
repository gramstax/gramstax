/**
 * Unit tests for WorkerThreadExport — proxy structure and main-thread detection.
 *
 * Tests the Proxy/constructor behavior of `launchGatewayClient` and the
 * main-thread path of `init()`. We never call `launchWorker()` here, so no
 * real worker threads are spawned.
 */
import {describe, it, expect} from "bun:test"
import {WorkerThreadExport} from "../src/export"
import {WorkerThreadInit} from "../src/init"

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
})
