/**
 * Worker thread export — top-level init, types, and aggregator.
 *
 * @remarks
 * Provides the {@link WorkerThreadExport} class that auto-detects
 * main-thread vs worker-thread context, launches workers, sets up RPC
 * proxies, and exposes type-safe method invocation across threads.
 *
 * Also exports the shared types used throughout the package.
 *
 * @packageDocumentation
 * @public
 */

import type {IGatewayClientOptions} from "./gateway-client"
import type {WorkerThreadInit} from "./init"
import {WorkerThreadLaunch} from "./launch"

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

/**
 * Props that must never become RPC calls. `then` keeps the proxy
 * non-thenable (await-safe); the rest block prototype-pollution and
 * introspection gadgets (`constructor`, `__proto__`, ...) from turning
 * into remote method invocations.
 */
const DENIED_RPC_PROPS = new Set([`then`, `toString`, `constructor`, `__proto__`, `prototype`, `inspect`])

class Helper {
  /**
   * True when a proxy `get` must resolve to `undefined` instead of an RPC closure.
   */
  static isDeniedRpcProp(prop: string | symbol): boolean {
    return typeof prop !== `string` || DENIED_RPC_PROPS.has(prop)
  }
  static requireGatewayPath(serverPath?: string): string {
    if (!serverPath || typeof serverPath !== `string`) {
      throw new Error(`launchGatewayClient requires a gateway server path — pass the same path used in createGatewayServer()`)
    }
    return serverPath
  }
}

/**
 * Provides a unified interface for creating and managing worker threads with automatic RPC proxying.
 *
 * @remarks
 * Automatically detects if running in main thread or worker thread.
 * Provides type-safe method calls to worker thread via RPC proxy.
 *
 * @example Basic Usage
 * ```typescript
 * import { WorkerThreadExport, WorkerThreadInit } from "gramstax";
 *
 * class MyWorker extends WorkerThreadInit {
 *   count = 0;
 *
 *   mtdIncrement() {
 *     return ++this.count;
 *   }
 *
 *   mtdGetCount() {
 *     return this.count;
 *   }
 * }
 *
 * export const CounterJob = WorkerThreadExport.init({
 *   path: __filename,
 *   WTInit: MyWorker,
 * });
 *
 * // In main thread:
 * await CounterJob.launchWorker();
 * await CounterJob.mtdIncrement(); // 1
 * await CounterJob.mtdGetCount(); // 1
 * ```
 *
 * @example Inter-Worker Communication with launchGatewayClient
 * ```typescript
 * // ./worker/server.ts
 * class ServerWorker extends WorkerThreadInit {
 *   mtdHello(from: string) {
 *     return `Hello ${from}!`;
 *   }
 *
 *   async mtdStartServer() {
 *     return await this.createGatewayServer("/tmp/server.sock", undefined, {
 *       allowedMethods: ["mtdHello"],
 *     });
 *   }
 * }
 *
 * export const WorkerServer = WorkerThreadExport.init({
 *   path: __filename,
 *   WTInit: ServerWorker,
 * });
 * export const WorkerServerGateway = WorkerServer.launchGatewayClient("/tmp/server.sock");
 *
 * // ./worker/client.ts
 * import { WorkerServerGateway } from "./server";
 *
 * class ClientWorker extends WorkerThreadInit {
 *   async mtdCallServer() {
 *     // Static usage: pass `this` as first argument
 *     return await WorkerServerGateway.mtdHello(this, "ClientWorker");
 *   }
 * }
 *
 * // ./main.ts
 * await WorkerServer.launchWorker();
 * await WorkerClient.launchWorker();
 * await WorkerServer.mtdStartServer();
 * const result = await WorkerClient.mtdCallServer(); // "Hello ClientWorker!"
 * ```
 *
 * @public
 */
export class WorkerThreadExport {
  /**
   * Create a typed gateway client proxy for inter-worker communication.
   *
   * @typeParam TWorker - The worker thread init class type.
   * @param path - Path to the target worker file. Must match target init `path`.
   * @param options - Gateway connection options (auth token, reconnect tuning, encoding).
   * @returns Proxy that can be used as static methods or as constructor.
   *
   * @example
   * ```typescript
   * // Static usage
   * const OtherWorkerGateway = WorkerThreadExport.launchGatewayClient<OtherWorkerClass>("/path/to/other.ts", {token: "shared-secret"});
   * await OtherWorkerGateway.someMethod(this, arg1, arg2);
   *
   * // Constructor usage
   * const client = new OtherWorkerGateway(this);
   * await client.someMethod(arg1, arg2);
   * ```
   * @public
   */
  static launchGatewayClient<TWorker extends WorkerThreadInit>(path: string, options?: IGatewayClientOptions): IWorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): IWorkerThreadAsyncMethods<TWorker>} {
    const staticCache = new Map<string, (owner: WorkerThreadInit, ...args: never[]) => Promise<unknown>>()
    const proxy: Record<string, (...args: never[]) => unknown> = new Proxy({} as Record<string, (...args: never[]) => unknown>, {
      get(_, prop) {
        if (Helper.isDeniedRpcProp(prop)) return undefined
        const key = prop as string
        let fn = staticCache.get(key)
        if (!fn) {
          fn = async (owner: WorkerThreadInit, ...args: unknown[]) => {
            let client = owner.gatewayClients.get(path)
            if (!client || client.isClosed()) {
              client = await owner.createGatewayClient(path, options)
            }
            return client.request(key, args)
          }
          staticCache.set(key, fn as (owner: WorkerThreadInit, ...args: never[]) => Promise<unknown>)
        }
        return fn
      }
    })

    // Add constructor support. NOTE: the constructor returns a fresh proxy
    // object, so `instanceof` against it is always false by design — compare
    // against WorkerThreadInit or duck-type instead.
    const ctor = function (this: WorkerThreadInit, owner: WorkerThreadInit) {
      const instanceCache = new Map<string, (...args: never[]) => Promise<unknown>>()
      return new Proxy({} as Record<string, (...args: never[]) => unknown>, {
        get(_, prop) {
          if (Helper.isDeniedRpcProp(prop)) return undefined
          const key = prop as string
          let fn = instanceCache.get(key)
          if (!fn) {
            fn = async (...args: unknown[]) => {
              let client = owner.gatewayClients.get(path)
              if (!client || client.isClosed()) {
                client = await owner.createGatewayClient(path, options)
              }
              return client.request(key, args)
            }
            instanceCache.set(key, fn as (...args: never[]) => Promise<unknown>)
          }
          return fn
        }
      })
    } as unknown as IWorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): IWorkerThreadAsyncMethods<TWorker>}

    Object.setPrototypeOf(ctor, proxy)
    Object.defineProperties(ctor, {
      name: {value: `WorkerThreadGatewayClient`, configurable: true},
      length: {value: 1, configurable: true}
    })
    return ctor
  }

  /**
   * Initialize a worker thread export with automatic environment detection.
   *
   * @remarks
   * In worker thread context, only returns `launchGatewayClient`.
   * In main thread context, returns full proxy with `launchWorker`, `launchGatewayClient`, and all worker methods.
   *
   * @typeParam TWorker - The worker thread init class type.
   * @typeParam TMain - The main thread launch class type.
   * @typeParam TWrap - The custom wrapper type.
   * @param options - Configuration options for the worker thread export.
   * @returns Proxied object with `launchWorker`, `launchGatewayClient`, and worker methods.
   *
   * @example
   * ```typescript
   * // jobs/counter.ts
   * import { WorkerThreadExport, WorkerThreadInit } from "gramstax";
   *
   * class Worker extends WorkerThreadInit {
   *   count = 0;
   *
   *   mtdGetCount() {
   *     return this.count;
   *   }
   * }
   *
   * export const CounterJob = WorkerThreadExport.init({
   *   path: __filename,
   *   WTInit: Worker,
   * });
   *
   * // main.ts
   * import { CounterJob } from "./jobs/counter";
   *
   * await CounterJob.launchWorker();
   * const count = await CounterJob.mtdGetCount();
   * ```
   * @public
   */
  static init<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap = Record<string, unknown>>(options: IWorkerThreadExportOpt<TWorker, TMain, TWrap>): IWorkerThreadExportResult<TWorker, TMain, TWrap> {
    const {WTInit, WTLaunch = WorkerThreadLaunch as unknown as new (path: string, argv?: unknown[]) => TMain, path, wrap} = options
    const uniqueArg = `for-${path}`

    // check if we are in worker thread
    if (process.argv[2] === uniqueArg) {
      new WTInit()
      return {launchGatewayClient: (sp?: string, options?: IGatewayClientOptions) => WorkerThreadExport.launchGatewayClient<TWorker>(Helper.requireGatewayPath(sp), options)} as unknown as IWorkerThreadExportResult<TWorker, TMain, TWrap>
    }

    // below is area main thread
    let instance: TMain | undefined
    // Every launched worker is tracked; `instance` stays the latest for
    // routing (latest-wins: Job.mtd* always calls the most recent launch)
    // while shutdown() drains ALL live workers so earlier ones never leak.
    const instances = new Set<TMain>()

    // Proxy to satisfy TMain type in wrap
    const mainCache = new Map<string, (...args: never[]) => unknown>()
    const mainProxy = new Proxy({} as TMain, {
      get(_, prop) {
        if (Helper.isDeniedRpcProp(prop)) return undefined
        const key = prop as string
        let fn = mainCache.get(key)
        if (!fn) {
          if (key === `request` || key === `kill` || key === `send` || key === `shutdown`) {
            fn = (...args: unknown[]) => {
              if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
              return (instance as unknown as Record<string, (...args: unknown[]) => unknown>)[key]!(...args)
            }
          } else {
            fn = (...args: unknown[]) => {
              if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
              return instance.request(key, args)
            }
          }
          mainCache.set(key, fn as (...args: never[]) => unknown)
        }
        return fn
      }
    })

    const custom = wrap ? wrap(mainProxy as TMain & Record<string, (...args: never[]) => unknown>) : ({} as TWrap)
    const methodCache = new Map<string, (...args: never[]) => unknown>()
    const result = {
      ...custom,
      launchWorker: async (argv: unknown[] = []) => {
        // Slot convention: argv[2] is the routing token, user args follow at
        // argv[3]+. Normalize explicit [undefined] to no-args (see launch.ts).
        const clean = argv.length === 1 && argv[0] === undefined ? [] : argv
        const worker = new WTLaunch(path, [uniqueArg, ...clean])
        instance = worker
        instances.add(worker)
        worker.once(`exit`, () => {
          instances.delete(worker)
        })
        await instance.ready()
        return instance
      },
      launchGatewayClient: (serverPath?: string, options?: IGatewayClientOptions) => {
        return WorkerThreadExport.launchGatewayClient<TWorker>(Helper.requireGatewayPath(serverPath), options)
      },
      shutdown: (timeoutMs?: number) => {
        if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
        const live = [...instances]
        return Promise.all(live.map((w) => w.shutdown(timeoutMs))).then(() => undefined)
      }
    }

    return new Proxy(result, {
      get(target, prop) {
        if (Helper.isDeniedRpcProp(prop)) return undefined
        if (prop === `launchGatewayClient`) return target.launchGatewayClient
        if (prop === `launchWorker`) return target.launchWorker
        if (prop in target) return (target as Record<string, unknown>)[prop as unknown as string]
        const key = prop as string
        let fn = methodCache.get(key)
        if (!fn) {
          fn = (...args: unknown[]) => {
            if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
            return instance.request(key, args)
          }
          methodCache.set(key, fn as (...args: never[]) => unknown)
        }
        return fn
      },
      has(target, prop) {
        if (Helper.isDeniedRpcProp(prop)) return false
        if (prop in target) return true
        // Only real worker methods exist — typos and probes report false
        // instead of passing feature-detection and failing at call time.
        return typeof prop === `string` && prop in WTInit.prototype
      }
    }) as unknown as IWorkerThreadExportResult<TWorker, TMain, TWrap>
  }
}
