import {describe, expect, it} from "bun:test"
import {WorkerThreadInit} from "../src/init"
import {WorkerThreadPool} from "../src/pool"
import type {WorkerThreadLaunch} from "../src/launch"
import type {IWorkerThreadWorkerClass} from "../src/types/pool"
import type {IWorkerThreadPoolMethods} from "../src/types/pool"

class Echo extends WorkerThreadInit {
  mtdAdd(a: number, b: number): number {
    return a + b
  }
  async mtdGreet(name: string): Promise<string> {
    return `hi ${name}`
  }
  helperNotExposed(): number {
    return 1
  }
}

class Bare extends WorkerThreadInit {
  helperOnly(): number {
    return 42
  }
}

const pool = {
  mtdAdd: (..._args: unknown[]) => Promise.resolve(5),
  mtdGreet: (..._args: unknown[]) => Promise.resolve(`hi`)
} as unknown as IWorkerThreadPoolMethods<Echo>

const barePool = {} as unknown as IWorkerThreadPoolMethods<Bare>

describe(`IWorkerThreadPoolMethods`, () => {
  it(`keeps parameter types and returns a promise`, () => {
    const addResult: Promise<number> = pool.mtdAdd(2, 3)
    const greetResult: Promise<string> = pool.mtdGreet(`world`)
    expect(addResult).toBeInstanceOf(Promise)
    expect(greetResult).toBeInstanceOf(Promise)
  })

  it(`selects the result shape by mode`, () => {
    const single: Promise<number> = pool.mtdAdd(2, 3)
    const broadcast: Promise<number[]> = pool.mtdAdd(2, 3, {mode: `broadcast`})
    const settled: Promise<Array<{threadId: number; ok: boolean}>> = pool.mtdAdd(2, 3, {mode: `settled`})
    expect(single).toBeInstanceOf(Promise)
    expect(broadcast).toBeInstanceOf(Promise)
    expect(settled).toBeInstanceOf(Promise)
    // @ts-expect-error - default single value is not an array
    const notArray: Promise<number[]> = pool.mtdAdd(2, 3)
    expect(notArray).toBeInstanceOf(Promise)
  })

  it(`does not expose a non-mtd method`, () => {
    // @ts-expect-error - helperNotExposed lacks the mtd prefix
    expect(pool.helperNotExposed).toBeUndefined()
  })

  it(`does not expose a base-class member`, () => {
    // @ts-expect-error - onBeforeExit is a base-class member, not an mtd method
    expect(pool.onBeforeExit).toBeUndefined()
  })

  it(`yields an empty surface for a worker with no mtd methods`, () => {
    // @ts-expect-error - Bare has no mtd methods so nothing is exposed
    expect(barePool.mtdAnything).toBeUndefined()
  })

  it(`keeps the single-value shape when only timeoutMs is passed`, () => {
    const withTimeout: Promise<number> = pool.mtdAdd(2, 3, {timeoutMs: 5000})
    expect(withTimeout).toBeInstanceOf(Promise)
  })
})

describe(`WorkerThreadPool exposes mtd* without a cast`, () => {
  it(`types pool.mtdAdd through the class type`, () => {
    const pool = new WorkerThreadPool<Echo>([])
    // Type-level only: these bindings compile only if `mtd*` is a member of
    // the pool's type. Nothing is dispatched — the pool is empty on purpose.
    const single: (a: number, b: number) => Promise<number> = pool.mtdAdd
    const broadcast: (a: number, b: number, o: {mode: "broadcast"}) => Promise<number[]> = pool.mtdAdd
    const settled: (a: number, b: number, o: {mode: "settled"}) => Promise<Array<{threadId: number; ok: boolean}>> = pool.mtdAdd
    expect(typeof single).toBe(`function`)
    expect(typeof broadcast).toBe(`function`)
    expect(typeof settled).toBe(`function`)
    expect(pool.threadCount).toBe(0)
  })
})

/**
 * Stand-in for `Job.launchWorker()`. The signature is what matters — it is what
 * carries the worker class — so the body only has to return something safe.
 */
function launchWorkerOf<T extends WorkerThreadInit>(_w: T): Promise<WorkerThreadLaunch & IWorkerThreadWorkerClass<T>> {
  return Promise.resolve({threadId: 1, request: () => Promise.resolve(1)} as unknown as WorkerThreadLaunch & IWorkerThreadWorkerClass<T>)
}

describe(`WorkerThreadPool infers the worker class from launched handles`, () => {
  it(`types pool.mtdAdd with no type argument at all`, async () => {
    // Mirrors the real path without spawning a thread: `launchWorker()` hands
    // back a main-thread handle that carries a phantom reference to the worker
    // class. Once in an array, that phantom is the only surviving evidence of
    // which class produced them — and it is what the pool infers from.
    const handles = await Promise.all([1, 2, 3].map(() => launchWorkerOf(new Echo())))
    const pool = new WorkerThreadPool(handles)
    const single: (a: number, b: number) => Promise<number> = pool.mtdAdd
    const broadcast: (a: number, b: number, o: {mode: "broadcast"}) => Promise<number[]> = pool.mtdAdd
    expect(typeof single).toBe(`function`)
    expect(typeof broadcast).toBe(`function`)
  })

  it(`still accepts a bare handle array with the default type`, () => {
    const plain = [{threadId: 1}] as unknown as WorkerThreadLaunch[]
    const pool = new WorkerThreadPool(plain)
    expect(pool.threadCount).toBe(1)
  })
})
