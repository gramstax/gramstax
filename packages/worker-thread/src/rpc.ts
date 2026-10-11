/**
 * RPC handler for worker-thread request/response.
 *
 * @remarks
 * Defines the low-level {@link WorkerThreadRpc} handler that decodes incoming
 * messages, dispatches to the matching `mtd*` method, and returns the result
 * or error to the caller thread. The RPC types live in `./types/rpc`.
 *
 * @public
 */

import {WorkerThreadErrorHandler} from "./error-handler"
import type {IMapRpc, IRpcContext, IRpcMiddleware} from "./types/rpc"

/**
 * Default cap on the estimated in-memory size of a single RPC message
 * received over the gateway. Prevents an oversized (or maliciously framed)
 * payload from exhausting worker memory. The parentPort channel is trusted
 * and intentionally not capped.
 * @public
 */
export const DEFAULT_MAX_MESSAGE_SIZE = 10 * 1024 * 1024

/**
 * Default timeout in milliseconds applied to every `makeRequest` call that
 * does not pass an explicit `timeoutMs`. `0` disables the timeout
 * (requests wait indefinitely). Can be overridden per instance via
 * `defaultTimeoutMs` or per call via `timeoutMs`.
 * @public
 */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000

/**
 * Method names that are never remotely callable, even when they resolve
 * to a function on the register object. Covers prototype gadgets
 * (`constructor` would expose the class) and the duplex plumbing
 * (`send`/`request`/`kill`/gateway factories are outgoing-only APIs —
 * `shutdown` and `readyResolve` stay allowed: they are the legitimate
 * inbound lifecycle methods).
 * @public
 */
export const DENIED_RPC_METHODS: ReadonlySet<string> = new Set([`__proto__`, `constructor`, `prototype`, `send`, `request`, `kill`, `init`, `handleOnMessage`, `createGatewayServer`, `createGatewayClient`])

/**
 * [LOW-LEVEL] Handles JSON-RPC style communication between threads.
 *
 * @remarks
 * Low-level internal infrastructure. Used by {@link WorkerThreadInit} and
 * {@link WorkerThreadLaunch} under the hood — you rarely need to touch it.
 *
 * Uses simple JSON-RPC style messages with `id`, `method`, `params`, `result`, `error`.
 *
 * @public
 */
export class WorkerThreadRpc {
  /** Ordered middleware chain for inbound RPC messages. Mutated by `use()`, run in registration order by `_runMiddleware`. @internal */
  private _middlewares: IRpcMiddleware[] = []

  /** @internal Counter for unique ID generation (avoids Math.random determinism). */
  private _nextId = 1

  /**
   * Send an envelope, routing transport failures to the package error
   * handler instead of dropping them silently.
   *
   * @internal
   */
  private _sendEnvelope(envelope: Record<string, unknown>): void {
    try {
      const p = this.send(envelope)
      if (p && typeof (p as Promise<unknown>).then === `function`) {
        ;(p as Promise<unknown>).catch((err: unknown) => {
          WorkerThreadErrorHandler.report(err instanceof Error ? err : new Error(String(err)))
        })
      }
    } catch (err) {
      WorkerThreadErrorHandler.report(err instanceof Error ? err : new Error(String(err)))
    }
  }

  /**
   * Resolve or reject the pending request matching a response envelope.
   *
   * @remarks
   * Discrimination is by key presence (`in`), not by value: a msgpack
   * `undefined` result still carries the `result` key and must resolve.
   * Non-number ids are reported and ignored instead of silently dropped.
   *
   * @internal
   */
  private _handleResponse(data: {id?: number; result?: unknown; error?: unknown}): void {
    const {id} = data
    if (typeof id !== `number`) {
      WorkerThreadErrorHandler.report(new Error(`Invalid RPC response id: expected number, got ${typeof id}`))
      return
    }
    const pending = this.map.get(id)
    if (!pending) return
    if (pending.timer) clearTimeout(pending.timer)
    this.map.delete(id)
    if (`result` in data) pending.resolve(data.result)
    else if (`error` in data) pending.reject(data.error)
  }

  /**
   * Run the middleware chain, then dispatch the method.
   *
   * @param ctx - Mutable request context shared through the chain.
   * @param index - Current middleware index.
   */
  private async _runMiddleware(ctx: IRpcContext, index: number): Promise<void> {
    if (index >= this._middlewares.length) {
      const func = this.register[ctx.method]
      // Accept own properties AND class-prototype methods (gateway registers
      // worker *instances*, whose mtd* methods live on the prototype), but
      // never Object.prototype members (`toString`, `hasOwnProperty`, ...) or
      // the dangerous names below (`constructor` would expose the class).
      const fromObjectProto = !Object.hasOwn(this.register, ctx.method) && Object.hasOwn(Object.prototype, ctx.method)
      if (typeof func !== `function` || DENIED_RPC_METHODS.has(ctx.method) || fromObjectProto) {
        throw new Error(`Method ${ctx.method} not found or not function`)
      }
      ctx.result = await (func as (...args: unknown[]) => unknown).apply(this.register, ctx.params)
      return
    }
    const middleware = this._middlewares[index]!
    let nextCalled = false
    await middleware(ctx, async () => {
      if (nextCalled) throw new Error(`next() called multiple times`)
      nextCalled = true
      await this._runMiddleware(ctx, index + 1)
    })
  }

  /**
   * Estimate the in-memory footprint of a structured value.
   *
   * @remarks
   * Recursive walker that counts strings, numbers, buffer bytes and keys with
   * bounded double-count-avoidance. It deliberately does not serialize
   * (`JSON.stringify` throws on `BigInt`, which messagepack payloads can
   * contain), so we approximate the size the value occupies after decode.
   *
   * Static because it depends on no instance state — the gateway server uses
   * it to decide whether a response is worth caching for duplicate suppression.
   *
   * @param value - The decoded value to measure.
   * @returns Estimated size in bytes.
   *
   * @public
   */
  static estimatePayloadSize(value: unknown): number {
    const seen = new Set<unknown>()
    let size = 0
    const walk = (v: unknown): void => {
      if (v === null || v === undefined || typeof v === `boolean`) return
      if (typeof v === `number` || typeof v === `bigint`) {
        size += 8
        return
      }
      if (typeof v === `string`) {
        size += v.length * 2
        return
      }
      if (typeof v === `symbol` || typeof v === `function`) return
      if (v instanceof Date) {
        size += 8
        return
      }
      if (v instanceof ArrayBuffer || (typeof ArrayBuffer !== `undefined` && ArrayBuffer.isView(v))) {
        size += v.byteLength
        return
      }
      if (v instanceof Map) {
        for (const [key, val] of v) {
          walk(key)
          walk(val)
        }
        return
      }
      if (v instanceof Set) {
        for (const item of v) walk(item)
        return
      }
      if (typeof v !== `object` || seen.has(v)) return
      seen.add(v)
      if (Array.isArray(v)) {
        for (const item of v) walk(item)
        return
      }
      const record = v as Record<string, unknown>
      for (const key of Object.keys(record)) {
        size += key.length * 2
        walk(record[key])
      }
    }
    walk(value)
    return size
  }

  /**
   * Validate a timeout value. `0` means no timeout; anything else must be
   * a non-negative finite number.
   *
   * @internal
   */
  static assertTimeout(value: unknown, name: string): void {
    if (typeof value !== `number` || !Number.isFinite(value) || value < 0) {
      throw new TypeError(`Invalid RPC ${name}: expected non-negative finite number, got ${String(value)}`)
    }
  }

  /**
   * Map of pending requests by ID. Stores promise handlers for pending requests.
   *
   * @remarks
   * Uses {@link IMapRpc} for the map value shape.
   */
  map = new Map() as IMapRpc

  /**
   * Default context merged into every outgoing RPC payload.
   *
   * @remarks
   * Useful for propagating correlation data (e.g. `traceId`) across threads:
   * set it once and it is included in every `makeRequest` payload. Per-call
   * `others` values take precedence over this context.
   * @public
   */
  context: Record<string, unknown> = {}

  /**
   * Enforced cap on the estimated size of incoming messages. `undefined`
   * disables the limit (the default for the trusted parentPort channel).
   * @public
   */
  maxMessageSize?: number

  /**
   * Default timeout in milliseconds for `makeRequest` calls that omit
   * `timeoutMs`. Initialized from `DEFAULT_REQUEST_TIMEOUT_MS`; assign `0`
   * to wait indefinitely. Must stay a non-negative finite number.
   * @public
   */
  defaultTimeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS

  /**
   * Creates a new WorkerThreadRpc instance.
   *
   * @param send - Function to send data. Called with RPC payload.
   * @param register - Object with callable methods. Exposed RPC method map.
   * @param options - Optional settings (message-size cap, default timeout).
   */
  constructor(
    public send: (data: Record<string, unknown>) => unknown,
    public register: Record<string, (...args: never[]) => unknown>,
    options?: {maxMessageSize?: number; defaultTimeoutMs?: number}
  ) {
    this.maxMessageSize = options?.maxMessageSize
    if (options?.defaultTimeoutMs !== undefined) {
      WorkerThreadRpc.assertTimeout(options.defaultTimeoutMs, `defaultTimeoutMs`)
      this.defaultTimeoutMs = options.defaultTimeoutMs
    }
  }

  /**
   * Register middleware for incoming requests.
   *
   * @remarks
   * Middleware runs in registration order before the target method is
   * dispatched. Each middleware receives a mutable {@link IRpcContext} and a
   * `next` function; short-circuit by setting `ctx.result` and skipping
   * `next`, or reject by throwing.
   *
   * @param middlewares - Middleware functions to append to the chain.
   * @returns `this` for chaining.
   *
   * @example
   * ```typescript
   * rpc.use(async (ctx, next) => {
   *   console.log(`calling ${ctx.method}`);
   *   await next();
   * });
   * ```
   * @public
   */
  use(...middlewares: IRpcMiddleware[]) {
    this._middlewares.push(...middlewares)
    return this
  }

  /**
   * Process an incoming RPC message.
   *
   * @remarks
   * Message types:
   * - **Request:** `{ id, method, params }` - Calls registered method and sends result/error back.
   * - **Result:** `{ id, result }` - Resolves pending request promise.
   * - **Error:** `{ id, error }` - Rejects pending request promise.
   *
   * @param data - RPC message object. Shape is request/result/error.
   *
   * @example
   * ```typescript
   * worker.on("message", (data) => {
   *   rpc.make(data);
   * });
   * ```
   * @public
   */
  async make(data: {id?: number; method?: string; params?: unknown[]; result?: unknown; error?: unknown}) {
    if (data === null || typeof data !== `object`) return
    const map = this.map
    const {id, method, params} = data

    // Reject oversized messages before any dispatch or pending-map write —
    // a gateway peer can otherwise exhaust memory or grow the pending map
    // with a single framed message.
    if (this.maxMessageSize !== undefined && WorkerThreadRpc.estimatePayloadSize(data) > this.maxMessageSize) {
      if (method !== undefined) {
        // request-type: answer with a controlled error so the caller
        // rejects instead of hanging on a missing response
        if (id !== undefined) {
          this._sendEnvelope({id, error: {message: `message exceeds maxMessageSize=${this.maxMessageSize}`, name: `Error`}})
        }
      } else if (id !== undefined) {
        // response-type: reject the pending request it belongs to
        const data = map.get(id)
        if (data) {
          if (data.timer) clearTimeout(data.timer)
          data.reject(new Error(`message exceeds maxMessageSize=${this.maxMessageSize}`))
          map.delete(id)
        }
      }
      return
    }

    if (method !== undefined) {
      // A live pending entry plus a result/error key means this envelope is
      // a response that also carries request fields — resolve it instead of
      // dispatching it as a new request.
      if (id !== undefined && map.has(id) && (`result` in data || `error` in data)) {
        this._handleResponse(data)
        return
      }
      // Handle request
      try {
        if (typeof method !== `string`) {
          throw new Error(`Invalid RPC method type: ${typeof method}`)
        }
        if (params !== undefined && !Array.isArray(params)) {
          throw new Error(`Invalid RPC params: expected array, got ${typeof params}`)
        }
        const ctx: IRpcContext = {method, params: params ?? []}
        await this._runMiddleware(ctx, 0)
        // the wire cannot carry `undefined` — send null so the caller resolves
        // instead of hanging on a missing result field
        if (id !== undefined) {
          this._sendEnvelope({id, result: ctx.result === undefined ? null : ctx.result})
        }
      } catch (err: unknown) {
        if (id === undefined) return
        const errPayload = err instanceof Error ? {message: err.message, stack: err.stack, name: err.name} : err
        this._sendEnvelope({id, error: errPayload})
      }
    } else if (id !== undefined) {
      this._handleResponse(data)
    }
  }

  /**
   * Generate a unique request ID.
   *
   * @returns A monotonically increasing number unique within this instance.
   *
   * @example
   * ```typescript
   * const id = rpc.makeId();
   * ```
   * @public
   */
  makeId() {
    return this._nextId++
  }

  /**
   * Create and send an RPC request.
   *
   * @param method - Method name to call. Targets registered method.
   * @param params - Method parameters. Sent as positional array.
   * @param wait - Wait for response. If false, returns send result. Defaults to `true`.
   * @param others - Additional data to include. Merged into RPC payload.
   * @param timeoutMs - Optional timeout in milliseconds. When exceeded, the
   *   pending request is rejected with a timeout error and removed from the
   *   pending map. Defaults to `defaultTimeoutMs`; `0` disables the timeout.
   * @returns Promise resolving to the result if waiting, or send result if not.
   *
   * @example
   * ```typescript
   * // Wait for response
   * const result = await rpc.makeRequest("add", [1, 2]);
   * console.log(result); // 3
   *
   * // Fire and forget
   * rpc.makeRequest("log", ["message"], false);
   *
   * // With timeout
   * await rpc.makeRequest("slow", [], true, undefined, 5000);
   * ```
   * @public
   */
  makeRequest(method: string, params: unknown[], wait: true, others?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
  makeRequest(method: string, params: unknown[], wait?: false, others?: Record<string, unknown>, timeoutMs?: number): unknown
  makeRequest(method: string, params: unknown[], wait: boolean, others?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> | unknown
  makeRequest(method: string, params: unknown[], wait = true, others?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> | unknown {
    if (timeoutMs !== undefined) WorkerThreadRpc.assertTimeout(timeoutMs, `timeoutMs`)
    const id = this.makeId()
    // reserved envelope fields come last so context/others can never corrupt
    // the wire format (id/method/params)
    const pld = others === undefined ? {...this.context, id, method, params} : {...this.context, ...others, id, method, params}
    if (!wait) {
      const sent = this.send(pld)
      if (sent && typeof (sent as Promise<unknown>).then === `function`) {
        ;(sent as Promise<unknown>).catch(() => {
          // intentionally ignored
        })
      }
      return sent
    }

    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs
    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      if (effectiveTimeout !== undefined && effectiveTimeout !== 0) {
        WorkerThreadRpc.assertTimeout(effectiveTimeout, `defaultTimeoutMs`)
        const effective = effectiveTimeout
        timer = setTimeout(() => {
          const entry = this.map.get(id)
          if (entry) {
            this.map.delete(id)
            reject(new Error(`RPC timeout after ${effective}ms: ${method}`))
          }
        }, effective)
        ;(timer as unknown as {unref?: () => void}).unref?.()
      }
      this.map.set(id, {resolve, reject, timer})
      try {
        const sent = this.send(pld)
        if (sent && typeof (sent as Promise<unknown>).then === `function`) {
          ;(sent as Promise<unknown>).catch((reason: unknown) => {
            // a rejected send means the transport refused the message (e.g. the
            // gateway client was closed) — fail the request instead of leaving
            // it pending forever
            const entry = this.map.get(id)
            if (entry) {
              if (entry.timer) clearTimeout(entry.timer)
              this.map.delete(id)
              reject(reason instanceof Error ? reason : new Error(String(reason)))
            }
          })
        }
      } catch (err) {
        // synchronous send failure (e.g. postMessage to a terminated worker) —
        // clean up the pending entry so it cannot leak
        if (timer) clearTimeout(timer)
        this.map.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  /**
   * Reject every pending request.
   *
   * @remarks
   * Used when the transport dies (e.g. worker thread exits) so callers do not
   * hang forever. All pending entries are rejected and removed from the map.
   *
   * @param error - Error to reject pending requests with.
   *
   * @example
   * ```typescript
   * rpc.rejectAllPending(new Error("worker exited"));
   * ```
   * @public
   */
  rejectAllPending(error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    for (const [id, entry] of this.map) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.reject(err)
      this.map.delete(id)
    }
  }
}
