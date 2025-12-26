import { isMainThread } from "bun"

declare const self: Worker

export class ThreadSub {
  public map = new Map<number, (value: any) => any>()
  public argv = process.argv
  public id = process.pid
  public threadIsMain = isMainThread
  public constructor() {
    if (this.threadIsMain) {
      throw new Error(`Is not sub thread`)
    }

    self.onmessage = async ({ data }) => {
      const { id, method, params, result } = data
      if (method !== undefined) {
        // request from main
        try {
          const func = (this as any)[method]
          if (typeof func !== `function`) {
            throw new Error(`Method ${method} not found`)
          }

          const res = await func.apply(this, params)
          this.send({ id, result: res })
        } catch (error: any) {
          this.send({ id, error })
        }
      } else if (result !== undefined) {
        // result from main. (after request to main)
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
    self.postMessage(payload)
  }

  public async sendRequest(method: string, params: any, wait = true) {
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
    self.terminate()
  }
}
