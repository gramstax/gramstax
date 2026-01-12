import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"

export class Worker extends WorkerThreadInit {
  static gatewayPath = `gateway-main`

  constructor() {
    super()
    console.log(`[Worker-Server] Gateway '${Worker.gatewayPath}' is active.`)
  }

  mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`)
    return `Hello ${from}, I am Worker-Server!`
  }

  async mtdStart() {
    return await this.createGatewayServer(Worker.gatewayPath, this)
  }
}

export const WorkerServer = WorkerThreadExport.init({path: __filename, WTInit: Worker})
export const WorkerServerGateway = WorkerServer.gateway(Worker.gatewayPath)
