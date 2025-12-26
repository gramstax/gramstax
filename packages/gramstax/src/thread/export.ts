import { ThreadMain } from "./main"
import { ThreadSub } from "./sub"

export type ThreadExportOptions<TSub extends ThreadSub, TMain extends ThreadMain, TWrap> = {
  CSub: new () => TSub
  path: string
  CMain?: new (path: string, argv?: any[]) => TMain
  wrap?: (main: TMain) => TWrap
}

export class ThreadExport {
  public static init<TSub extends ThreadSub, TMain extends ThreadMain, TWrap = Record<any, any>>(options: ThreadExportOptions<TSub, TMain, TWrap>): TWrap & { launch: (argv?: any[]) => TMain } {
    const { CSub, CMain = ThreadMain as any, path, wrap } = options
    const uniqueArg = `for-${path}`

    // check if we are in sub thread
    if (ThreadSub.prototype.argv[2] === uniqueArg) {
      new CSub()
      return {} as any
    }

    // below is area main thread
    let instance: TMain

    // Proxy to satisfy TMain type in wrap
    // This allows defining methods that call sendRequest before the instance is even created
    const mainProxy = new Proxy({} as TMain, {
      get(_, prop) {
        if (prop === `sendRequest`) {
          return (method: string, params: any, wait = true) => {
            if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
            return instance.sendRequest(method, params, wait)
          }
        }
        return (...args: any[]) => {
          if (!instance) throw new Error(`Thread at ${path} not launched yet.`)
          return instance.sendRequest(prop as string, args)
        }
      }
    })

    const custom = wrap ? wrap(mainProxy as TMain & Record<string, any>) : ({} as TWrap)
    const result = {
      ...custom,
      launch: (argv: any[] = []) => {
        instance = new CMain(path, [uniqueArg, ...argv])
        return instance
      }
    }
    return result
  }
}
