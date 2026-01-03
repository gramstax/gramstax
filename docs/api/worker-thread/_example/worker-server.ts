import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"
import {fileURLToPath} from "url"

export class Core extends WorkerThreadInit {
  static gatewayPath = `gateway-main`

  constructor() {
    super()
    console.log(`[Worker-Server] Gateway '${Core.gatewayPath}' is active.`)
  }

  mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`)
    return `Hello ${from}, I am Worker-Server!`
  }

  async mtdStart() {
    return await this.createGatewayServer(Core.gatewayPath, this)
  }
}

export const WorkerServer = WorkerThreadExport.init({path: fileURLToPath(import.meta.url), WTInit: Core})
export const WorkerServerGateway = WorkerServer.gateway(Core.gatewayPath)
