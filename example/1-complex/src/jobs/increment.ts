import {LogHe} from "~/helpers/log"
import {WorkerThreadExport, WorkerThreadInit} from "gramstax"

export class Worker extends WorkerThreadInit {
  count = 0
  constructor() {
    super()
    const ms = process.argv[3] as any
    this.mtdAutoRun(ms)
  }

  mtdAutoRun(ms: number) {
    const padStart = `(${this.pid}:${this.id}) [IncrementCoreJob]`
    LogHe.debug(`${padStart} Started..`)
    setInterval(() => {
      this.count += 1
      LogHe.debug(`${padStart} count: ${this.count}`)
    }, ms)
  }

  mtdGetCount() {
    return this.count
  }
}

export const IncrementJob = WorkerThreadExport.init({path: __filename, WTInit: Worker})
