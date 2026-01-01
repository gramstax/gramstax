import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init"
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export"
import { fileURLToPath } from "url"
import { ServerMainGateway } from "./test-final-server-main"

class WorkerA extends WorkerThreadInit {
  public constructor() {
    super()
    this.autoRun()
  }

  private async autoRun() {
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

export const WorkerAExp = WorkerThreadExport.init({ path: fileURLToPath(import.meta.url), WTInit: WorkerA })
