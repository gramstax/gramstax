import {WorkerThreadExport} from "../src/export"
import {WorkerThreadInit} from "../src/init"
import {WorkerServerGateway} from "./worker-server"

/**
 * Gateway client worker.
 *
 * Talks to the server worker over the gateway socket (using the shared
 * token) and also exposes `mtdCompute` so the main thread can dispatch
 * work through a pool.
 */
class Worker extends WorkerThreadInit {
  private name: string = `Unknown`

  constructor() {
    super()
    this.name = this.argv[3] || `Unknown`
    this.mtdGreetServer()
  }

  async mtdGreetServer() {
    console.log(`[Worker-Client-${this.name}] Connecting to gateway...`)
    try {
      // RPC over the gateway socket — bypasses the main thread entirely.
      const res = await WorkerServerGateway.mtdHello(this, `Worker-Client-${this.name}`)
      console.log(`[Worker-Client-${this.name}] Server response: ${res}`)
    } catch (err: unknown) {
      console.error(`[Worker-Client-${this.name}] Error:`, err instanceof Error ? err.message : err)
    }
  }

  mtdCompute(n: number) {
    return n * 2
  }
}

export const WorkerClient = WorkerThreadExport.init({path: __filename, WTInit: Worker})
