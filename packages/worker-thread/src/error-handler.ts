/**
 * Package-wide error routing for worker threads.
 *
 * @remarks
 * The library never writes errors to the console. Anything a `WorkerThreadLaunch`,
 * `WorkerThreadInit`, `WorkerThreadPool`, or gateway peer reports goes through
 * {@link WorkerThreadErrorHandler.report}, which hands it to the package-wide
 * default handler. The default is a silent drop, so an unobserved error is never
 * fatal to the transport that reported it.
 *
 * @public
 */
export class WorkerThreadErrorHandler {
  /**
   * Package-wide fallback invoked by {@link WorkerThreadErrorHandler.report} when
   * a `WorkerThreadLaunch` has no `error` listener of its own. Owned by
   * {@link WorkerThreadErrorHandler.setDefault} and
   * {@link WorkerThreadErrorHandler.resetDefault}; starts as a silent drop.
   *
   * @internal
   */
  private static _default: (err: unknown) => void = () => {}

  /**
   * Set the package-wide error handler used when no per-instance `error`
   * listeners are attached.
   *
   * @param handler - Receives every error that has no instance listener.
   * @throws {TypeError} When `handler` is neither a function nor `undefined`.
   *
   * @example
   * ```typescript
   * import {WorkerThreadErrorHandler} from "@gramstax/worker-thread";
   *
   * WorkerThreadErrorHandler.setDefault((err) => logger.error(err));
   * ```
   * @public
   */
  static setDefault(handler: ((err: unknown) => void) | undefined): void {
    if (handler === undefined) {
      WorkerThreadErrorHandler._default = () => {}
      return
    }
    if (typeof handler !== `function`) {
      throw new TypeError(`Invalid error handler: expected function, got ${handler === null ? `null` : typeof handler}`)
    }
    WorkerThreadErrorHandler._default = handler
  }

  /**
   * Reset the package-wide error handler to the default silent drop.
   *
   * @example
   * ```typescript
   * import {WorkerThreadErrorHandler} from "@gramstax/worker-thread";
   *
   * WorkerThreadErrorHandler.resetDefault();
   * ```
   * @public
   */
  static resetDefault(): void {
    WorkerThreadErrorHandler._default = () => {}
  }

  /**
   * Report an error through the configured default handler.
   *
   * @param err - The error to route. Non-`Error` values are passed through as-is.
   *
   * @internal
   */
  static report(err: unknown): void {
    try {
      WorkerThreadErrorHandler._default(err)
    } catch {
      // a throwing user handler must never crash the transport that reported
      // the error
    }
  }
}
