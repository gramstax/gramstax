/**
 * RPC types and handler for worker-thread request/response.
 *
 * @remarks
 * Defines the shared RPC map type and the low-level
 * {@link WorkerThreadRpc} handler that decodes incoming messages,
 * dispatches to the matching `mtd*` method, and returns the result
 * or error to the caller thread.
 *
 * @public
 */

/**
 * Map type for storing pending RPC request handlers.
 * @public
 */
export type ITMapRpc = Map<number, {reject: (error: unknown) => void; resolve: (result: unknown) => void; timer?: ReturnType<typeof setTimeout>}>

/**
 * Context object passed through the RPC middleware chain for incoming requests.
 *
 * @remarks
 * Middleware can mutate `params` before dispatch, short-circuit by setting
 * `result` without calling `next`, or throw to reject the request.
 * @public
 */
export type RpcContext = {
  /** Method name being invoked. */
  method: string
  /** Positional arguments for the method. Mutable by middleware. */
  params: unknown[]
  /** Result produced by the handler (or by short-circuiting middleware). */
  result?: unknown
}

/**
 * Middleware function for intercepting incoming RPC requests.
 *
 * @param ctx - Mutable request context.
 * @param next - Continue to the next middleware / dispatch the method.
 * @public
 */
export type RpcMiddleware = (ctx: RpcContext, next: () => Promise<void>) => Promise<void>

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
  /**
   * Map of pending requests by ID. Stores promise handlers for pending requests.
   *
   * @remarks
   * Uses {@link ITMapRpc} for the map value shape.
   */
  map = new Map() as ITMapRpc

  /**
   * Default context merged into every outgoing RPC payload.
   *
   * @remarks
   * Useful for propagating correlation data (e.g. `traceId`) across threads:
   * set it once and it is included in every `makeRequest` payload. Per-call
   * `_others` values take precedence over this context.
   * @public
   */
  context: Record<string, unknown> = {}

  private _middlewares: RpcMiddleware[] = []

  /**
   * Creates a new WorkerThreadRpc instance.
   *
   * @param send - Function to send data. Called with RPC payload.
   * @param register - Object with callable methods. Exposed RPC method map.
   */
  constructor(
    public send: (data: Record<string, unknown>) => unknown,
    public register: Record<string, (...args: never[]) => unknown>
  ) {}

  /**
   * Register middleware for incoming requests.
   *
   * @remarks
   * Middleware runs in registration order before the target method is
   * dispatched. Each middleware receives a mutable {@link RpcContext} and a
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
  use(...middlewares: RpcMiddleware[]) {
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
    const map = this.map
    const send = this.send
    const {id, method, params, result, error} = data

    if (method !== undefined) {
      // Handle request
      try {
        if (typeof method !== `string`) {
          throw new Error(`Invalid RPC method type: ${typeof method}`)
        }
        if (params !== undefined && !Array.isArray(params)) {
          throw new Error(`Invalid RPC params: expected array, got ${typeof params}`)
        }
        const ctx: RpcContext = {method, params: params ?? []}
        await this._runMiddleware(ctx, 0)
        // the wire cannot carry `undefined` — send null so the caller resolves
        // instead of hanging on a missing result field
        const sent = send({id, result: ctx.result === undefined ? null : ctx.result})
        if (sent && typeof (sent as Promise<unknown>).then === `function`) {
          ;(sent as Promise<unknown>).catch(() => {
            // intentionally ignored
          })
        }
      } catch (err: unknown) {
        const errPayload = err instanceof Error ? {message: err.message, stack: err.stack, name: err.name} : err
        try {
          const p = send({id, error: errPayload})
          if (p && typeof (p as Promise<unknown>).then === `function`) {
            ;(p as Promise<unknown>).catch(() => {
              // intentionally ignored
            })
          }
        } catch {
          // intentionally ignored
        }
      }
    } else if (result !== undefined && id !== undefined) {
      // Handle result
      const data = map.get(id)
      if (data) {
        if (data.timer) clearTimeout(data.timer)
        data.resolve(result)
        map.delete(id)
      }
    } else if (error !== undefined && id !== undefined) {
      // Handle error
      const data = map.get(id)
      if (data) {
        if (data.timer) clearTimeout(data.timer)
        data.reject(error)
        map.delete(id)
      }
    }
  }

  /**
   * Run the middleware chain, then dispatch the method.
   *
   * @param ctx - Mutable request context shared through the chain.
   * @param index - Current middleware index.
   */
  private async _runMiddleware(ctx: RpcContext, index: number): Promise<void> {
    if (index >= this._middlewares.length) {
      const func = this.register[ctx.method]
      if (typeof func !== `function`) {
        throw new Error(`Method ${ctx.method} not found or not function`)
      }
      ctx.result = await (func as (...args: unknown[]) => unknown).apply(this.register, ctx.params)
      return
    }
    const middleware = this._middlewares[index]!
    await middleware(ctx, () => this._runMiddleware(ctx, index + 1))
  }

  /** @internal Counter for unique ID generation (avoids Math.random determinism). */
  private _nextId = 1

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
   * @param _wait - Wait for response. If false, returns send result. Defaults to `true`.
   * @param _others - Additional data to include. Merged into RPC payload.
   * @param timeoutMs - Optional timeout in milliseconds. When exceeded, the
   *   pending request is rejected with a timeout error and removed from the
   *   pending map. `undefined` disables the timeout.
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
  makeRequest(method: string, params: unknown[], _wait: true, _others?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>
  makeRequest(method: string, params: unknown[], _wait?: false, _others?: Record<string, unknown>, timeoutMs?: number): unknown
  makeRequest(method: string, params: unknown[], _wait: boolean, _others?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> | unknown
  makeRequest(method: string, params: unknown[], _wait = true, _others?: Record<string, unknown>, timeoutMs?: number): Promise<unknown> | unknown {
    const id = this.makeId()
    // reserved envelope fields come last so context/_others can never corrupt
    // the wire format (id/method/params)
    const pld = {...this.context, ..._others, id, method, params}
    if (!_wait) {
      const sent = this.send(pld)
      if (sent && typeof (sent as Promise<unknown>).then === `function`) {
        ;(sent as Promise<unknown>).catch(() => {
          // intentionally ignored
        })
      }
      return sent
    }

    return new Promise((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined
      if (timeoutMs !== undefined && timeoutMs > 0) {
        timer = setTimeout(() => {
          const entry = this.map.get(id)
          if (entry) {
            this.map.delete(id)
            reject(new Error(`RPC timeout after ${timeoutMs}ms: ${method}`))
          }
        }, timeoutMs)
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
