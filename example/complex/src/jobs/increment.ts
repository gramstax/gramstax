import { log, WorkerThreadExport, WorkerThreadInit } from "gramstax"

export class IncrementCoreJob extends WorkerThreadInit {
  public count = 0
  public constructor() {
    super()

    const ms = process.argv[3] as any
    setInterval(() => {
      this.count += 1
      log.debug(`(${this.pid}:${this.id}) [IncrementCoreJob] count: ${this.count}`)
    }, ms)
  }

  public getCount() {
    return this.count
  }
}

export const IncrementJob = WorkerThreadExport.init({ path: __filename, WTInit: IncrementCoreJob })
