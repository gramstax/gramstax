/**
 * Shared types for `@gramstax/lmdb`.
 *
 * @remarks
 * Types are intentionally minimal — only the shapes that appear at public
 * API boundaries. Internal helpers keep their types private to their modules.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Anything that can be used as a key in LMDB.
 *
 * @remarks
 * LMDB natively accepts strings, numbers, Buffers, and binary Buffers.
 * Numbers are encoded as little-endian for ordering stability.
 *
 * @public
 */
export type LMDBKey = string | number | Buffer

/**
 * Options accepted by {@link LmdbEnv}.
 *
 * @remarks
 * Mirrors the underlying `lmdb` `open()` options with sensible defaults
 * tuned for the Repository use case.
 *
 * @public
 */
export interface ILmdbEnvOptions {
  /** Filesystem path where LMDB will store its data files. */
  path: string

  /**
   * Maximum number of named sub-databases.
   *
   * @remarks
   * Each {@link Repository} typically owns one sub-database. Set this to at
   * least the number of repositories you intend to register.
   * @defaultValue `10`
   */
  maxDbs?: number

  /**
   * Enable LMDB's built-in compression for stored values.
   *
   * @remarks
   * Reduces on-disk size at the cost of small CPU overhead on read/write.
   * @defaultValue `false`
   */
  compression?: boolean

  /**
   * Whether the env is opened in read-only mode.
   *
   * @remarks
   * Read-only envs reject all write operations (set/delete/clear).
   * @defaultValue `false`
   */
  readOnly?: boolean

  /**
   * Maximum number of concurrent readers.
   *
   * @remarks
   * LMDB uses a readers table sized at startup. Each concurrent reader
   * (including read-only transactions) takes one slot.
   * @defaultValue `126`
   */
  maxReaders?: number

  /**
   * Map size in bytes.
   *
   * @remarks
   * The virtual memory mapping size. Must be larger than the total expected
   * dataset. Cannot be changed after env is opened.
   * @defaultValue `268435456` (256 MB)
   */
  mapSize?: number
}

/**
 * Options for range queries and iteration.
 *
 * @remarks
 * All fields are optional. Omitting `start` and `end` iterates the full key
 * space in lexicographic order. `transaction` is an LMDB-internal field used
 * by {@link Repository} to bind the range query to a read transaction for
 * snapshot consistency.
 *
 * @public
 */
export interface IRangeOptions {
  /** Lower bound (inclusive). Iteration starts here. */
  start?: LMDBKey

  /** Upper bound (exclusive). Iteration stops before this key. */
  end?: LMDBKey

  /**
   * Include `end` in the results (default `false`).
   *
   * @example
   * ```typescript
   * // keys "k1", "k2", "k3" — returns "k1" and "k2"
   * repo.entries({start: `k1`, end: `k3`})
   *
   * // same range but with inclusiveEnd: returns "k1", "k2", "k3"
   * repo.entries({start: `k1`, end: `k3`, inclusiveEnd: true})
   * ```
   */
  inclusiveEnd?: boolean

  /**
   * Exclude `start` from the results (default `false`).
   *
   * @example
   * ```typescript
   * // keys "k1", "k2", "k3" — returns "k1", "k2", "k3"
   * repo.entries({start: `k1`, end: `k3`})
   *
   * // same range but with exclusiveStart: returns "k2", "k3"
   * repo.entries({start: `k1`, end: `k3`, exclusiveStart: true})
   * ```
   */
  exclusiveStart?: boolean

  /** Maximum number of entries to return. */
  limit?: number

  /** Skip the first N entries. Useful with cursor iteration. */
  offset?: number

  /** Reverse iteration order. */
  reverse?: boolean

  /**
   * Underlying LMDB read transaction object (set internally by
   * {@link Repository} when a transaction wrapper is passed).
   *
   * @internal
   */
  transaction?: any
}

/**
 * A serializer/deserializer pair used by a {@link Repository}.
 *
 * @remarks
 * Default codec is JSON. Override for custom formats (msgpack, protobuf,
 * structured-clone, etc).
 *
 * @public
 */
export interface ICodec<T> {
  /** Convert a typed value to a storable representation. */
  serialize(value: T): unknown

  /** Convert a stored representation back to a typed value. */
  deserialize(raw: unknown): T
}

/**
 * Lifecycle state of an {@link LmdbEnv}.
 *
 * @public
 */
export type LmdbEnvState = `closed` | `opening` | `open` | `closing`