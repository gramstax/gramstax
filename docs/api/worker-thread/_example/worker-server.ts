import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"

export class Worker extends WorkerThreadInit {
  static gatewayServerPath = `gateway-main`

  constructor() {
    super()
  }

  mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`)
    return `Hello ${from}, I am Worker-Server!`
  }

  async mtdStart() {
    const res = await this.createGatewayServer(this.gatewayServerPath, this)
    console.log(`[Worker-Server] Gateway '${this.gatewayServerPath}' is active.`)
    return res
  }
}

export const WorkerServer = WorkerThreadExport.init({path: __filename, WTInit: Worker})
export const WorkerServerGateway = WorkerServer.launchGatewayClient()
