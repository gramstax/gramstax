/**
 * Worker thread initializer — runs inside the worker thread.
 *
 * @remarks
 * Extend this class to define worker methods. The base class sets up the
 * RPC listener and provides helpers for inter-worker IPC
 * ({@link createGatewayServer}, {@link createGatewayClient}).
 *
 * All `mtd*` methods are automatically proxied for RPC calls from the
 * main thread.
 *
 * @public
 */

import {parentPort, threadId, isMainThread} from "node:worker_threads"
import {WorkerThreadRpc} from "./rpc"
import {WorkerThreadGatewayServer} from "./gateway-server"
import {WorkerThreadGatewayClient} from "./gateway-client"

/**
 * Base class for worker thread implementations.
 * Handles communication with the main thread and provides RPC functionality.
 *
 * @remarks
 * Extend this class when defining worker thread behavior.
 * Uses `parentPort` for messaging with main thread.
 * Constructor automatically signals readiness to main thread.
 *
 * @example
 * ```typescript
 * import { WorkerThreadInit, WorkerThreadExport, log } from "gramstax";
 *
 * class Worker extends WorkerThreadInit {
 *   constructor() {
 *     super(); // Required - signals ready to main thread
 *     log.info(`Worker ${this.id} started`);
 *   }
 *
 *   mtdProcess(data: any) {
 *     return { processed: data };
 *   }
 * }
 *
 * export const MyWorker = WorkerThreadExport.init({
 *   path: __filename,
 *   WTInit: Worker,
 * });
 * ```
 *
 * @public
 */
export class WorkerThreadInit {
  /**
   * Command line arguments passed to the worker.
   * Same as `process.argv`. Custom args start at index 3.
   *
   * @remarks
   * Use this for worker-specific flags and configuration.
   */
  argv = process.argv

  /**
   * The worker thread ID from `node:worker_threads` `threadId`.
   *
   * @remarks
   * Useful for logging or indexing worker state.
   */
  id = threadId

  /**
   * The process ID. Same as `process.pid`.
   *
   * @remarks
   * Shared across worker threads in the same process.
   */
  pid = process.pid

  /**
   * RPC handler for method invocations.
   *
   * @remarks
   * Uses {@link WorkerThreadRpc} for dispatching requests.
   */
  rpc: WorkerThreadRpc = {} as any

  /**
   * Reference to the parent port for messaging from `node:worker_threads`.
   *
   * @remarks
   * Uses `parentPort` to send and receive messages.
   */
  parentPort = parentPort

  /**
   * Gateway server instance if created.
   *
   * @remarks
   * Uses {@link WorkerThreadGatewayServer} for IPC server routing.
   */
  gatewayServer?: WorkerThreadGatewayServer

  /**
   * Map of gateway clients for inter-worker communication.
   *
   * @remarks
   * Values are {@link WorkerThreadGatewayClient} instances keyed by server path.
   */
  gatewayClients = new Map<string, WorkerThreadGatewayClient>()

  /**
   * The most recently created gateway client.
   *
   * @remarks
   * Uses {@link WorkerThreadGatewayClient} for IPC requests.
   */
  gatewayClientLatest?: WorkerThreadGatewayClient

  /**
   * Path for gateway server. Override in subclass if needed.
   *
   * @remarks
   * Used by {@link WorkerThreadGatewayServer} when binding.
   * @virtual
   */
  static gatewayServerPath?: string

  /**
   * Instance accessor for gateway server path from static property.
   *
   * @remarks
   * Reads from `this.constructor.gatewayServerPath`.
   */
  gatewayServerPath = (this.constructor as any).gatewayServerPath

  /**
   * Get the most recently created gateway client.
   *
   * @remarks
   * Alias for {@link WorkerThreadInit.gatewayClientLatest}.
   */
  get gatewayClient() {
    return this.gatewayClientLatest
  }

  /**
   * Check if currently running in the main thread.
   * Re-exported from `node:worker_threads`.
   *
   * @remarks
   * Use `node:worker_threads:isMainThread` to branch between main and worker logic.
   */
  static isMainThread = isMainThread

  /**
   * Creates a new WorkerThreadInit instance.
   * Sets up message handling and signals readiness to the main thread.
   */
  constructor() {
    this.init()
    this.rpc = new WorkerThreadRpc(this.send.bind(this), this)
    this.send({method: `readyResolve`})
  }

  /**
   * [LOW-LEVEL] Initialize message handling from parent port and register event message from parent.
   * @public
   */
  init() {
    this.parentPort?.on(`message`, (data) => this.handleOnMessage(data))
  }

  /**
   * [LOW-LEVEL] Handle incoming messages from the main thread.
   *
   * @param data - Message data from main thread.
   * @public
   */
  handleOnMessage(data: any) {
    this.rpc.make(data)
  }

  /**
   * Send a message to the main thread.
   *
   * @param payload - Data to send. Payload to main thread.
   *
   * @example
   * ```typescript
   * this.send({ status: "processing", progress: 50 });
   * ```
   * @public
   */
  send(payload: any) {
    this.parentPort?.postMessage(payload)
  }

  /**
   * Make an RPC request to the main thread.
   *
   * @param method - Method name to call. Targets main-thread RPC method.
   * @param params - Method parameters. Sent as positional array.
   * @param _wait - Wait for response. If false, fire-and-forget. Defaults to `true`.
   * @param _others - Additional RPC data. Merged into RPC payload.
   * @returns Promise resolving with main-thread response.
   *
   * @example
   * ```typescript
   * const result = await this.request("getConfig", ["key"]);
   * ```
   * @public
   */
  request(method: string, params: any, _wait = true, _others?: any) {
    return this.rpc.makeRequest(method, params, _wait, _others)
  }

  /**
   * Create a gateway server for inter-worker communication.
   *
   * @param register - Object with value function to expose. Called by gateway clients. Defaults to `this`.
   * @param path - Unix socket path. Gateway identifier. Defaults to `this.constructor.gatewayServerPath`.
   * @returns Promise that resolves to `true` when gateway is ready.
   *
   * @example
   * ```typescript
   * // Recommended - uses default `this` and static gatewayServerPath
   * await this.createGatewayServer();
   *
   * // Custom object and path
   * await this.createGatewayServer(
   *   { ping: () => "pong" },
   *   "/tmp/my-worker.sock"
   * );
   * ```
   * @public
   */
  async createGatewayServer(register?: any, path?: string) {
    if (!register) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      register = this
    }
    if (!path) {
      path = (this.constructor as any).gatewayServerPath
    }
    this.gatewayServer = new WorkerThreadGatewayServer()
    await this.gatewayServer.start(path!, register)
    ;(this.constructor as any).gatewayServerPath = path
    return true
  }

  /**
   * [LOW-LEVEL] Create a gateway client to connect to another worker.
   *
   * @remarks
   * Low-level API. Use `launchGatewayClient` from `WorkerThreadExport` instead.
   *
   * @param serverPath - Unix socket path to connect. Matches server gateway.
   * @returns Promise resolving with connected client.
   *
   * @example
   * ```typescript
   * const client = await this.createGatewayClient("/tmp/other-worker.sock");
   * const result = await client.request("ping", []);
   * ```
   * @public
   */
  async createGatewayClient(serverPath: string) {
    const client = new WorkerThreadGatewayClient()
    await client.connect(serverPath)
    this.gatewayClients.set(serverPath, client)
    this.gatewayClientLatest = client
    return client
  }
}
