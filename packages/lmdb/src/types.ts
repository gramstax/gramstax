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

import type {Key, Transaction} from "lmdb"

/**
 * Anything that can be used as a key in LMDB.
 *
 * @remarks
 * LMDB natively accepts strings, numbers, Buffers, and arrays of primitives
 * (ordered-binary composite keys). The array form enables multi-tenant
 * / namespaced keys like `["tenant-a", 42]` that sort lexicographically.
 * Re-exported from `lmdb` for convenience.
 *
 * @public
 */
export type ILmdbKey = Key

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
   * Each {@link LmdbRepository} typically owns one sub-database. Set this to at
   * least the number of repositories you intend to register.
   * @defaultValue `128`
   */
  maxDbs?: number

  /**
   * LMDB native value encoding — passed to `root.openDB()` and inherited by
   * all sub-databases.
   *
   * @remarks
   * - `msgpack` (default) — fastest, supports `Date`/`Map`/`Set`/BigInt
   * - `json` — human-readable; LMDB does `JSON.stringify`/`JSON.parse` natively
   * - `binary` — values must be `Buffer`; LMDB stores raw bytes
   * - `string` — values must be strings; LMDB stores as UTF-8
   * - `ordered-binary` — values encoded with the same encoding as keys
   *
   * All sub-databases in this env share the same encoding.
   * @defaultValue `msgpack`
   */
  encoding?: ILmdbEncoding

  /**
   * Enable LMDB's built-in compression for stored values.
   *
   * @remarks
   * Reduces on-disk size at the cost of small CPU overhead on read/write.
   * Off-thread LZ4 — typically negligible impact.
   * @defaultValue `false`
   */
  compression?: boolean | ICompressionOptions

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
   * @defaultValue `4294967296` (4 GB)
   */
  mapSize?: number

  /**
   * Enable in-memory caching of frequently accessed entries.
   *
   * @remarks
   * Pass `true` for default settings, or an object for fine-grained control
   * (see `weak-lru-cache` docs). Tends to help most with larger objects that
   * have significant deserialization costs.
   * @defaultValue `false`
   */
  cache?: boolean | Record<string, unknown>

  /**
   * Enable record versioning for optimistic locking.
   *
   * @remarks
   * Required for atomic conditional writes via `ifVersion`/`ifNoExists`
   * (used by {@link LmdbRepository.update} when wrapped in `env.transaction`).
   * @defaultValue `false`
   */
  useVersions?: boolean

  /**
   * Key encoding for sub-databases that need a specific key format.
   *
   * @remarks
   * - `ordered-binary` (default) — any JS primitive as key
   * - `uint32` — keys are strictly 32-bit unsigned integers (smaller, faster)
   * - `binary` — keys are raw Buffers/Uint8Arrays
   */
  keyEncoding?: `uint32` | `binary` | `ordered-binary`

  /**
   * Allow duplicate entries per key (dupSort).
   *
   * @remarks
   * Best used for index-style sub-databases where values represent keys
   * to other sub-databases. Recommended to use `keyEncoding: 'ordered-binary'`.
   */
  dupSort?: boolean

  /**
   * Maintain strict ordering of async transactions relative to async
   * single operations.
   *
   * @remarks
   * Adds ordering guarantees at the cost of more thread switching between
   * main thread and worker thread. Off by default.
   */
  strictAsyncOrder?: boolean

  /**
   * Milliseconds to wait for batching writes before committing.
   *
   * @remarks
   * `0` (default) commits immediately. Higher values trade latency for
   * more writes per transaction (higher throughput under load). Note that
   * Node.js timers have ~10ms effective resolution.
   * @defaultValue `0`
   */
  commitDelay?: number

  /**
   * Database page size in bytes.
   *
   * @remarks
   * Defaults to OS page size (usually 4096, or 16384 on MacOS M-series).
   * Use `8192` for databases larger than RAM with many range queries.
   * Only affects new databases.
   */
  pageSize?: number

  /**
   * Enable LMDB's overlapping-sync mode for durability.
   *
   * @remarks
   * Disk flushing happens off the write lock, allowing parallel writes.
   * Enabled by default on non-Windows. Not recommended on Windows.
   */
  overlappingSync?: boolean

  /**
   * Resolve writes when committed (visible) with a separate `flushed` promise
   * for durable sync.
   */
  separateFlushed?: boolean

  /**
   * Use dynamic memory mapping (frees mapped memory for other apps).
   *
   * @remarks
   * Slightly slower reads, friendlier to other applications. Enabled by default
   * on 32-bit systems.
   */
  remapChunks?: boolean

  /**
   * Skip zero-ing malloc'ed data on writes (small perf boost).
   *
   * @remarks
   * May leave application data in unused portions of the DB file. Safe unless
   * the DB files might be accessed by untrusted parties.
   */
  noMemInit?: boolean

  /**
   * Use writemaps for writes (reduced malloc calls + file writes).
   *
   * @remarks
   * Improves performance, but stray pointers can corrupt data. May be slower
   * on Windows. Combine with `noSync` for off-thread writes with no I/O.
   */
  useWritemap?: boolean

  /**
   * Treat `path` as a filename instead of directory.
   *
   * @remarks
   * Default when path contains an extension with `.`.
   */
  noSubdir?: boolean

  /**
   * Skip explicit flush-to-disk on commit.
   *
   * @remarks
   * Significantly faster writes, but a crash may cause data loss.
   * Use only for caches/temp data where durability is not required.
   */
  noSync?: boolean

  /**
   * Skip flushing metadata (less dangerous than `noSync`, less benefit).
   */
  noMetaSync?: boolean

  /**
   * Encryption key for at-rest encryption (ChaCha8 cipher).
   *
   * @remarks
   * Must be a string or Buffer of exactly 32 bytes/characters.
   */
  encryptionKey?: string | Buffer

  /**
   * Enable LMDB's event-turn batching of async writes.
   *
   * @remarks
   * Default `true`. All async writes in the same event turn share one commit.
   * Set `false` for lower-latency individual writes (then tune
   * `txnStartThreshold`).
   */
  eventTurnBatching?: boolean

  /**
   * Custom encoder instance for value serialization.
   *
   * @remarks
   * If set, overrides `encoding`. For advanced use cases (cbor-x, custom
   * binary formats). Most users should use `encoding` instead.
   */
  encoder?: unknown

  /**
   * Custom key encoder instance.
   *
   * @remarks
   * If set, overrides `keyEncoding`. For advanced use cases (UUIDs, custom
   * binary keys). Most users should use `keyEncoding` instead.
   */
  keyEncoder?: unknown
}

/**
 * LMDB compression options (passed as `compression` to override the boolean).
 *
 * @public
 */
export interface ICompressionOptions {
  /** Minimum entry size in bytes to compress. @defaultValue `1000` */
  threshold?: number
  /** Custom LZ4 dictionary buffer. @defaultValue built-in JSON/English dict */
  dictionary?: Buffer
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
  start?: ILmdbKey

  /** Upper bound (exclusive). Iteration stops before this key. */
  end?: ILmdbKey

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
  transaction?: Transaction
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
 * LMDB value encoding — passed to LMDB's native encoder when opening
 * a sub-database.
 *
 * @remarks
 * LMDB handles encoding natively per sub-database. The Repository's
 * optional `codec` (if defined) runs BEFORE LMDB encoding — use it only
 * for custom transforms (e.g. `Date → number`).
 *
 * - `msgpack` (default) — fastest, supports `Date`/`Map`/`Set`/BigInt via
 *   msgpackr structured-clone
 * - `json` — human-readable, no extra Codec needed; LMDB does
 *   `JSON.stringify`/`JSON.parse` natively (no double encoding)
 * - `string` — values must already be strings; LMDB stores as UTF-8
 * - `binary` — values must already be `Buffer`; LMDB stores raw bytes
 * - `ordered-binary` — values encoded with the same encoding as keys
 *   (useful for `dupSort` indexes)
 *
 * @public
 */
export type ILmdbEncoding = `msgpack` | `json` | `cbor` | `string` | `binary` | `ordered-binary`

/**
 * Lifecycle state of an {@link LmdbEnv}.
 *
 * @public
 */
export type ILmdbEnvState = `closed` | `opening` | `open` | `closing`
