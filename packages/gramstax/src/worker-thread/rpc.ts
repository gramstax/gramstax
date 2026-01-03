export type IMapRpc = Map<any, {reject: (error: any) => any; resolve: (result: any) => any}>

export class WorkerThreadRpc {
  map = new Map() as IMapRpc
  constructor(public send: (data: any) => any, public register: Record<any, any>) {}

  async make(data: any) {
    const map = this.map
    const send = this.send
    const {id, method, params, result, error} = data

    if (method !== undefined) {
      // Handle request
      try {
        const func = this.register[method]
        if (typeof func !== `function`) {
          throw new Error(`Method ${method} not found or not function`)
        }

        const res = await func.apply(this.register, params)
        send({id, result: res})
      } catch (err: any) {
        send({
          id,
          error: err instanceof Error ? {message: err.message, stack: err.stack, name: err.name} : err
        })
      }
    } else if (result !== undefined) {
      // Handle result
      const data = map.get(id)
      if (data) {
        data.resolve(result)
        map.delete(id)
      }
    } else if (error !== undefined) {
      // Handle error
      const data = map.get(id)
      if (data) {
        data.reject(error)
        map.delete(id)
      }
    }
  }

  makeId() {
    return Math.random()
  }

  makeRequest(method: string, params: any, _wait = true, _others?: Record<string, any>): Promise<any> {
    const id = this.makeId()
    const pld = {id, method, params, ..._others}
    if (!_wait) {
      return this.send(pld)
    }

    return new Promise((resolve, reject) => {
      this.map.set(id, {resolve, reject})
      this.send(pld)
    })
  }
}
