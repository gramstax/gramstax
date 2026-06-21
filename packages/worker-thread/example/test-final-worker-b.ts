import {WorkerThreadInit} from "../src/init"
import {WorkerThreadExport} from "../src/export"
import {ServerMainGateway} from "./test-final-server-main"

class Worker extends WorkerThreadInit {
  constructor() {
    super()
    this.mtdAutoRun()
  }

  async mtdAutoRun() {
    console.log(`[Worker-B] Starting autoRun...`)
    try {
      console.log(`[Worker-B] Connecting to gateway-final...`)
      const res = await ServerMainGateway.mtdHello(this, `Worker-B`)
      console.log(`[Worker-B] Server response: ${res}`)
    } catch (err: any) {
      console.error(`[Worker-B] Error:`, err.message || err)
    }
  }
}

export const WorkerB = WorkerThreadExport.init({path: __filename, WTInit: Worker})
