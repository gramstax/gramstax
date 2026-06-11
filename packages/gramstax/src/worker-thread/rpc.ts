/**
 * Map type for storing pending RPC request handlers.
 * @public
 */
export type ITMapRpc = Map<any, {reject: (error: any) => any; resolve: (result: any) => any}>

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
   * Creates a new WorkerThreadRpc instance.
   *
   * @param send - Function to send data. Called with RPC payload.
   * @param register - Object with callable methods. Exposed RPC method map.
   */
  constructor(
    public send: (data: any) => any,
    public register: Record<any, any>
  ) {}

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
  async make(data: any) {
    const map = this.map
    const send = this.send
    const {id, method, params, result, error} = data

    if (method !== undefined) {
      // Handle request
      try {
        const func = this.register[method]
        if (typeof func !== `function`) {
          throw new Error(`Method ${method} not found or not function`)
        }

        const res = await func.apply(this.register, params)
        send({id, result: res})
      } catch (err: any) {
        send({
          id,
          error: err instanceof Error ? {message: err.message, stack: err.stack, name: err.name} : err
        })
      }
    } else if (result !== undefined) {
      // Handle result
      const data = map.get(id)
      if (data) {
        data.resolve(result)
        map.delete(id)
      }
    } else if (error !== undefined) {
      // Handle error
      const data = map.get(id)
      if (data) {
        data.reject(error)
        map.delete(id)
      }
    }
  }

  /**
   * Generate a unique request ID.
   *
   * @returns A random number ID.
   *
   * @example
   * ```typescript
   * const id = rpc.makeId();
   * ```
   * @public
   */
  makeId() {
    return Math.random()
  }

  /**
   * Create and send an RPC request.
   *
   * @param method - Method name to call. Targets registered method.
   * @param params - Method parameters. Sent as positional array.
   * @param _wait - Wait for response. If false, returns send result. Defaults to `true`.
   * @param _others - Additional data to include. Merged into RPC payload.
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
   * ```
   * @public
   */
  makeRequest(method: string, params: any, _wait = true, _others?: Record<string, any>): Promise<any> {
    const id = this.makeId()
    const pld = {id, method, params, ..._others}
    if (!_wait) {
      return this.send(pld)
    }

    return new Promise((resolve, reject) => {
      this.map.set(id, {resolve, reject})
      this.send(pld)
    })
  }
}
