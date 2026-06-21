import {WorkerThreadInit} from "../src/init"
import {WorkerThreadExport} from "../src/export"
import {ServerMainGateway} from "./test-final-server-main"

class Worker extends WorkerThreadInit {
  constructor() {
    super()
    this.mtdAutoRun()
  }

  async mtdAutoRun() {
    console.log(`[Worker-C] Starting autoRun...`)
    try {
      console.log(`[Worker-C] Connecting to gateway-final...`)
      const res = await ServerMainGateway.mtdHello(this, `Worker-C`)
      console.log(`[Worker-C] Server response: ${res}`)
    } catch (err: any) {
      console.error(`[Worker-C] Error:`, err.message || err)
    }
  }
}

export const WorkerC = WorkerThreadExport.init({path: __filename, WTInit: Worker})
