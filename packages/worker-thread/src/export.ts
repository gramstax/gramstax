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

import type {GatewayClientOptions} from "./gateway-client"
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
export type WorkerThreadExportOpt<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap> = {
  /** Path to the worker file. Typically `__filename` for self-referential workers. */
  path: string
  /** Worker thread init class. Extends {@link WorkerThreadInit}. */
  WTInit: new () => TWorker
  /** Main thread launch class. Extends {@link WorkerThreadLaunch}. Defaults to `WorkerThreadLaunch`. */
  WTLaunch?: new (path: string, argv?: unknown[]) => TMain
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
export type WorkerThreadGatewayProxy<T> = {
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: never[]) => unknown ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (owner: WorkerThreadInit, ...args: A) => Promise<Awaited<R>> : never
}

/**
 * Async methods type for worker thread. Transforms all worker methods to return Promises.
 *
 * @typeParam T - The worker thread init class type.
 *
 * @public
 */
export type WorkerThreadAsyncMethods<T> = {
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: never[]) => unknown ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
}

/**
 * Factory type for `launchGatewayClient` returned by {@link WorkerThreadExport.init}.
 *
 * @typeParam TWorker - The worker thread init class type.
 * @public
 */
export type WorkerThreadGatewayClientFactory<TWorker extends WorkerThreadInit> = (serverPath: string, options?: GatewayClientOptions) => WorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): WorkerThreadAsyncMethods<TWorker>}

/**
 * Result type of {@link WorkerThreadExport.init}.
 *
 * @typeParam TWorker - The worker thread init class type.
 * @typeParam TMain - The main thread launch class type.
 * @typeParam TWrap - The custom wrapper type.
 * @public
 */
export type WorkerThreadExportResult<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap> = TWrap & WorkerThreadAsyncMethods<TWorker> & {
  launchWorker: (argv?: unknown[]) => Promise<TMain>
  launchGatewayClient: WorkerThreadGatewayClientFactory<TWorker>
  shutdown: (timeoutMs?: number) => Promise<void>
}

/**
 * Validate a gateway server path is provided.
 *
 * @param serverPath - Path to the gateway server socket.
 * @returns The validated path.
 * @throws When the path is missing or empty.
 */
function requireGatewayPath(serverPath?: string): string {
  if (!serverPath || typeof serverPath !== `string`) {
    throw new Error(`launchGatewayClient requires a gateway server path — pass the same path used in createGatewayServer()`)
  }
  return serverPath
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
  *     return await this.createGatewayServer("/tmp/server.sock");
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
  static launchGatewayClient<TWorker extends WorkerThreadInit>(path: string, options?: GatewayClientOptions): WorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): WorkerThreadAsyncMethods<TWorker>} {
    const proxy: Record<string, (...args: never[]) => unknown> = new Proxy({} as Record<string, (...args: never[]) => unknown>, {
      get(_, prop) {
        if (typeof prop !== `string` || prop === `then`) return undefined
        return async (owner: WorkerThreadInit, ...args: unknown[]) => {
          let client = owner.gatewayClients.get(path)
          if (!client || client.isClosed()) {
            client = await owner.createGatewayClient(path, options)
          }
          return client.request(prop, args)
        }
      }
    })

    // Add constructor support
    const ctor = function (this: WorkerThreadInit, owner: WorkerThreadInit) {
      return new Proxy({} as Record<string, (...args: never[]) => unknown>, {
        get(_, prop) {
          if (typeof prop !== `string` || prop === `then`) return undefined
          return async (...args: unknown[]) => {
            let client = owner.gatewayClients.get(path)
            if (!client || client.isClosed()) {
              client = await owner.createGatewayClient(path, options)
            }
            return client.request(prop, args)
          }
        }
      })
    } as unknown as WorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): WorkerThreadAsyncMethods<TWorker>}

    Object.setPrototypeOf(ctor, proxy)
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
  static init<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap = Record<string, unknown>>(
    options: WorkerThreadExportOpt<TWorker, TMain, TWrap>
  ): WorkerThreadExportResult<TWorker, TMain, TWrap> {
    const {WTInit, WTLaunch = WorkerThreadLaunch as unknown as new (path: string, argv?: unknown[]) => TMain, path, wrap} = options
    const uniqueArg = `for-${path}`

    // check if we are in worker thread
    if (process.argv[2] === uniqueArg) {
      new WTInit()
      return {launchGatewayClient: (sp?: string, options?: GatewayClientOptions) => WorkerThreadExport.launchGatewayClient<TWorker>(requireGatewayPath(sp), options)} as unknown as WorkerThreadExportResult<TWorker, TMain, TWrap>
    }

    // below is area main thread
    let instance: TMain

    // Proxy to satisfy TMain type in wrap
    const mainProxy = new Proxy({} as TMain, {
      get(_, prop) {
        if (prop === `then`) return undefined
        if (prop === `request` || prop === `kill` || prop === `send` || prop === `shutdown`) {
          return (...args: unknown[]) => {
            if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
            return (instance as unknown as Record<string, (...args: unknown[]) => unknown>)[prop as string]!(...args)
          }
        }
        return (...args: unknown[]) => {
          if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
          return instance.request(prop as string, args)
        }
      }
    })

    const custom = wrap ? wrap(mainProxy as TMain & Record<string, (...args: never[]) => unknown>) : ({} as TWrap)
    const result = {
      ...custom,
      launchWorker: async (argv: unknown[] = []) => {
        // each call spawns an independent worker — callers own the returned
        // launch instances (launching the same Job multiple times is valid)
        instance = new WTLaunch(path, [uniqueArg, ...argv])
        await instance.ready()
        return instance
      },
      launchGatewayClient: (serverPath?: string, options?: GatewayClientOptions) => {
        return WorkerThreadExport.launchGatewayClient<TWorker>(requireGatewayPath(serverPath), options)
      },
      shutdown: (timeoutMs?: number) => {
        if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
        return instance.shutdown(timeoutMs)
      }
    }

    return new Proxy(result, {
      get(target, prop) {
        if (prop === `then`) return undefined
        if (prop === `launchGatewayClient`) return target.launchGatewayClient
        if (prop === `launchWorker`) return target.launchWorker
        if (prop in target) return (target as Record<string, unknown>)[prop as unknown as string]
        if (typeof prop === `string`) {
          return (...args: unknown[]) => {
            if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
            return instance.request(prop, args)
          }
        }
        return (target as Record<string, unknown>)[prop as unknown as string]
      }
    }) as unknown as WorkerThreadExportResult<TWorker, TMain, TWrap>
  }
}
