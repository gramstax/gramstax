import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"
import {fileURLToPath} from "url"

export class WorkerServer extends WorkerThreadInit {
  public static gatewayPath = `gateway-main`

  public constructor() {
    super()
    console.log(`[Worker-Server] Gateway '${WorkerServer.gatewayPath}' is active.`)
  }

  public mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`)
    return `Hello ${from}, I am Worker-Server!`
  }

  public async mtdStart() {
    return await this.createGatewayServer(WorkerServer.gatewayPath, this)
  }
}

export const WorkerServerExp = WorkerThreadExport.init({
  path: fileURLToPath(import.meta.url),
  WTInit: WorkerServer
})

export const WorkerServerGateway = WorkerServerExp.gateway(WorkerServer.gatewayPath)
