import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init"
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export"
import { fileURLToPath } from "url"
import { ServerMainGateway } from "./test-final-server-main"

class WorkerC extends WorkerThreadInit {
  public constructor() {
    super()
    this.autoRun()
  }

  private async autoRun() {
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

export const WorkerCExp = WorkerThreadExport.init({ path: fileURLToPath(import.meta.url), WTInit: WorkerC })
