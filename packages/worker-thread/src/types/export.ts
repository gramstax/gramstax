import type {WorkerThreadInit} from "../init"
import type {WorkerThreadLaunch} from "../launch"
import type {IGatewayClientOptions} from "./gateway-client"

/**
 * Options for initializing a worker thread export.
 *
 * @typeParam TWorker - The worker thread init class type.
 * @typeParam TMain - The main thread launch class type.
 * @typeParam TWrap - The custom wrapper type.
 *
 * @public
 */
export type IWorkerThreadExportOpt<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap> = {
  /** Path to the worker file. Typically `__filename` for self-referential workers. */
  path: string
  /** Worker thread init class. Extends {@link WorkerThreadInit}. */
  WTInit: new () => TWorker
  /** Main thread launch class. Extends {@link WorkerThreadLaunch}. Defaults to `WorkerThreadLaunch`. */
  WTLaunch?: new (
    path: string,
    argv?: unknown[]
  ) => TMain
  /** Custom wrapper function. Adds custom methods to returned object. */
  wrap?: (main: TMain) => TWrap
}

/**
 * Proxy type for gateway client methods. Transforms worker methods to accept `owner` as first parameter.
 *
 * @typeParam T - The worker thread init class type.
 *
 * @public
 */
export type IWorkerThreadGatewayProxy<T> = {
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: never[]) => unknown ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (owner: WorkerThreadInit, ...args: A) => Promise<Awaited<R>> : never
}

/**
 * Async methods type for worker thread. Transforms all worker methods to return Promises.
 *
 * @typeParam T - The worker thread init class type.
 *
 * @public
 */
export type IWorkerThreadAsyncMethods<T> = {
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: never[]) => unknown ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
}

/**
 * Factory type for `launchGatewayClient` returned by {@link WorkerThreadExport.init}.
 *
 * @typeParam TWorker - The worker thread init class type.
 * @public
 */
export type IWorkerThreadGatewayClientFactory<TWorker extends WorkerThreadInit> = (serverPath: string, options?: IGatewayClientOptions) => IWorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): IWorkerThreadAsyncMethods<TWorker>}

/**
 * Result type of {@link WorkerThreadExport.init}.
 *
 * @typeParam TWorker - The worker thread init class type.
 * @typeParam TMain - The main thread launch class type.
 * @typeParam TWrap - The custom wrapper type.
 * @public
 */
export type IWorkerThreadExportResult<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap> = TWrap &
  IWorkerThreadAsyncMethods<TWorker> & {
    launchWorker: (argv?: unknown[]) => Promise<TMain>
    launchGatewayClient: IWorkerThreadGatewayClientFactory<TWorker>
    shutdown: (timeoutMs?: number) => Promise<void>
  }
