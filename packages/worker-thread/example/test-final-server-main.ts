import {WorkerThreadExport} from "../src/export"
import {WorkerThreadInit} from "../src/init"

/**
 * Final-example gateway server worker.
 *
 * Clients must present `final-token` to call `mtdHello` over the gateway.
 */
class Worker extends WorkerThreadInit {
  mtdHello(from: string) {
    console.log(`[Server-Main] Received greeting from: ${from}`)
    return `Hello ${from}, I am Server-Main!`
  }

  async mtdStart() {
    return await this.createGatewayServer(`gateway-final`, undefined, {token: `final-token`, allowedMethods: [`mtdHello`]})
  }

  async onBeforeExit() {
    console.log(`[Server-Main] Draining before shutdown...`)
  }
}

export const ServerMain = WorkerThreadExport.init({path: __filename, WTInit: Worker})
export const ServerMainGateway = ServerMain.launchGatewayClient(`gateway-final`, {token: `final-token`})
