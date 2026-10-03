/**
 * Package-wide fallback invoked by {@link reportError} when a `WorkerThreadLaunch`
 * has no `error` listener of its own. Owned by `setDefaultErrorHandler` and
 * `resetDefaultErrorHandler`; starts as a silent drop so an unhandled error is
 * never fatal to the transport that reported it.
 *
 * @internal
 */
let defaultHandler: (err: unknown) => void = () => {}

/**
 * Set the package-wide error handler used when no per-instance `error`
 * listeners are attached.
 *
 * @param handler - Receives every error that has no instance listener.
 *
 * @example
 * ```typescript
 * import {setDefaultErrorHandler} from "@gramstax/worker-thread";
 *
 * setDefaultErrorHandler((err) => logger.error(err));
 * ```
 * @public
 */
export function setDefaultErrorHandler(handler: ((err: unknown) => void) | undefined) {
  if (handler === undefined) {
    defaultHandler = () => {}
    return
  }
  if (typeof handler !== `function`) {
    throw new TypeError(`Invalid error handler: expected function, got ${handler === null ? `null` : typeof handler}`)
  }
  defaultHandler = handler
}

/**
 * Reset the package-wide error handler to the default silent drop.
 *
 * @example
 * ```typescript
 * import {resetDefaultErrorHandler} from "@gramstax/worker-thread";
 *
 * resetDefaultErrorHandler();
 * ```
 * @public
 */
export function resetDefaultErrorHandler() {
  defaultHandler = () => {}
}

/**
 * Report an error through the configured default handler.
 *
 * @internal
 */
export function reportError(err: unknown) {
  try {
    defaultHandler(err)
  } catch {
    // a throwing user handler must never crash the transport that reported
    // the error
  }
}
