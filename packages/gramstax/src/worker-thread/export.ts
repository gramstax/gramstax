import {WorkerThreadLaunch} from "./launch"
import {WorkerThreadInit} from "./init"

export type WorkerThreadExportOpt<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap> = {
  path: string
  WTInit: new () => TWorker
  WTLaunch?: new (path: string, argv?: any[]) => TMain
  wrap?: (main: TMain) => TWrap
}

export type WorkerThreadGatewayProxy<T> = {
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: any[]) => any ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (owner: WorkerThreadInit, ...args: A) => Promise<Awaited<R>> : never
}

export type WorkerThreadAsyncMethods<T> = {
  [K in keyof T as K extends keyof WorkerThreadInit ? never : K extends string ? (T[K] extends (...args: any[]) => any ? K : never) : never]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
}

export class WorkerThreadExport {
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
