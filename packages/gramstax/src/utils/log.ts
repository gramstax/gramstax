import {LoggingPretty} from "logging-pretty"

/**
 * Extends {@link https://www.npmjs.com/package/logging-pretty | LoggingPretty} to provide enhanced logging functionality.
 *
 * @remarks
 * Inherits all methods from `LoggingPretty` including `info()`, `debug()`, `warn()`, `error()`, and `success()`.
 * Adds helper methods for formatted error logging with class/function context.
 *
 * @example
 * ```typescript
 * import { LoggingUtil, log } from "gramstax";
 *
 * // Use the singleton
 * log.info("Application started");
 *
 * // Or create a new instance
 * const logger = new LoggingUtil();
 * logger.errorMake(new Error("Oops"), "Worker", "init");
 * ```
 *
 * @public
 */
export class LoggingUtil extends LoggingPretty {
  /**
   * Creates a new LoggingUtil instance.
   *
   * @param options - LoggingPretty constructor options. Passed through to parent `LoggingPretty`.
   */
  constructor(options?: ConstructorParameters<typeof LoggingPretty>[0]) {
    super(options)
  }

  /**
   * Log a formatted error message with optional class and function context.
   *
   * @param pureError - The error to log. Can be an `Error` object or any value.
   * @param constructorName - Class name for context. Format is `[ClassName:methodName] error`.
   * @param funcName - Method/function name. Format is `[methodName] error` if no class.
   *
   * @example
   * ```typescript
   * const logger = new LoggingUtil();
   *
   * try {
   *   throw new Error("Something went wrong");
   * } catch (error) {
   *   logger.errorMake(error, "UserService", "createUser");
   *   // Logs: [UserService:createUser] { "message": "Something went wrong", ... }
   * }
   * ```
   * @public
   */
  errorMake(pureError: any, constructorName?: any, funcName?: string) {
    this.error(`[${constructorName ? `${constructorName}:${funcName}` : funcName}] ${this._formatErrorObj(pureError)}`)
  }

  /**
   * Format an error object to a JSON string.
   *
   * @param pureError - The error to format. If an `Error` object, extracts message, stack, and name.
   * @returns JSON string representation of the error.
   *
   * @example
   * ```typescript
   * const logger = new LoggingUtil();
   * const formatted = logger._formatErrorObj(new Error("Test"));
   * // => '{\n  "message": "Test",\n  "stack": "...",\n  "name": "Error"\n}'
   * ```
   * @internal
   */
  _formatErrorObj(pureError: any) {
    const error = JSON.stringify(pureError instanceof Error ? {message: pureError.message, stack: pureError.stack, name: pureError.name} : pureError, null, 2)
    return error
  }
}

/**
 * Pre-instantiated {@link LoggingUtil} singleton for convenience.
 *
 * @example
 * ```typescript
 * import { log } from "gramstax";
 *
 * log.info("Application started");
 * log.debug("Debug message");
 * log.warn("Warning message");
 * log.error("Error message");
 * log.success("Success message");
 * ```
 *
 * @public
 */
export const log = new LoggingUtil()
