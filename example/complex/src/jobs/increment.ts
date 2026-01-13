import {log, WorkerThreadExport, WorkerThreadInit} from "gramstax"

export class Worker extends WorkerThreadInit {
  count = 0
  constructor() {
    super()

    const ms = process.argv[3] as any
    this.autoRun(ms)
  }

  autoRun(ms: number) {
    setInterval(() => {
      this.count += 1
      log.debug(`(${this.pid}:${this.id}) [IncrementCoreJob] count: ${this.count}`)
    }, ms)
  }

  getCount() {
    return this.count
  }
}

export const IncrementJob = WorkerThreadExport.init({path: __filename, WTInit: Worker})
