import { isMainThread } from "bun"

export class ThreadMain {
  public map = new Map<number, (value: any) => any>()
  public sub: Worker
  public id: number
  public constructor(public path: string, public argv?: any[]) {
    if (!isMainThread) {
      throw new Error(`Is not main thread`)
    }

    this.sub = new Worker(path, { argv })
    this.id = this.sub.threadId
    this.sub.onmessage = async ({ data }) => {
      const { id, method, params, result } = data
      if (method !== undefined) {
        // Handle request from sub
        const func = (this as any)[method]
        if (typeof func !== `function`) {
          throw new Error(`Method ${method} not found`)
        }

        const res = await func.apply(this, params)
        this.send({ id, result: res })
      } else if (result !== undefined) {
        // Handle result from sub (response to sendRequest)
        const resolve = this.map.get(id)
        if (resolve) {
          resolve?.(result)
          this.map.delete(id)
        }
      }
    }
  }

  public createId() {
    return Math.random()
  }

  public send(payload: any) {
    this.sub.postMessage(payload)
  }

  public async sendRequest(method: string, params: any, wait = true): Promise<any> {
    const id = this.createId()
    if (!wait) {
      return this.send({ id, method, params })
    }
    return new Promise((resolve) => {
      this.map.set(id, resolve)
      this.send({ id, method, params })
    })
  }

  public kill() {
    this.sub.terminate()
  }

  public async clone(argv?: any[]) {
    // for run sub thread with position linear 1, 2, 3, ...
    await new Promise((resolve) => {
      setInterval(() => {
        if (this.id) {
          resolve(this.id)
        }
      }, 100)
    })
    return new ThreadMain(this.path, argv)
  }
}
