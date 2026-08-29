/**
 * Shared types for `@gramstax/lmdb`.
 *
 * @remarks
 * Types are intentionally minimal — only the shapes that appear at public
 * API boundaries. Internal helpers keep their types private to their modules.
 *
 */

import type {IEnvForSub} from "./env"
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
 * tuned for the collection use case.
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
   * Each registered collection typically owns one sub-database. Set this to at
   * least the number of collections you intend to register.
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
   * (used by `env.update` when wrapped in `env.transaction`).
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
 * by {@link LmdbEnv} to bind the range query to a read transaction for
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
   * coll.entries({start: `k1`, end: `k3`})
   *
   * // same range but with inclusiveEnd: returns "k1", "k2", "k3"
   * coll.entries({start: `k1`, end: `k3`, inclusiveEnd: true})
   * ```
   */
  inclusiveEnd?: boolean

  /**
   * Exclude `start` from the results (default `false`).
   *
   * @example
   * ```typescript
   * // keys "k1", "k2", "k3" — returns "k1", "k2", "k3"
   * coll.entries({start: `k1`, end: `k3`})
   *
   * // same range but with exclusiveStart: returns "k2", "k3"
   * coll.entries({start: `k1`, end: `k3`, exclusiveStart: true})
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
   * {@link LmdbEnv} when a transaction wrapper is passed).
   *
   * @internal
   */
  transaction?: Transaction
}

/**
 * A write/read hook pair used by {@link LmdbEnv} for custom transforms.
 *
 * @remarks
 * Default encoding (lmdb-js native) is msgpack/JSON/etc. Use this to
 * transform rows at the repository boundary — `hookBeforeWrite` runs
 * before LMDB serializes the value, `hookBeforeRead` after it deserializes
 * it (e.g. `Date → number`). This runs BEFORE the native LMDB encoding.
 *
 * @public
 */
export interface ICodec<T> {
  /** Convert a typed value to a storable representation. */
  hookBeforeWrite(value: T): unknown

  /** Convert a stored representation back to a typed value. */
  hookBeforeRead(raw: unknown): T
}

/**
 * LMDB value encoding — passed to LMDB's native encoder when opening
 * a sub-database.
 *
 * @remarks
 * LMDB handles encoding natively per sub-database. The collection's
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

/**
 * Declarative embedded secondary index definition.
 *
 * @remarks
 * Declared via `static indexes` on a schema class:
 *
 * ```typescript
 * class UserSchema extends LmdbSchema {
 *   static db = `user`;
 *   static indexes = {
 *     email: {unique: true},            // auto-resolved field `user.email`
 *     emailLower: {extractor: (u) => u.email.toLowerCase()},
 *     profileCity: {dbName: `user:idx:city`}  // dotted path, custom dbName
 *   } as const;
 * }
 * ```
 *
 * When `extractor` is omitted the index name is treated as a field path on
 * the value (`username` → `value.username`, `profile.email` →
 * `value.profile.email`). A missing field path throws {@link LmdbError} on
 * the first write; a resolved `undefined`/`null` value skips the entry.
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam K - Key type of the index sub-DB (the indexed field's value type).
 *
 * @public
 */
export interface IIndexDef<T, K extends ILmdbKey = ILmdbKey> {
  /**
   * Extract the indexed value from a primary value.
   *
   * @remarks
   * Returning `undefined`/`null` skips the index entry. When omitted, the
   * index name is auto-resolved as a (possibly dotted) field path.
   */
  extractor?: (value: T) => K | undefined | null

  /**
   * Enforce uniqueness on this index.
   *
   * @remarks
   * `true` → SQL `CREATE UNIQUE INDEX`: a write whose index value is already
   * owned by a different primary key throws {@link LmdbUniqueConstraintError}
   * and rolls back. `false` (default) → SQL `CREATE INDEX` (duplicates allowed).
   * @defaultValue `false`
   */
  unique?: boolean

  /**
   * Override the auto-generated index sub-DB name.
   *
   * @remarks
   * Default is `` `${dbName}:idx:${name}` `` (Q3). Must not collide with any
   * other registered sub-DB name.
   */
  dbName?: string
}

/**
 * Declarative index definition map: `static indexes` shape.
 *
 * @remarks
 * `Record<string, IIndexDef<T, ILmdbKey>>` — every declared index name maps to
 * its {@link IIndexDef}. Used as the third type parameter of
 * a schema class so the subclass can bind its own `static indexes`
 * type: `class UserSchema extends LmdbSchema` with `static value` columns.
 *
 * @typeParam T - Value type of the primary collection.
 *
 * @public
 */
export type IIndexDefs<T = unknown> = Record<string, IIndexDef<T, ILmdbKey>>

/**
 * Value type of a single index key inside {@link IIndexQuery}.
 *
 * @remarks
 * Resolves to the indexed field's type when the index name is an auto-resolved
 * field path on `T` (`username` → `T["username"]`); otherwise falls back to
 * {@link ILmdbKey} (explicit extractors may index arbitrary key-shaped values).
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam P - Declared index name (a key of `static indexes`).
 *
 * @public
 */
export type IndexQueryValue<T, P extends string> = P extends keyof T ? T[P] : ILmdbKey

/**
 * Object query accepted by {@link LmdbEnv.findByIndex}: maps declared
 * index names to the values to match. Every supplied key is ANDed.
 *
 * @remarks
 * At least one key is required — the intersection term forces a non-empty
 * query, so `{}` is a compile-time error. The index definitions come from the
 * schema's index map type: `SchemaIndexesOf<typeof UserSchema[`value`]>`
 * with `static indexes` declared `as const` (so `unique: true` survives as a
 * literal type); without the self-reference or `as const`, queries still type
 * but the return type degrades to `T[]` for every query (runtime unchanged).
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam I - The collection's `static indexes` type.
 *
 * @public
 */
export type IIndexQuery<T, I> = Partial<{[P in keyof I]: IndexQueryValue<T, P & string>}> & {[P in keyof I]-?: Record<P, IndexQueryValue<T, P & string>>}[keyof I]

/**
 * Return type of {@link LmdbEnv.findByIndex} for a given query.
 *
 * @remarks
 * `T | undefined` when EVERY queried index is unique (`unique: true` — at
 * most one primary key can match, so a miss is `undefined`); `T[]` when ANY
 * queried index is non-unique (several primaries may share the value, so a
 * miss is an empty array).
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam I - The collection's `static indexes` type.
 * @typeParam Q - The concrete query type.
 *
 * @public
 */
export type IIndexResult<T, I, Q> = AllKeysUnique<I, Q> extends true ? T | undefined : T[]

/**
 * Whether every key present in query `Q` names a `unique: true` index.
 *
 * @remarks
 * `false` for empty queries and for queries touching any non-unique index.
 * With `as const` on `static indexes`, `unique: true` is a literal type and
 * the check resolves statically; without it the index definitions widen to
 * `IIndexDef` and every query reports `false` (degrades to `T[]`).
 *
 * @internal
 */
type AllKeysUnique<I, Q> = Extract<keyof Q, keyof I> extends never ? false : {[P in Extract<keyof Q, keyof I>]: I[P] extends {unique: true} ? true : false}[Extract<keyof Q, keyof I>] extends true ? true : false

/** Hard cap on how many entries a materializing range query may return. */
export const MAX_MATERIALIZE = 100_000

/** Runtime shape of one attached embedded-index descriptor. */
export type IndexDescriptor = {
  name: string
  extractor: (value: unknown) => ILmdbKey | undefined | null
  unique: boolean
  /** State of the index's backing sub-DB (unique: plain map; non-unique: dupSort). */
  state: LmdbSubState
  autoResolved: boolean
}

/**
 * Per-sub-DB state kept by {@link LmdbEnvSubManager}.
 *
 * @internal
 */
export type LmdbSubState = {
  dbName: string
  /** Sub-DB handle combined with root-env methods — the same shape the sub handle operates on. */
  env: IEnvForSub
  /** Optional write/read hook pair (schema `hookBeforeWrite`/`hookBeforeRead` bridge). */
  codec?: ICodec<unknown>
  /** Pre-resolved read hook — decided once per state. */
  hookBeforeRead: (raw: unknown) => unknown
  /** Attached embedded-index descriptors. */
  indexes: IndexDescriptor[]
  /** O(1) index-name → descriptor lookup (built alongside `indexes`). */
  indexByName: Map<string, IndexDescriptor>
  /** Cached key-type probe result (plan 007 P1). */
  keyType?: `string` | `buffer` | `number` | `empty`
  /** Sub-DB flags + codec — mirrors the old collection constructor opts. */
  opts: {
    dupSort: boolean
    useVersions: boolean
    encoding?: string
    codec?: ICodec<unknown>
  }
  /** Whether this collection is a TTL collection (envelope-wrapped). */
  isTtl: boolean
  /** Collection-wide default TTL in ms (only when `isTtl`). */
  ttlMs?: number
}

