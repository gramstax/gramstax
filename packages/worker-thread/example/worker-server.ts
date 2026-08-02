import {WorkerThreadExport} from "../src/export"
import {WorkerThreadInit} from "../src/init"

/**
 * Gateway server worker.
 *
 * Exposes `mtdHello` and `mtdSlowTask` over an authenticated gateway socket.
 * Only methods listed in `allowedMethods` are remotely callable — anything
 * else (including `onBeforeExit`) is rejected by the gateway.
 */
export class Worker extends WorkerThreadInit {
  mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`)
    return `Hello ${from}, I am Worker-Server!`
  }

  async mtdSlowTask(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
    return `finished after ${ms}ms`
  }

  async mtdStart() {
    // Gateway socket: path `gateway-main`, authenticated, only these methods callable.
    return await this.createGatewayServer(`gateway-main`, undefined, {token: `s3cret`, allowedMethods: [`mtdHello`, `mtdSlowTask`]})
  }

  async onBeforeExit() {
    console.log(`[Worker-Server] Draining before shutdown...`)
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
}

export const WorkerServer = WorkerThreadExport.init({path: __filename, WTInit: Worker})

// Clients must present the token to connect; only mtdHello/mtdSlowTask may be called.
export const WorkerServerGateway = WorkerServer.launchGatewayClient(`gateway-main`, {token: `s3cret`})
