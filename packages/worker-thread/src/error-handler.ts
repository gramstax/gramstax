/**
 * Default error reporting for the package.
 *
 * @remarks
 * Library code never writes to the console directly — consumers decide
 * where errors go. Set a package-wide handler once with
 * {@link setDefaultErrorHandler}, or attach per-instance `error` listeners;
 * without either, errors are dropped silently.
 *
 * @public
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
export function setDefaultErrorHandler(handler: (err: unknown) => void) {
  defaultHandler = handler
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
