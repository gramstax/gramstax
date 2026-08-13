/**
 * IPC gateway client — connects to a remote worker's Unix socket server.
 *
 * @remarks
 * [LOW-LEVEL] Provides IPC client functionality for inter-worker
 * communication using Unix domain sockets (named pipes on Windows).
 * Created internally by {@link WorkerThreadInit.createGatewayClient}.
 *
 * @public
 */

import {EventEmitter} from "node:events"
import {Client} from "net-ipc"
import {reportError} from "./error-handler"
import {normalizeGatewayPath} from "./gateway-path"
import {WorkerThreadRpc, DEFAULT_MAX_MESSAGE_SIZE} from "./rpc"

/**
 * Options for connecting a gateway client.
 *
 * @remarks
 * Reconnect is enabled by default: when the connection drops (e.g. the
 * gateway server worker restarts), the client retries with exponential
 * backoff and pending requests are retried transparently.
 * @public
 */
export type GatewayClientOptions = {
  /** Shared secret matching the server's `token`. Sent during the connection handshake. */
  token?: string
  /** Automatically reconnect when the connection drops. Defaults to `true`. */
  reconnect?: boolean
  /** Maximum number of reconnect attempts before giving up. */
  retries?: number
  /** Upper bound (ms) for the exponential reconnect backoff. */
  maxRetryTime?: number
  /** Estimated maximum size in bytes of a single incoming message. Defaults to {@link DEFAULT_MAX_MESSAGE_SIZE}. */
  maxMessageSize?: number
  /** Use msgpackr binary encoding — preserves `Date`, `BigInt`, `undefined` and typed arrays. */
  messagepack?: boolean
}

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
export class WorkerThreadGatewayClient extends EventEmitter {
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

  private closed = false

  /** Raw connection that already has our error-routing listener attached. */
  private guardedConnection: unknown = null

  /**
   * Creates a new gateway client instance.
   *
   * @remarks
   * Typically not called directly; use {@link WorkerThreadInit.createGatewayClient} instead.
   */
  constructor() {
    super()
    this.rpc = new WorkerThreadRpc((data) => {
      // Never touch the raw socket while the transport is closing — net-ipc
      // can emit an unhandled 'error' on the dying socket, which kills the
      // worker process.
      if (this.closed) {
        return Promise.reject(new Error(`gateway client is closed`))
      }
      // net-ipc resolves send failures with an Error object instead of
      // rejecting — surface it as a rejection so the request fails fast
      // instead of waiting forever for a response
      return Promise.resolve(this.client.send(data)).then((sent) => {
        if ((sent as unknown as object) instanceof Error) throw sent
        return sent
      })
    }, {})

    this.client.on(`message`, (data: Parameters<WorkerThreadRpc[`make`]>[0]) => {
      this.rpc.make(data).catch((err: unknown) => this.safeEmitError(err))
    })

    // Route raw socket errors through the default handler. net-ipc attaches
    // its own 'error' listener one line after socket creation, which can miss
    // a synchronous connect-phase error (e.g. ENOENT dead pipe on some
    // runtimes) — that error would surface as unhandled. Wrap the instance
    // connect so the raw socket is guarded the moment it exists, for every
    // connect attempt (including net-ipc's internal reconnects).
    const rawConnect = this.client.connect.bind(this.client)
    this.client.connect = (payload?: unknown) => {
      const result = rawConnect(payload)
      const conn = this.client.connection
      if (conn && conn !== this.guardedConnection) {
        this.guardedConnection = conn
        conn.on(`error`, (err: unknown) => this.safeEmitError(err))
      }
      return result
    }

    this.client.on(`status`, (status: number) => {
      this.emit(`status`, status)
      // Keep a no-op 'error' listener on the raw socket so a write racing the
      // connection close cannot crash the process (net-ipc removes its own
      // listeners on close).
      if (status === 2 || status === 3) {
        this.client.connection?.on(`error`, () => {})
      }
    })

    this.client.on(`close`, (reason: unknown) => {
      if (!this.closed) {
        this.emit(`close`, reason)
      }
    })
  }

  /**
   * Emit an `error` event without risking an uncaught throw.
   *
   * @remarks
   * Node's `EventEmitter` throws when `error` is emitted with no listeners.
   * With listeners, the error is emitted; without, it is routed to the
   * package-wide handler set via `setDefaultErrorHandler` (silent by
   * default — library code never writes to the console).
   *
   * @param err - The error to emit (or report).
   */
  private safeEmitError(err: unknown) {
    if (this.listenerCount(`error`) > 0) {
      this.emit(`error`, err)
    } else {
      reportError(err)
    }
  }

  /**
   * Connect to a gateway server.
   *
   * @param path - Unix socket path. Matches server gateway.
   * @param options - Connection options (auth token, reconnect tuning, encoding).
   * @returns Promise that resolves to this client instance when connection is ready.
   *
   * @example
   * ```typescript
   * await client.connect("/tmp/worker-server.sock", {
   *   token: "shared-secret",
   *   messagepack: true,
   * });
   * console.log("Connected to gateway server");
   * ```
   * @public
   */
  async connect(path: string, options: GatewayClientOptions = {}) {
    if (this.closed) {
      throw new Error(`gateway client is closed — create a new client to reconnect`)
    }
    if (!path || typeof path !== `string`) {
      throw new Error(`createGatewayClient requires a non-empty socket path`)
    }
    this.client.options.path = normalizeGatewayPath(path)
    this.client.options.reconnect = options.reconnect ?? true
    if (options.retries !== undefined) {
      this.client.options.retries = options.retries
    }
    if (options.maxRetryTime !== undefined) {
      this.client.options.maxRetryTime = options.maxRetryTime
    }
    this.client.options.messagepack = Boolean(options.messagepack)
    this.rpc.maxMessageSize = options.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE
    const payload = options.token !== undefined ? {auth: options.token} : undefined
    return new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup()
        resolve(this)
      }
      const onClose = (reason: unknown) => {
        cleanup()
        reject(new Error(`gateway connection failed: ${String(reason)}`))
      }
      const cleanup = () => {
        this.client.off(`ready`, onReady)
        this.client.off(`close`, onClose)
      }
      this.client.once(`ready`, onReady)
      // net-ipc leaves the connect promise pending forever when reconnect is
      // disabled and the connection fails — settle via the close event instead.
      this.client.once(`close`, onClose)
      this.client.connect(payload).catch((err: unknown) => {
        cleanup()
        // a synchronous connect-phase failure may never reach the raw socket
        // listener above (it fires before the listener can be attached) —
        // route it deterministically so the default handler still sees it
        this.safeEmitError(err instanceof Error ? err : new Error(String(err)))
        reject(err instanceof Error ? err : new Error(String(err)))
      })
    })
  }

  /**
   * Make an RPC request to the server.
   *
   * @param method - Server method to call. Targets server RPC method.
   * @param params - Method parameters. Sent as positional array.
   * @param _wait - Wait for response. If false, fire-and-forget. Defaults to `true`.
   * @param _others - Additional RPC data. Merged into RPC payload.
   * @param timeoutMs - Optional timeout in milliseconds. Rejects the request
   *   when no response arrives in time.
   * @returns Promise resolving with server response.
   *
   * @example
   * ```typescript
   * const result = await client.request("ping", []);
   * console.log("Server responded:", result);
   * ```
   * @public
   */
  async request(method: string, params: unknown[], _wait = true, _others?: Record<string, unknown>, timeoutMs?: number) {
    return this.rpc.makeRequest(method, params, _wait, _others, timeoutMs)
  }

  /**
   * Whether the connection has been closed or destroyed.
   *
   * @remarks
   * A closed client must not be reused — callers should create a new one.
   * @public
   */
  isClosed() {
    return this.closed
  }

  /**
   * Close the connection permanently.
   *
   * @remarks
   * Disables auto-reconnect so the client will not attempt to reconnect.
   * Pending requests are rejected so callers never hang. Tries a graceful
   * close first, but force-destroys the socket if the graceful handshake
   * does not finish within 500ms (e.g. the peer died mid-connect) —
   * `close()` never hangs.
   * @public
   */
  async close() {
    this.closed = true
    this.rpc.rejectAllPending(new Error(`gateway client closed`))
    this.client.options.reconnect = false
    const graceful = this.client.close().catch(() => {})
    await Promise.race([graceful, new Promise((resolve) => setTimeout(resolve, 500))])
    this.client.destroy()
  }

  /**
   * Destroy the connection immediately without a graceful close.
   *
   * @remarks
   * Disables auto-reconnect and rejects pending requests.
   * @public
   */
  destroy() {
    this.closed = true
    this.rpc.rejectAllPending(new Error(`gateway client destroyed`))
    this.client.options.reconnect = false
    this.client.destroy()
  }
}
