import {isMainThread, parentPort, threadId} from "node:worker_threads"
import {WorkerThreadErrorHandler} from "./error-handler"
import {WorkerThreadGatewayClient} from "./gateway-client"
import {WorkerThreadGatewayServer} from "./gateway-server"
import {WorkerThreadRpc} from "./rpc"
import type {IGatewayClientOptions} from "./types/gateway-client"
import type {IGatewayServerOptions} from "./types/gateway-server"

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
 * import { WorkerThreadInit, WorkerThreadExport } from "@gramstax/worker-thread";
 *
 * class Worker extends WorkerThreadInit {
 *   constructor() {
 *     super(); // Required - signals ready to main thread
  *     console.info(`Worker ${this.id} started`);
 *   }
 *
  *   mtdProcess(data: unknown) {
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
  /** Guards {@link WorkerThreadInit.init} against duplicate listeners. */
  _initDone = false

  /** Parent port {@link WorkerThreadInit.init} last attached to. */
  _initPort: unknown = undefined

  /** Guards {@link WorkerThreadInit.shutdown} so the hook runs at most once. */
  _shutdownDone = false

  /**
   * Check if currently running in the main thread.
   * Re-exported from `node:worker_threads`.
   *
   * @remarks
   * Use `node:worker_threads:isMainThread` to branch between main and worker logic.
   */
  static isMainThread = isMainThread

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
  rpc: WorkerThreadRpc = {} as unknown as WorkerThreadRpc

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
   * Hook called before the worker is shut down gracefully.
   *
   * @remarks
   * Invoked by {@link WorkerThreadInit.shutdown} (called via RPC from
   * `WorkerThreadLaunch.shutdown`). Override to flush state, close
   * connections, or persist data. The worker is terminated by the main
   * thread after this hook completes.
   */
  onBeforeExit(): void | Promise<void> {}

  /**
   * Hook called when an unhandled error occurs inside the worker's RPC handling.
   *
   * @remarks
   * Default implementation forwards to {@link WorkerThreadErrorHandler.report} — silent by
   * default (the package-wide handler is a no-op) but observable via
   * `WorkerThreadErrorHandler.setDefault`. Override contract: replace this method to
   * customize handling (e.g. log); call `super.onError(err)` (or
   * `WorkerThreadErrorHandler.report(err)` directly) inside the override to preserve
   * package-wide observability.
   */
  onError(err: unknown): void {
    WorkerThreadErrorHandler.report(err)
  }

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
   * Creates a new WorkerThreadInit instance.
   * Sets up message handling and signals readiness to the main thread.
   *
   * @remarks
   * The `readyResolve` signal is deferred with `queueMicrotask` so that
   * subclass field initializers (which run after `super()` returns) are
   * already applied before main-thread RPCs can observe worker state.
   */
  constructor() {
    this.init()
    this.rpc = new WorkerThreadRpc(this.send.bind(this), this as unknown as Record<string, (...args: never[]) => unknown>)
    queueMicrotask(() => {
      this.send({method: `readyResolve`})
    })
  }

  /**
   * [LOW-LEVEL] Initialize message handling from parent port and register event message from parent.
   * @public
   */
  init() {
    if (this._initDone && this._initPort === this.parentPort) {
      return
    }
    this._initDone = true
    this._initPort = this.parentPort
    this.parentPort?.on(`message`, (data) => this.handleOnMessage(data))
  }

  /**
   * [LOW-LEVEL] Handle incoming messages from the main thread.
   *
   * @param data - Message data from main thread.
   * @public
   */
  handleOnMessage(data: Parameters<WorkerThreadRpc[`make`]>[0]) {
    this.rpc.make(data).catch((err: unknown) => {
      this.onError(err)
    })
  }

  /**
   * Send a message to the main thread.
   *
   * @param payload - Data to send. Payload to main thread.
   * @returns `true` when the message was posted, `false` when there is
   *   no parent port (e.g. running on the main thread) and the payload
   *   was dropped.
   *
   * @example
   * ```typescript
   * this.send({ status: "processing", progress: 50 });
   * ```
   * @public
   */
  send(payload: Record<string, unknown>): boolean {
    if (this.parentPort === null || this.parentPort === undefined) {
      return false
    }
    this.parentPort.postMessage(payload)
    return true
  }

  /**
   * Make an RPC request to the main thread.
   *
   * @param method - Method name to call. Targets main-thread RPC method.
   * @param params - Method parameters. Sent as positional array.
   * @param _wait - Wait for response. If false, fire-and-forget. Defaults to `true`.
   * @param _others - Additional RPC data. Merged into RPC payload.
   * @param timeoutMs - Optional timeout in milliseconds. Rejects the request
   *   when the main thread does not respond in time.
   * @returns Promise resolving with main-thread response.
   *
   * @example
   * ```typescript
   * const result = await this.request("getConfig", ["key"]);
   * ```
   * @public
   */
  request(method: string, params: unknown[], _wait = true, _others?: Record<string, unknown>, timeoutMs?: number) {
    return this.rpc.makeRequest(method, params, _wait, _others, timeoutMs)
  }

  /**
   * Create a gateway server for inter-worker communication.
   *
   * @param path - Unix socket path. Gateway identifier. Must be unique per server worker.
   * @param register - Object with value function to expose. Called by gateway clients. Defaults to `this`.
   * @param options - Gateway server options (auth token, method allow-list, connection cap).
   * @returns Promise that resolves to `true` when gateway is ready.
   *
   * @remarks
   * **Security:** when `register` is omitted the server exposes the entire
   * worker instance (`this`) to every socket client, so a non-empty
   * `allowedMethods` list is **required** in that case — otherwise the call
   * throws instead of silently opening every `mtd*` method to any process
   * that can reach the socket. Supply an explicit `register` object, a
   * non-empty `allowedMethods`, or both.
   *
   * @example
   * ```typescript
   * // Custom object and path (explicit register — no allow-list needed)
   * await this.createGatewayServer(
   *   "/tmp/my-worker.sock",
   *   { ping: () => "pong" }
   * );
   *
   * // Expose `this` at the given path — allowedMethods is mandatory here
   * await this.createGatewayServer("/tmp/my-worker.sock", undefined, {
   *   allowedMethods: ["mtdPing"],
   * });
   * ```
   * @public
   */
  async createGatewayServer(path: string, register?: Record<string, (...args: never[]) => unknown>, options?: IGatewayServerOptions) {
    if (this.gatewayServer) {
      // replace (and close) any previous server so its socket is never leaked
      await this.gatewayServer.close()
    }
    // register defaults to this — refusing to expose the whole instance without an allow-list
    if (register === undefined && !(options?.allowedMethods && options.allowedMethods.length > 0)) {
      throw new Error(`createGatewayServer requires a non-empty 'allowedMethods' list when 'register' is omitted (the worker instance would be exposed to every socket client)`)
    }
    const reg = register ?? (this as unknown as Record<string, (...args: never[]) => unknown>)
    this.gatewayServer = new WorkerThreadGatewayServer()
    await this.gatewayServer.start(path, reg, options)
    return true
  }

  /**
   * [LOW-LEVEL] Create a gateway client to connect to another worker.
   *
   * @remarks
   * Low-level API. Use `launchGatewayClient` from `WorkerThreadExport` instead.
   *
   * @param serverPath - Unix socket path to connect. Matches server gateway.
   * @param options - Connection options (auth token, reconnect tuning, encoding).
   * @returns Promise resolving with connected client.
   *
   * @example
   * ```typescript
   * const client = await this.createGatewayClient("/tmp/other-worker.sock");
   * const result = await client.request("ping", []);
   * ```
   * @public
   */
  async createGatewayClient(serverPath: string, options?: IGatewayClientOptions) {
    // replace (and close) any previous client for the same path so sockets
    // are never leaked
    const existing = this.gatewayClients.get(serverPath)
    if (existing && !existing.isClosed()) {
      await existing.close()
    }
    const client = new WorkerThreadGatewayClient()
    await client.connect(serverPath, options)
    this.gatewayClients.set(serverPath, client)
    this.gatewayClientLatest = client
    return client
  }

  /**
   * Graceful shutdown handler, callable via RPC from the main thread.
   *
   * @remarks
   * Runs the {@link WorkerThreadInit.onBeforeExit} hook (flush state, close
   * connections, persist data), then closes gateway resources so no socket
   * or reconnect timer keeps the worker alive. The main thread terminates
   * the worker after this resolves. Override to customize, or just set
   * `onBeforeExit`.
   *
   * Gateway cleanup runs in a `finally` block, so it ALWAYS executes even
   * when `onBeforeExit` throws (the hook error still propagates to the
   * caller). The hook runs at most once — a second `shutdown()` call
   * returns `true` immediately. After cleanup the gateway registry is
   * cleared (`gatewayClients` emptied, `gatewayServer` and
   * `gatewayClientLatest` reset to `undefined`) so no closed handle is
   * reused.
   *
   * @returns Promise resolving to `true` when shutdown is complete.
   * @public
   */
  async shutdown() {
    if (this._shutdownDone) {
      return true
    }
    this._shutdownDone = true
    try {
      await this.onBeforeExit()
    } finally {
      try {
        await this.gatewayServer?.close()
        for (const client of this.gatewayClients.values()) {
          await client.close()
        }
      } finally {
        this.gatewayClients.clear()
        this.gatewayServer = undefined
        this.gatewayClientLatest = undefined
      }
    }
    return true
  }
}
