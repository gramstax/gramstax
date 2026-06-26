/**
 * Logging helper — wrapped `LoggingPretty` for the Gramstax bot.
 *
 * @remarks
 * Provides structured logging with prefix support (R/W/E for Read/Write/Error)
 * and automatic caller detection. Used throughout the framework for
 * consistent log output.
 *
 * @packageDocumentation
 * @public
 */

import {LoggingPretty} from "logging-pretty"

/**
 * Extends {@link https://www.npmjs.com/package/logging-pretty | LoggingPretty} to provide enhanced logging functionality.
 *
 * @remarks
 * Inherits all methods from `LoggingPretty` including `info()`, `debug()`, `warn()`, `error()`, and `success()`.
 * Adds helper methods for formatted error logging with class/function context and timing measurements.
 *
 * @example
 * ```typescript
 * import { LoggingHelper, log } from "gramstax";
 *
 * // Use the singleton
 * log.info("Application started");
 *
 * // Time measurement
 * log.time("operation", "Starting database query");
 * // ... do work ...
 * log.timeEnd("operation", "Query completed");
 * // Output: (245ms) operation: Query completed
 *
 * // Or create a new instance
 * const logger = new LoggingHelper();
 * logger.errorMake(new Error("Oops"), "Worker", "init");
 * ```
 *
 * @public
 */
export class LoggingHelper extends LoggingPretty {
  /**
   * Internal map to store timing labels and their start timestamps.
   * @internal
   */
  private timers: Map<string, bigint> = new Map()

  /**
   * Creates a new LoggingHelper instance.
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
   * const logger = new LoggingHelper();
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
   * const logger = new LoggingHelper();
   * const formatted = logger._formatErrorObj(new Error("Test"));
   * // => '{\n  "message": "Test",\n  "stack": "...",\n  "name": "Error"\n}'
   * ```
   * @public
   */
  _formatErrorObj(pureError: any) {
    const error = JSON.stringify(pureError instanceof Error ? {message: pureError.message, stack: pureError.stack, name: pureError.name} : pureError, null, 2)
    return error
  }

  /**
   * Start a timer with a custom label.
   *
   * @param label - Unique identifier for this timer. Used with `timeEnd()` to calculate duration.
   *
   * @example
   * ```typescript
   * const logger = new LoggingHelper();
   *
   * logger.time("db-query");
   * logger.time("api-call");
   * ```
   *
   * @public
   */
  time(label: string) {
    this.timers.set(label, process.hrtime.bigint())
  }

  /**
   * End a timer and log the elapsed time with an optional custom message.
   *
   * @param label - The timer label to end. Must match a label from `time()`.
   * @param message - Optional custom message to display with the elapsed time.
   *
   * @example
   * ```typescript
   * const logger = new LoggingHelper();
   *
   * logger.time("db-query", "Fetching users");
   * // ... perform database query ...
   * logger.timeEnd("db-query", "Query completed");
   * // Logs: (245ms) db-query: Query completed
   *
   * logger.time("processing");
   * // ... do work ...
   * logger.timeEnd("processing");
   * // Logs: (1523ms) processing
   * ```
   *
   * @public
   */
  timeEnd(label: string, message?: string) {
    const startTime = this.timers.get(label)
    if (startTime === undefined) {
      this.debug(`${label}: Timer was never started`)
      return
    }

    const duration = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(3)
    this.timers.delete(label)
    if (message) {
      this.debug(`${message} (took ${duration}ms)`)
    } else {
      this.debug(`${label} (took ${duration}ms)`)
    }
  }

  /**
   * Get the elapsed time for a running timer without ending it.
   *
   * @param label - The timer label to check.
   * @returns Elapsed time in milliseconds, or `undefined` if timer doesn't exist.
   *
   * @example
   * ```typescript
   * const logger = new LoggingHelper();
   *
   * logger.time("long-process");
   * // ... do some work ...
   * const elapsed = logger.timeCheck("long-process");
   * logger.info(`Progress check: ${elapsed}ms elapsed`);
   * // ... continue work ...
   * logger.timeEnd("long-process");
   * ```
   *
   * @public
   */
  timeCheck(label: string): string | undefined {
    const startTime = this.timers.get(label)
    if (startTime === undefined) {
      return undefined
    }
    return (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(3)
  }

  /**
   * Log a checkpoint with elapsed time without ending the timer.
   *
   * @param label - The timer label to checkpoint.
   * @param message - Optional custom message for this checkpoint.
   *
   * @example
   * ```typescript
   * const logger = new LoggingHelper();
   *
   * logger.time("data-processing", "Starting data pipeline");
   * // ... step 1 ...
   * logger.timeLog("data-processing", "Step 1: Data loaded");
   * // Logs: (245ms) data-processing: Step 1: Data loaded
   * // ... step 2 ...
   * logger.timeLog("data-processing", "Step 2: Data transformed");
   * // Logs: (589ms) data-processing: Step 2: Data transformed
   * // ... step 3 ...
   * logger.timeEnd("data-processing", "Pipeline completed");
   * // Logs: (1234ms) data-processing: Pipeline completed
   * ```
   *
   * @public
   */
  timeLog(label: string, message?: string) {
    const elapsed = this.timeCheck(label)
    if (elapsed === undefined) {
      this.debug(`${label}: Timer was never started`)
      return
    }

    if (message) {
      this.debug(`${message} (${elapsed}ms)`)
    } else {
      this.debug(`${label} (${elapsed}ms)`)
    }
  }

  /**
   * Clear all active timers.
   *
   * @example
   * ```typescript
   * const logger = new LoggingHelper();
   *
   * logger.time("task1");
   * logger.time("task2");
   * logger.timeClear();
   * // All timers cleared
   * ```
   *
   * @public
   */
  timeClear() {
    this.timers.clear()
  }

  /**
   * Get all active timer labels.
   *
   * @returns Array of active timer labels.
   *
   * @example
   * ```typescript
   * const logger = new LoggingHelper();
   *
   * logger.time("task1");
   * logger.time("task2");
   * const active = logger.timeActive();
   * // => ["task1", "task2"]
   * ```
   *
   * @public
   */
  timeActive(): string[] {
    return Array.from(this.timers.keys())
  }
}

/**
 * Pre-instantiated {@link LoggingHelper} singleton for convenience.
 *
 * @example
 * ```typescript
 * import { log } from "gramstax";
 *
 * // Basic logging
 * log.info("Application started");
 * log.debug("Debug message");
 * log.warn("Warning message");
 * log.error("Error message");
 * log.success("Success message");
 *
 * // Timing measurements
 * log.time("request", "Processing user request");
 * log.timeEnd("request", "Request completed");
 * // Output: (245ms) request: Request completed
 *
 * // Multiple checkpoints
 * log.time("pipeline", "Starting data pipeline");
 * log.timeLog("pipeline", "Step 1 complete");
 * // Output: (150ms) pipeline: Step 1 complete
 * log.timeLog("pipeline", "Step 2 complete");
 * // Output: (350ms) pipeline: Step 2 complete
 * log.timeEnd("pipeline", "All steps complete");
 * // Output: (500ms) pipeline: All steps complete
 * ```
 *
 * @public
 */
export const log = new LoggingHelper()
