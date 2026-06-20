import {Server, type Connection} from "net-ipc"
import {WorkerThreadRpc} from "./rpc"

/**
 * [LOW-LEVEL] Provides IPC server functionality for inter-worker communication using Unix domain sockets.
 *
 * @remarks
 * Low-level infrastructure. In most cases use
 * {@link WorkerThreadInit.createGatewayServer} instead of constructing this directly.
 *
 * Uses the `net-ipc` library for Unix domain socket communication. Works in
 * **Bun** (native) and **Node.js** (native).
 *
 * Supports connections from multiple gateway clients.
 *
 * @public
 */
export class WorkerThreadGatewayServer {
  /**
   * The underlying `net-ipc` Server instance.
   *
   * @remarks
   * Uses `Server` from net-ipc for IPC transport.
   */
  server = new Server()

  /**
   * Map of RPC handlers per connection. Key is the connection ID.
   *
   * @remarks
   * Values are {@link WorkerThreadRpc} instances scoped per connection.
   */
  rpc = new Map<string, WorkerThreadRpc>()

  /**
   * Object exposed to clients.
   *
   * @remarks
   * Properties become RPC-callable methods.
   */
  register: any = {}

  /**
   * Creates a new gateway server instance.
   *
   * @remarks
   * Typically not called directly; use {@link WorkerThreadInit.createGatewayServer} instead.
   */
  constructor() {
    this.server.on(`connect`, (connection: Connection) => {
      const rpc = new WorkerThreadRpc((data) => {
        return connection.send(data)
      }, this.register)

      this.rpc.set(connection.id, rpc)
    })

    this.server.on(`disconnect`, (connection: Connection) => {
      this.rpc.delete(connection.id)
    })

    this.server.on(`message`, (message: any, connection: Connection) => {
      const rpc = this.rpc.get(connection.id)
      if (rpc) {
        rpc.make(message)
      }
    })

    this.server.on(`error`, (err: any) => {
      console.error(err)
    })
  }

  /**
   * Start the gateway server.
   *
   * @param path - Unix socket path to bind. Gateway path identifier.
   * @param register - Object to expose to clients. Called by connected clients. Defaults to `{}`.
   * @returns Promise that resolves to this server instance when ready.
   *
   * @example
   * ```typescript
   * await server.start("/tmp/data-worker.sock", {
   *   ping: () => "pong",
   *   getData: (key) => database.get(key),
   *   setData: (key, value) => database.set(key, value),
   * });
   * console.log("Gateway server started");
   * ```
   * @public
   */
  async start(path: string, register?: any) {
    if (register !== undefined) {
      this.register = register
    }
    this.server.options.path = path
    const p = new Promise((resolve) => {
      this.server.once(`ready`, () => resolve(this))
    })
    await this.server.start()
    return p
  }
}
