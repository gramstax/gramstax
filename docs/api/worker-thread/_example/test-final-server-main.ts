import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"

class Worker extends WorkerThreadInit {
  static gatewayServerPath = `gateway-final`
  constructor() {
    super()
  }

  mtdHello(from: string) {
    console.log(`[Server-Main] Received greeting from: ${from}`)
    return `Hello ${from}, I am Server-Main!`
  }

  async mtdStart() {
    const res = await this.createGatewayServer()
    if (res) {
      console.log(`[Server-Main] Gateway '${this.gatewayServerPath}' is active.`)
      return res
    }
    return false
  }
}

export const ServerMain = WorkerThreadExport.init({path: __filename, WTInit: Worker})
export const ServerMainGateway = ServerMain.launchGatewayClient()
