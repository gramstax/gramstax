import {Client} from "net-ipc"
import {WorkerThreadRpc} from "./rpc"

/**
 * [LOW-LEVEL] Provides IPC client functionality for inter-worker communication using Unix domain sockets.
 *
 * @remarks
 * Low-level infrastructure. In most cases use
 * {@link WorkerThreadInit.createGatewayClient} instead of constructing this directly.
 *
 * Uses the `net-ipc` library for Unix domain socket communication. Works in
 * **Bun** (native) and **Node.js** (native).
 *
 * @public
 */
export class WorkerThreadGatewayClient {
  /**
   * The underlying `net-ipc` Client instance.
   *
   * @remarks
   * Uses the net-ipc `Client` for IPC transport.
   */
  client = new Client()

  /**
   * RPC handler for messaging.
   *
   * @remarks
   * Uses {@link WorkerThreadRpc} to encode and dispatch RPC calls.
   */
  rpc: WorkerThreadRpc

  /**
   * Creates a new gateway client instance.
   *
   * @remarks
   * Typically not called directly; use {@link WorkerThreadInit.createGatewayClient} instead.
   */
  constructor() {
    this.rpc = new WorkerThreadRpc((data) => {
      return this.client.send(data)
    }, {})

    this.client.on(`message`, (data: any) => {
      this.rpc.make(data)
    })
  }

  /**
   * Connect to a gateway server.
   *
   * @param path - Unix socket path. Matches server gateway.
   * @returns Promise that resolves to this client instance when connection is ready.
   *
   * @example
   * ```typescript
   * await client.connect("/tmp/worker-server.sock");
   * console.log("Connected to gateway server");
   * ```
   * @public
   */
  async connect(path: string) {
    this.client.options.path = path
    const p = new Promise((resolve) => {
      this.client.once(`ready`, () => resolve(this))
    })
    await this.client.connect()
    return p
  }

  /**
   * Make an RPC request to the server.
   *
   * @param method - Server method to call. Targets server RPC method.
   * @param params - Method parameters. Sent as positional array.
   * @param _wait - Wait for response. If false, fire-and-forget. Defaults to `true`.
   * @param _others - Additional RPC data. Merged into RPC payload.
   * @returns Promise resolving with server response.
   *
   * @example
   * ```typescript
   * const result = await client.request("ping", []);
   * console.log("Server responded:", result);
   * ```
   * @public
   */
  async request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }
}
