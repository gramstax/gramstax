import {WorkerThreadInit} from "../src/init"
import {WorkerThreadExport} from "../src/export"

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
    const res = await this.createGatewayServer()
    if (res) {
      console.log(`[Worker-Server] Gateway '${this.gatewayServerPath}' is active.`)
      return res
    }
    return false
  }
}

export const WorkerServer = WorkerThreadExport.init({path: __filename, WTInit: Worker})
export const WorkerServerGateway = WorkerServer.launchGatewayClient()
