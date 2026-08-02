/**
 * IPC gateway server — listens on a Unix socket for remote RPC requests.
 *
 * @remarks
 * [LOW-LEVEL] Provides IPC server functionality for inter-worker
 * communication using Unix domain sockets (named pipes on Windows).
 * Created internally by {@link WorkerThreadInit.createGatewayServer}.
 *
 * @public
 */

import {EventEmitter} from "node:events"
import {type Connection, Server} from "net-ipc"
import {reportError} from "./error-handler"
import {normalizeGatewayPath} from "./gateway-path"
import {WorkerThreadRpc} from "./rpc"

/**
 * Options for starting a gateway server.
 *
 * @remarks
 * Auth and method allow-lists are enforced per connection on the server side.
 * @public
 */
export type GatewayServerOptions = {
  /** Shared secret required from connecting clients (sent via the client `connect` payload). */
  token?: string
  /** Restrict which registered methods may be invoked remotely. */
  allowedMethods?: string[]
  /** Maximum number of concurrent connections. */
  maxConnections?: number
}

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
 * Supports connections from multiple gateway clients. Emits `connect`,
 * `disconnect`, `ready` and `error` events.
 *
 * @public
 */
export class WorkerThreadGatewayServer extends EventEmitter {
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
   * Properties become RPC-callable methods. When `allowedMethods` is set,
   * method access is restricted per request via RPC middleware — the
   * register itself is never wrapped, so registered methods keep reading
   * their own instance state through `this`.
   */
  register: Record<string, (...args: never[]) => unknown> = {}

  private authToken?: string

  private allowedMethods?: Set<string>

  /**
   * Creates a new gateway server instance.
   *
   * @remarks
   * Typically not called directly; use {@link WorkerThreadInit.createGatewayServer} instead.
   */
  constructor() {
    super()
    this.server.on(`connect`, (connection: Connection, payload?: unknown) => {
      if (this.authToken && (payload as {auth?: string} | undefined)?.auth !== this.authToken) {
        connection.close(new Error(`unauthorized gateway client`)).catch(() => {
          // intentionally ignored
        })
        return
      }
      const rpc = new WorkerThreadRpc((data) => {
        return connection.send(data)
      }, this.register)

      if (this.allowedMethods) {
        const allow = this.allowedMethods
        rpc.use(async (ctx, next) => {
          if (!allow.has(ctx.method)) {
            throw new Error(`Method '${ctx.method}' is not allowed on this gateway`)
          }
          await next()
        })
      }

      this.rpc.set(connection.id, rpc)
      this.emit(`connect`, connection)
    })

    this.server.on(`disconnect`, (connection: Connection, reason?: unknown) => {
      this.rpc.delete(connection.id)
      this.emit(`disconnect`, connection, reason)
    })

    this.server.on(`message`, (message: Parameters<WorkerThreadRpc[`make`]>[0], connection: Connection) => {
      const rpc = this.rpc.get(connection.id)
      if (rpc) {
        rpc.make(message).catch((err: unknown) => {
          this.safeEmitError(err)
        })
      }
    })

    this.server.on(`error`, (err: unknown) => {
      this.safeEmitError(err)
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
   * Start the gateway server.
   *
   * @param path - Unix socket path to bind. Gateway path identifier.
   * @param register - Object to expose to clients. Called by connected clients. Defaults to `{}`.
   * @param options - Server options (auth token, method allow-list, connection cap).
   * @returns Promise that resolves to this server instance when ready.
   *
   * @example
   * ```typescript
   * await server.start("/tmp/data-worker.sock", {
   *   ping: () => "pong",
   *   getData: (key) => database.get(key),
   *   setData: (key, value) => database.set(key, value),
   * }, {
   *   token: "shared-secret",
   *   allowedMethods: ["ping", "getData"],
   * });
   * console.log("Gateway server started");
   * ```
   * @public
   */
  async start(path: string, register?: Record<string, (...args: never[]) => unknown>, options?: GatewayServerOptions) {
    if (!path || typeof path !== `string`) {
      throw new Error(`createGatewayServer requires a non-empty socket path`)
    }
    if (register !== undefined) {
      this.register = register
    }
    this.authToken = options?.token
    this.allowedMethods = options?.allowedMethods && options.allowedMethods.length > 0 ? new Set(options.allowedMethods) : undefined
    if (options?.maxConnections !== undefined) {
      this.server.options.max = options.maxConnections
    }
    this.server.options.path = normalizeGatewayPath(path)
    const p = new Promise((resolve) => {
      this.server.once(`ready`, () => {
        this.emit(`ready`, this.server.options.path)
        resolve(this)
      })
    })
    await this.server.start()
    return p
  }

  /**
   * Stop the gateway server and drop all connections.
   *
   * @remarks
   * The socket is released so another server (or a restart of this one) can
   * bind the same path. Tries a graceful close first, but force-destroys
   * connections if the graceful handshake does not finish within 500ms —
   * `close()` never hangs.
   * @public
   */
  async close() {
    const graceful = this.server.close().catch(() => {})
    await Promise.race([graceful, new Promise((resolve) => setTimeout(resolve, 500))])
    // wait until the listening socket is fully released so the same instance
    // can be restarted immediately (net-ipc does not await the net server close)
    const raw = this.server.server
    if (raw) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 500)
        raw.once(`close`, () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
    for (const connection of this.server.connections) {
      connection.destroy()
    }
    this.rpc.clear()
  }
}
