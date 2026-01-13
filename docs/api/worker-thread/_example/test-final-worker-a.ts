import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"
import {ServerMainGateway} from "./test-final-server-main"

class Worker extends WorkerThreadInit {
  constructor() {
    super()
    this.mtdAutoRun()
  }

  async mtdAutoRun() {
    console.log(`[Worker-A] Starting autoRun...`)
    try {
      console.log(`[Worker-A] Connecting to gateway-final...`)
      const res = await ServerMainGateway.mtdHello(this, `Worker-A`)
      console.log(`[Worker-A] Server response: ${res}`)
    } catch (err: any) {
      console.error(`[Worker-A] Error:`, err.message || err)
    }
  }
}

export const WorkerA = WorkerThreadExport.init({path: __filename, WTInit: Worker})
