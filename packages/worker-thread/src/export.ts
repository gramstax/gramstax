import {WorkerThreadLaunch} from "./launch"
import {WorkerThreadInit} from "./init"

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
  WTLaunch?: new (path: string, argv?: any[]) => TMain
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
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: any[]) => any ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (owner: WorkerThreadInit, ...args: A) => Promise<Awaited<R>> : never
}

/**
 * Async methods type for worker thread. Transforms all worker methods to return Promises.
 *
 * @typeParam T - The worker thread init class type.
 *
 * @public
 */
export type WorkerThreadAsyncMethods<T> = {
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: any[]) => any ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
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
 *   static gatewayServerPath = "/tmp/server.sock";
 *
 *   mtdHello(from: string) {
 *     return `Hello ${from}!`;
 *   }
 *
 *   async mtdStartServer() {
 *     return await this.createGatewayServer();
 *   }
 * }
 *
 * export const WorkerServer = WorkerThreadExport.init({
 *   path: __filename,
 *   WTInit: ServerWorker,
 * });
 * export const WorkerServerGateway = WorkerServer.launchGatewayClient();
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
   * @returns Proxy that can be used as static methods or as constructor.
   *
   * @example
   * ```typescript
   * // Static usage
   * const OtherWorkerGateway = WorkerThreadExport.launchGatewayClient<OtherWorkerClass>("/path/to/other.ts");
   * await OtherWorkerGateway.someMethod(this, arg1, arg2);
   *
   * // Constructor usage
   * const client = new OtherWorkerGateway(this);
   * await client.someMethod(arg1, arg2);
   * ```
   * @public
   */
  static launchGatewayClient<TWorker extends WorkerThreadInit>(path: string): WorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): WorkerThreadAsyncMethods<TWorker>} {
    const proxy: any = new Proxy({} as any, {
      get(_, prop) {
        if (typeof prop !== `string` || prop === `then`) return undefined
        return async (owner: WorkerThreadInit, ...args: any[]) => {
          let client = owner.gatewayClients.get(path)
          if (!client) {
            client = await owner.createGatewayClient(path)
          }
          return client.request(prop, args)
        }
      }
    })

    // Add constructor support
    const ctor: any = function (this: any, owner: WorkerThreadInit) {
      return new Proxy({} as any, {
        get(_, prop) {
          if (typeof prop !== `string` || prop === `then`) return undefined
          return async (...args: any[]) => {
            let client = owner.gatewayClients.get(path)
            if (!client) {
              client = await owner.createGatewayClient(path)
            }
            return client.request(prop, args)
          }
        }
      })
    }

    Object.setPrototypeOf(ctor, proxy)
    return ctor as any
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
  static init<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap = Record<any, any>>(
    options: WorkerThreadExportOpt<TWorker, TMain, TWrap>
  ): TWrap & WorkerThreadAsyncMethods<TWorker> & {launchWorker: (argv?: any[]) => Promise<TMain>; launchGatewayClient: (serverPath?: string) => WorkerThreadGatewayProxy<TWorker> & {new (owner: WorkerThreadInit): WorkerThreadAsyncMethods<TWorker>}} {
    const {WTInit, WTLaunch = WorkerThreadLaunch as any, path, wrap} = options
    const uniqueArg = `for-${path}`

    // check if we are in worker thread
    if (process.argv[2] === uniqueArg) {
      new WTInit()
      return {launchGatewayClient: (sp?: string) => WorkerThreadExport.launchGatewayClient<TWorker>(sp || (WTInit as any).gatewayServerPath)} as any
    }

    // below is area main thread
    let instance: TMain

    // Proxy to satisfy TMain type in wrap
    const mainProxy = new Proxy({} as TMain, {
      get(_, prop) {
        if (prop === `then`) return undefined
        if (prop === `sendRequest` || prop === `request` || prop === `kill` || prop === `send`) {
          return (...args: any[]) => {
            if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
            return (instance as any)[prop](...args)
          }
        }
        return (...args: any[]) => {
          if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
          return instance.request(prop as string, args)
        }
      }
    })

    const custom = wrap ? wrap(mainProxy as TMain & Record<string, any>) : ({} as TWrap)
    const result: any = {
      ...custom,
      launchWorker: async (argv: any[] = []) => {
        instance = new WTLaunch(path, [uniqueArg, ...argv])
        await instance.ready()
        return instance
      },
      launchGatewayClient: (serverPath?: string) => {
        return WorkerThreadExport.launchGatewayClient<TWorker>(serverPath || (WTInit as any).gatewayServerPath)
      }
    }

    return new Proxy(result, {
      get(target, prop) {
        if (prop === `then`) return undefined
        if (prop === `launchGatewayClient`) return target.launchGatewayClient
        if (prop === `launchWorker`) return target.launchWorker
        if (prop in target) return target[prop as any]
        if (typeof prop === `string`) {
          return (...args: any[]) => {
            if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
            return instance.request(prop, args)
          }
        }
        return target[prop as any]
      }
    })
  }
}
