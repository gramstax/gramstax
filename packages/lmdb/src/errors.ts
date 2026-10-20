/**
 * The single error class thrown by `@gramstax/lmdb`.
 *
 * @remarks
 * Every public API failure throws this class — inspect `message` to tell
 * failures apart. Plain `Error` is never thrown from this package.
 * Catch this class to handle any error from the package.
 *
 * @public
 */
export class LmdbError extends Error {
  /**
   * @param message - Human-readable error description.
   * @param options - Standard `Error` options.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = `LmdbError`
  }
}
