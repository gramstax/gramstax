import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"
import {fileURLToPath} from "url"
import {WorkerServerGateway} from "./worker-server"

class Core extends WorkerThreadInit {
  private name: string = `Unknown`

  constructor() {
    super()
    this.name = this.argv[3] || `Unknown`
    this.autoRun()
  }

  async autoRun() {
    console.log(`[Worker-Client-${this.name}] Starting autoRun...`)
    try {
      console.log(`[Worker-Client-${this.name}] Connecting to gateway...`)
      const res = await WorkerServerGateway.mtdHello(this, `Worker-Client-${this.name}`)
      console.log(`[Worker-Client-${this.name}] Server response: ${res}`)
    } catch (err: any) {
      console.error(`[Worker-Client-${this.name}] Error:`, err.message || err)
    }
  }
}

export const WorkerClient = WorkerThreadExport.init({path: fileURLToPath(import.meta.url), WTInit: Core})
