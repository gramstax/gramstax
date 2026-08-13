/**
 * Typed error classes for `@gramstax/lmdb`.
 *
 * @remarks
 * Every public API failure throws one of these so callers can `instanceof`
 * discriminate. Plain `Error` is never thrown from this package.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Base class for all `@gramstax/lmdb` errors.
 *
 * @remarks
 * Catch this to handle any error from the package.
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
 * Thrown when a LmdbRepository class does not declare a static `dbName`.
 *
 * @remarks
 * Every {@link LmdbRepository} subclass must declare `static dbName = '...'` to
 * identify its sub-database.
 *
 * @public
 */
export class LmdbMissingDbNameError extends LmdbError {
  constructor(repoClassName: string) {
    super(`LmdbRepository class '${repoClassName}' must declare a static 'dbName' property.`)
    this.name = `LmdbMissingDbNameError`
  }
}

/**
 * Thrown when a LmdbRepository's `dbName` collides with another registered
 * LmdbRepository.
 *
 * @public
 */
export class LmdbDuplicateDbNameError extends LmdbError {
  constructor(dbName: string) {
    super(`A repository with dbName '${dbName}' is already registered. Use a different dbName.`)
    this.name = `LmdbDuplicateDbNameError`
  }
}

/**
 * Thrown when {@link LmdbEnv.get} is called for an unregistered LmdbRepository class.
 *
 * @public
 */
export class LmdbRepositoryNotRegisteredError extends LmdbError {
  constructor(repoClassName: string) {
    super(`LmdbRepository '${repoClassName}' is not registered. Call env.register(RepoClass) first.`)
    this.name = `LmdbRepositoryNotRegisteredError`
  }
}

/**
 * Thrown when {@link LmdbEnv.register} is called twice for the same class.
 *
 * @public
 */
export class LmdbRepositoryAlreadyRegisteredError extends LmdbError {
  constructor(repoClassName: string) {
    super(`LmdbRepository '${repoClassName}' is already registered.`)
    this.name = `LmdbRepositoryAlreadyRegisteredError`
  }
}

/**
 * Thrown when {@link LmdbRepository.getStrict} is called and the key is absent.
 *
 * @public
 */
export class LmdbKeyNotFoundError extends LmdbError {
  constructor(dbName: string, key: unknown) {
    super(`Key '${String(key)}' not found in repository '${dbName}'.`)
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
 * repository silently. Use {@link LmdbRepository.clear} instead.
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
 * Thrown when a {@link LmdbRepository.like} pattern has too many wildcards,
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
