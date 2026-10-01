import {timingSafeEqual} from "node:crypto"
import {EventEmitter} from "node:events"
import {unlink} from "node:fs/promises"
import {type Connection, Server} from "net-ipc"
import {reportError} from "./error-handler"
import {normalizeGatewayPath} from "./gateway-path"
import {DEFAULT_MAX_MESSAGE_SIZE, estimatePayloadSize, WorkerThreadRpc} from "./rpc"

/**
 * Options for starting a gateway server.
 *
 * @remarks
 * Auth and method allow-lists are enforced per connection on the server side.
 * @public
 */
export type IGatewayServerOptions = {
  /** Shared secret required from connecting clients (sent via the client `connect` payload). */
  token?: string
  /** Restrict which registered methods may be invoked remotely. */
  allowedMethods?: string[]
  /** Maximum number of concurrent connections. */
  maxConnections?: number
  /** Estimated maximum size in bytes of a single incoming message. Defaults to {@link DEFAULT_MAX_MESSAGE_SIZE}. */
  maxMessageSize?: number
}

/** Maximum inbound responses cached per connection for duplicate suppression. */
const MAX_CACHED_RESPONSES = 1000

/** Responses larger than this are never cached (re-executed on redelivery). */
const MAX_CACHED_RESPONSE_SIZE = 64 * 1024

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
 * ## Reliability semantics (at-least-once)
 *
 * - **Retried delivery, not exactly-once.** The transport (`net-ipc`) retries
 *   failed writes and replays in-flight requests across reconnects, and
 *   callers may retry timed-out requests — so a handler can observe the same
 *   RPC `id` twice. Request ids are monotonically increasing per client and
 *   never reused within a connection lifetime, so the server suppresses
 *   duplicates per connection: the first delivery executes, redeliveries
 *   replay the cached response. Make handlers idempotent anyway — responses
 *   over 64KB are never cached (re-executed on redelivery) and the cache
 *   holds at most 1000 entries per connection (FIFO) and is dropped on
 *   disconnect.
 * - **No ordering across reconnect.** Requests sent before a drop may resolve
 *   after requests sent after the reconnect; never rely on cross-request order.
 * - **`maxMessageSize` is enforced post-buffering, not a wire-level DoS cap.**
 *   The full frame is already buffered by `net-ipc` before the estimate runs —
 *   the cap stops a peer from growing handler memory or the pending map, it
 *   does not stop the bytes crossing the socket (upstream `net-ipc` limitation).
 * - **Allow-list escape hatch.** Middleware that short-circuits (sets
 *   `ctx.result` without calling `next()`) skips every downstream check,
 *   including the `allowedMethods` guard. That is an intentional escape hatch
 *   for trusted in-process customization, not a vulnerability: only code that
 *   already holds the server instance can register such middleware.
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

  private _authToken?: string

  private _allowedMethods?: Set<string>

  /** Estimation cap for a single incoming message; read per-connection when `start` is called. */
  private _maxMessageSize = DEFAULT_MAX_MESSAGE_SIZE

  /** Last bound socket path (normalized); unlinked best-effort on `close`. */
  private _socketPath?: string

  /** In-flight `close()` shared by concurrent/duplicate callers. */
  closePromise: Promise<void> | null = null

  /**
   * Cached responses per connection for at-least-once duplicate suppression.
   *
   * @remarks
   * Outer key is the connection ID, inner key the RPC request `id`. Entries
   * are dropped when the connection disconnects and when the server closes.
   */
  private _seenResponses = new Map<string, Map<number, Record<string, unknown>>>()

  /**
   * Inbound request ids currently executing, per connection.
   *
   * @remarks
   * Closes the dedupe race: the response cache is written on send, so a
   * same-id redelivery arriving *while the first copy still runs* would
   * otherwise execute twice. Duplicates of an in-flight id are dropped —
   * the first execution's response serves the retry (ids are never reused
   * within a connection). Cleared with `seenResponses` on disconnect.
   */
  private _inflightRequests = new Map<string, Set<number>>()

  /**
   * Creates a new gateway server instance.
   *
   * @remarks
   * Typically not called directly; use {@link WorkerThreadInit.createGatewayServer} instead.
   */
  constructor() {
    super()
    this.server.on(`connect`, (connection: Connection, payload?: unknown) => {
      if (!this._isAuthorized(payload)) {
        connection.close(new Error(`unauthorized gateway client`)).catch(() => {
          // intentionally ignored
        })
        return
      }
      const seen = new Map<number, Record<string, unknown>>()
      this._seenResponses.set(connection.id, seen)
      this._inflightRequests.set(connection.id, new Set())
      const rpc = new WorkerThreadRpc(
        (data) => {
          const id = (data as {id?: unknown}).id
          if (typeof id === `number` && estimatePayloadSize(data) <= MAX_CACHED_RESPONSE_SIZE) {
            if (seen.size >= MAX_CACHED_RESPONSES) {
              const oldest = seen.keys().next()
              if (!oldest.done) seen.delete(oldest.value)
            }
            seen.set(id, data as Record<string, unknown>)
          }
          // The request this answers is no longer executing.
          if (typeof id === `number`) this._inflightRequests.get(connection.id)?.delete(id)
          // net-ipc resolves send failures with an Error object instead of
          // rejecting — surface it as a rejection so failures never masquerade
          // as successful sends
          return Promise.resolve(connection.send(data)).then((sent) => {
            if ((sent as unknown as object) instanceof Error) throw sent
            return sent
          })
        },
        this.register,
        {maxMessageSize: this._maxMessageSize}
      )

      if (this._allowedMethods) {
        const allow = this._allowedMethods
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
      this._seenResponses.delete(connection.id)
      this._inflightRequests.delete(connection.id)
      this.emit(`disconnect`, connection, reason)
    })

    this.server.on(`message`, (message: Parameters<WorkerThreadRpc[`make`]>[0], connection: Connection) => {
      const rpc = this.rpc.get(connection.id)
      if (!rpc) {
        return
      }
      // at-least-once redelivery: replay the cached response without
      // re-executing the handler (ids are never reused within a connection)
      if (typeof message.id === `number` && message.method !== undefined) {
        const cached = this._seenResponses.get(connection.id)?.get(message.id)
        if (cached) {
          try {
            const replayed = rpc.send(cached) as Promise<unknown> | unknown
            if (replayed && typeof (replayed as Promise<unknown>).then === `function`) {
              ;(replayed as Promise<unknown>).catch(() => {
                // intentionally ignored
              })
            }
          } catch {
            // intentionally ignored
          }
          return
        }
        // Same id still executing: a retry arrived before the first copy
        // responded. Drop it — the first response serves both deliveries.
        const flying = this._inflightRequests.get(connection.id)
        if (flying?.has(message.id)) return
        flying?.add(message.id)
      }
      rpc.make(message).catch((err: unknown) => {
        this._safeEmitError(err)
      })
    })

    this.server.on(`error`, (err: unknown) => {
      this._safeEmitError(err)
    })
  }

  /**
   * Check the connection payload against the configured auth token.
   *
   * @remarks
   * The token is compared only for presence (`!== undefined`): an explicitly
   * empty token still enforces auth, it never disables it. Comparison uses
   * `crypto.timingSafeEqual`; a length mismatch rejects without comparing.
   *
   * @param payload - The client `connect` payload (`{auth}` when a token was sent).
   * @returns Whether the connection may proceed.
   */
  private _isAuthorized(payload?: unknown): boolean {
    if (this._authToken === undefined) {
      return true
    }
    const presented = (payload as {auth?: unknown} | undefined)?.auth
    if (typeof presented !== `string`) {
      return false
    }
    const expected = Buffer.from(this._authToken, `utf8`)
    const actual = Buffer.from(presented, `utf8`)
    if (actual.length !== expected.length) {
      return false
    }
    return timingSafeEqual(actual, expected)
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
  private _safeEmitError(err: unknown) {
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
  async start(path: string, register?: Record<string, (...args: never[]) => unknown>, options?: IGatewayServerOptions) {
    if (!path || typeof path !== `string`) {
      throw new Error(`createGatewayServer requires a non-empty socket path`)
    }
    if (register !== undefined) {
      this.register = register
    }
    if (options?.maxConnections !== undefined) {
      this.server.options.max = options.maxConnections
    }
    const normalized = normalizeGatewayPath(path)
    this.server.options.path = normalized
    let resolveReady!: (value: this) => void
    const ready = new Promise<this>((resolve) => {
      resolveReady = resolve
    })
    const onReady = () => {
      this.emit(`ready`, this.server.options.path)
      resolveReady(this)
    }
    this.server.once(`ready`, onReady)
    try {
      await this.server.start()
    } catch (err) {
      this.server.off(`ready`, onReady)
      throw err
    }
    // assign auth/size config only after the bind succeeds — a failed start
    // (e.g. EADDRINUSE) must not leave a half-configured instance behind
    this._authToken = options?.token
    // an explicitly empty allow-list denies everything; only omitting the
    // option leaves the register fully callable
    this._allowedMethods = options && Array.isArray(options.allowedMethods) ? new Set(options.allowedMethods) : undefined
    this._maxMessageSize = options?.maxMessageSize ?? DEFAULT_MAX_MESSAGE_SIZE
    this._socketPath = normalized
    return ready
  }

  /**
   * Stop the gateway server and drop all connections.
   *
   * @remarks
   * The socket is released so another server (or a restart of this one) can
   * bind the same path. Tries a graceful close first, but force-destroys
   * connections if the graceful handshake does not finish within 500ms —
   * `close()` never hangs. The socket file is unlinked best-effort (a missing
   * file is ignored) and calling `close()` twice is safe.
   * @public
   */
  async close() {
    if (this.closePromise) {
      return this.closePromise
    }
    this.closePromise = this._doClose()
    try {
      await this.closePromise
    } finally {
      this.closePromise = null
    }
  }

  /**
   * Single close pass shared by duplicate `close()` callers.
   */
  private async _doClose() {
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
    this._seenResponses.clear()
    const bound = this._socketPath
    this._socketPath = undefined
    if (bound !== undefined && process.platform !== `win32` && !bound.startsWith(`\\\\.\\pipe\\`)) {
      await unlink(bound).catch(() => {
        // best-effort cleanup: ENOENT (already gone) and any other fs error
        // are intentionally ignored — the bind is already released
      })
    }
  }
}
