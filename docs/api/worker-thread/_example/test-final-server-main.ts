import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"

class Worker extends WorkerThreadInit {
  static gatewayPath = `gateway-final`
  constructor() {
    super()
    console.log(`[Server-Main] Gateway '${Worker.gatewayPath}' is active.`)
  }

  mtdHello(from: string) {
    console.log(`[Server-Main] Received greeting from: ${from}`)
    return `Hello ${from}, I am Server-Main!`
  }

  async mtdStart() {
    return await this.createGatewayServer(Worker.gatewayPath, this)
  }
}

export const ServerMain = WorkerThreadExport.init({path: __filename, WTInit: Worker})
export const ServerMainGateway = ServerMain.gateway(Worker.gatewayPath)
