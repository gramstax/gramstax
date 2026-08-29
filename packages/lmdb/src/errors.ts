/**
 * Base class for all `@gramstax/lmdb` errors.
 *
 * @remarks
 * Every public API failure throws one of these so callers can `instanceof`
 * discriminate. Plain `Error` is never thrown from this package.
 * Catch this base class to handle any error from the package.
 *
 * @public
 */
export class LmdbError extends Error {
  /**
   * @param message - Human-readable error description.
   * @param options - Standard {@link Error} options.
   */
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = `LmdbError`
  }
}

/**
 * Thrown when an operation is attempted on an env that is not yet open.
 *
 * @remarks
 * The env opens on construction; this error indicates the env was closed
 * before the operation was attempted.
 *
 * @public
 */
export class LmdbEnvNotOpenError extends LmdbError {
  constructor() {
    super(`LmdbEnv is not open. The env must be in 'open' state before performing operations.`)
    this.name = `LmdbEnvNotOpenError`
  }
}

/**
 * Thrown when an operation is attempted on an env that has already been closed.
 *
 * @public
 */
export class LmdbEnvClosedError extends LmdbError {
  constructor() {
    super(`LmdbEnv has been closed and cannot be reused. Create a new instance.`)
    this.name = `LmdbEnvClosedError`
  }
}

/**
 * Thrown when a schema class does not declare a static `db`.
 *
 * @remarks
 * Every schema class must declare `static db = '...'` to
 * identify its sub-database.
 *
 * @public
 */
export class LmdbMissingDbNameError extends LmdbError {
  constructor(schemaClassName: string) {
    super(`Schema class '${schemaClassName}' must declare a static 'db' property.`)
    this.name = `LmdbMissingDbNameError`
  }
}

/**
 * Thrown when a sub's `dbName` collides with another registered sub.
 *
 * @public
 */
export class LmdbDuplicateDbNameError extends LmdbError {
  constructor(dbName: string) {
    super(`A sub with dbName '${dbName}' is already registered. Use a different dbName.`)
    this.name = `LmdbDuplicateDbNameError`
  }
}

/**
 * Thrown when {@link LmdbEnv.get} is called for an unregistered LmdbSchema class.
 *
 * @public
 */
export class LmdbSchemaNotRegisteredError extends LmdbError {
  constructor(schemaClassName: string) {
    super(`LmdbSchema class '${schemaClassName}' is not registered. Call env.register(SchemaClass) first.`)
    this.name = `LmdbSchemaNotRegisteredError`
  }
}

/**
 * Thrown when {@link LmdbEnv.register} is called twice for the same class.
 *
 * @public
 */
export class LmdbSchemaAlreadyRegisteredError extends LmdbError {
  constructor(schemaClassName: string) {
    super(`LmdbSchema class '${schemaClassName}' is already registered.`)
    this.name = `LmdbSchemaAlreadyRegisteredError`
  }
}

/**
 * Thrown when {@link LmdbEnv.getStrict} is called and the key is absent.
 *
 * @public
 */
export class LmdbKeyNotFoundError extends LmdbError {
  constructor(dbName: string, key: unknown) {
    super(`Key '${String(key)}' not found in sub '${dbName}'.`)
    this.name = `LmdbKeyNotFoundError`
  }
}

/**
 * Thrown when a transaction callback throws — wraps the original error and
 * aborts the transaction.
 *
 * @public
 */
export class LmdbTransactionError extends LmdbError {
  /**
   * @param message - Error description.
   * @param cause - The original error thrown by the transaction callback.
   */
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message, cause instanceof Error ? {cause} : undefined)
    this.name = `LmdbTransactionError`
  }
}

/**
 * Thrown when an operation is attempted on an already-committed or aborted transaction.
 *
 * @public
 */
export class LmdbTransactionDoneError extends LmdbError {
  constructor() {
    super(`Transaction has already been committed or aborted and cannot be reused.`)
    this.name = `LmdbTransactionDoneError`
  }
}

/**
 * Thrown when a write operation is attempted on a read-only env.
 *
 * @public
 */
export class LmdbReadOnlyError extends LmdbError {
  constructor(operation: string) {
    super(`Cannot perform '${operation}' on a read-only env.`)
    this.name = `LmdbReadOnlyError`
  }
}

/**
 * Thrown when a destructive prefix operation is called with an empty prefix
 * (e.g. `deleteByPrefix('')`), which would otherwise wipe the entire
 * collection silently. Use {@link LmdbEnv.clear} instead.
 *
 * @public
 */
export class LmdbEmptyPrefixError extends LmdbError {
  constructor() {
    super(`Prefix must not be empty. Use clear() to delete every entry.`)
    this.name = `LmdbEmptyPrefixError`
  }
}

/**
 * Thrown when a {@link LmdbEnv.like} pattern has too many wildcards,
 * risking ReDoS (catastrophic backtracking) in the compiled regex.
 *
 * @public
 */
export class LmdbLikePatternError extends LmdbError {
  /** Maximum wildcards allowed in a `like()` pattern. */
  static readonly MAX_WILDCARDS = 10

  constructor(wildcardCount: number) {
    super(`Pattern has ${wildcardCount} wildcards — limit is ${LmdbLikePatternError.MAX_WILDCARDS}. Too many wildcards risk ReDoS (catastrophic backtracking).`)
    this.name = `LmdbLikePatternError`
  }
}

/**
 * Thrown when a range query would materialize an unbounded or oversized
 * result array into memory (guardrail B4).
 *
 * @remarks
 * {@link LmdbEnv.keys}, {@link LmdbEnv.values},
 * {@link LmdbEnv.entries}, {@link LmdbEnv.like},
 * {@link LmdbEnv.findByPrefix} and {@link LmdbEnv.deleteByPrefix}
 * refuse to materialize more than {@link MAX_MATERIALIZE}
 * entries. Pass `{limit}` or use {@link LmdbEnv.iterate} to bound the
 * result.
 *
 * @public
 */
export class LmdbMaterializationError extends LmdbError {
  /**
   * @param operation - The sub method that was guarded.
   * @param max - The materialization cap ({@link MAX_MATERIALIZE}).
   * @param requested - The requested limit, when the rejection came from an
   * explicit limit above the cap.
   */
  constructor(operation: string, max: number, requested?: number) {
    super(requested === undefined ? `${operation} would materialize more than ${max} entries into memory — use {limit} or iterate() to bound the result.` : `${operation} limit ${requested} exceeds the materialization cap of ${max} — use {limit} or iterate() to bound the result.`)
    this.name = `LmdbMaterializationError`
  }
}

/**
 * Thrown when a version-dependent operation (e.g. {@link LmdbEnv.compareAndSet})
 * is called on an env opened without `useVersions: true`.
 *
 * @public
 */
export class LmdbUseVersionsRequiredError extends LmdbError {
  constructor(operation: string) {
    super(`Cannot perform '${operation}' because the env was not opened with useVersions: true.`)
    this.name = `LmdbUseVersionsRequiredError`
  }
}

/**
 * Thrown when the LMDB map is nearly full (free ratio below 10%).
 *
 * @remarks
 * Raised by {@link LmdbEnv.register} as a guardrail before the system
 * hits MDB_MAP_FULL. Free up space or increase `mapSize`.
 *
 * @public
 */
export class LmdbMapFullError extends LmdbError {
  /**
   * @param ratio - The free ratio (`free/total`) at the time of the check.
   */
  constructor(ratio: number) {
    super(`MDB_MAP_FULL risk — free ratio ${ratio.toFixed(3)} is below 10%. Increase mapSize or prune data.`)
    this.name = `LmdbMapFullError`
  }
}

/**
 * Thrown when a unique embedded index would be violated by a write.
 *
 * @remarks
 * Raised by schema writes when the new index value is already
 * owned by a DIFFERENT primary key (SQL: `UNIQUE` constraint violation).
 * Re-putting the same primary key with the same index value (self-update)
 * does NOT throw — the conflict only fires when another key owns the value.
 *
 * @public
 */
export class LmdbUniqueConstraintError extends LmdbError {
  /**
   * @param indexName - Name of the unique index that was violated.
   * @param primaryKey - The primary key of the write that was rejected.
   * @param indexValue - The index value that is already taken.
   */
  constructor(indexName: string, primaryKey: unknown, indexValue: unknown) {
    super(`Unique index '${indexName}' violated: index value '${String(indexValue)}' is already owned by a different primary key (write was for key '${String(primaryKey)}').`)
    this.name = `LmdbUniqueConstraintError`
  }
}
