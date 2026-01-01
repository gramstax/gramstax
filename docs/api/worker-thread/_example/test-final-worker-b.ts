import { WorkerThreadInit } from "../../../../packages/gramstax/src/worker-thread/init"
import { WorkerThreadExport } from "../../../../packages/gramstax/src/worker-thread/export"
import { fileURLToPath } from "url"
import { ServerMainGateway } from "./test-final-server-main"

class WorkerB extends WorkerThreadInit {
  public constructor() {
    super()
    this.autoRun()
  }

  private async autoRun() {
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

export const WorkerBExp = WorkerThreadExport.init({ path: fileURLToPath(import.meta.url), WTInit: WorkerB })
