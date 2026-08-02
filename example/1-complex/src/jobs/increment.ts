import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"
import {LogHe} from "~/helpers/log"

export class Worker extends WorkerThreadInit {
  count = 0
  constructor() {
    super()
    const ms = Number(process.argv[3])
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
