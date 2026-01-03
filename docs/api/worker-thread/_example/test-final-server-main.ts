import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"
import {fileURLToPath} from "url"

class Core extends WorkerThreadInit {
  static gatewayPath = `gateway-final`
  constructor() {
    super()
    console.log(`[Server-Main] Gateway '${Core.gatewayPath}' is active.`)
  }

  mtdHello(from: string) {
    console.log(`[Server-Main] Received greeting from: ${from}`)
    return `Hello ${from}, I am Server-Main!`
  }

  async mtdStart() {
    return await this.createGatewayServer(Core.gatewayPath, this)
  }
}

export const ServerMain = WorkerThreadExport.init({path: fileURLToPath(import.meta.url), WTInit: Core})
export const ServerMainGateway = ServerMain.gateway(Core.gatewayPath)
