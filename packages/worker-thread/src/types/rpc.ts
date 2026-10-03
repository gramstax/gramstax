/**
 * Map type for storing pending RPC request handlers.
 * @public
 */
export type IMapRpc = Map<number, {reject: (error: unknown) => void; resolve: (result: unknown) => void; timer?: ReturnType<typeof setTimeout>}>

/**
 * Context object passed through the RPC middleware chain for incoming requests.
 *
 * @remarks
 * Middleware can mutate `params` before dispatch, short-circuit by setting
 * `result` without calling `next`, or throw to reject the request.
 * @public
 */
export type IRpcContext = {
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
export type IRpcMiddleware = (ctx: IRpcContext, next: () => Promise<void>) => Promise<void>
