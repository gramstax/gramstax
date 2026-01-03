import {WorkerThreadInit} from "../../../../packages/gramstax/src/worker-thread/init"
import {WorkerThreadExport} from "../../../../packages/gramstax/src/worker-thread/export"
import {fileURLToPath} from "url"

export class ServerMain extends WorkerThreadInit {
  public static gatewayPath = `gateway-final`
  public constructor() {
    super()
    console.log(`[Server-Main] Gateway '${ServerMain.gatewayPath}' is active.`)
  }

  public mtdHello(from: string) {
    console.log(`[Server-Main] Received greeting from: ${from}`)
    return `Hello ${from}, I am Server-Main!`
  }

  public async mtdStart() {
    return await this.createGatewayServer(ServerMain.gatewayPath, this)
  }
}

export const ServerMainExp = WorkerThreadExport.init({path: fileURLToPath(import.meta.url), WTInit: ServerMain})
export const ServerMainGateway = ServerMainExp.gateway(ServerMain.gatewayPath)
