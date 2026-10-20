import type {Key, RootDatabase} from "lmdb"
import type {LmdbEnv} from "../env"
import type {LmdbSchema} from "../schema"

/**
 * Row-rewrite step for `IMigration.transform`.
 *
 * @remarks
 * `map` MUST be idempotent — crashed steps rerun from scratch, so rows may
 * be rewritten twice. It receives the current row type; older-shaped rows
 * present `undefined` for newer fields, so code defensively. TTL subs are
 * re-stamped with default expiry (per-row envelopes are not preserved).
 * Annotate the parameter explicitly (e.g. `(row: UserRow) => ...`) — the
 * `never` parameter type accepts any concrete row type without casts.
 *
 * @public
 */
export interface ITransformStep {
  /**
   * Target sub's schema (must be registered).
   */
  schema: typeof LmdbSchema
  /**
   * Schema shape version this step produces — checked against the schema's
   * `static version` when declared (mismatch throws `LmdbError`).
   */
  schemaVersion?: number
  /**
   * Rewrite a row (idempotent — reruns re-apply after crashes).
   */
  map: (row: never) => unknown
  /**
   * Progress per committed 500-row chunk.
   */
  onProgress?: (done: number, total: number) => void
}

/**
 * A single schema migration step.
 *
 * @public
 */
export interface IMigration {
  /**
   * Monotonic version number — must be unique across the array passed to {@link LmdbEnv.migrate}.
   */
  version: number
  /**
   * Human-readable name for logging / history.
   */
  name: string
  /**
   * Migration logic — receives the owning {@link LmdbEnv} so it can use
   * registered subs (`env.sub(SomeSchema)`). The runner executes each `up`
   * inside its own writer transaction and bumps the stored version only on
   * success. Runs after `transform` when both are present.
   */
  up?: (env: LmdbEnv) => Promise<void> | void
  /**
   * Declarative row rewrite over a sub (chunked, resumable, progress).
   */
  transform?: ITransformStep
}

/**
 * Map usage snapshot returned by {@link LmdbEnv.getMapSizeUsed}.
 * @public
 */
export interface IMapUsage {
  /**
   * Configured virtual map size in bytes.
   */
  total: number
  /**
   * Current on-disk size of the LMDB data file in bytes.
   */
  used: number
  /**
   * `total - used`, floored at 0.
   */
  free: number
  /**
   * `free / total` — `1` when the data file cannot be measured.
   */
  ratio: number
}

/**
 * Per-instance root store type.
 *
 * @remarks
 * Wraps lmdb's `RootDatabase` with additional runtime methods that exist
 * on the prototype but are absent from the published type declarations
 * (`sync`, `isOperational`).
 *
 * @internal
 */
export interface IRootStore extends RootDatabase<unknown, Key> {
  sync(callback?: (error: unknown) => void): Promise<void>
  isOperational(): boolean
  off(event: `beforecommit` | `aftercommit`, callback: (event: unknown) => void): void
}

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
  /**
   * Filesystem path where LMDB will store its data files.
   */
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

  /**
   * Sink for the package's own diagnostics (default: none — silent).
   *
   * @remarks
   * This library never writes to `console`; where would a warning go is the
   * host application's decision, not the package's. Unattached diagnostics are
   * dropped silently.
   *
   * Receives, among others:
   * - `maxDbs` headroom running low (once per env),
   * - a CDC subscriber callback that threw,
   * - a scheduled job tick that failed, unless the job was given its own
   *   `onError`.
   *
   * A listener that throws is contained — it cannot break a commit or a tick.
   * Equivalent to {@link LmdbEnv.onWarn}, which binds later.
   *
   * @example
   * ```typescript
   * const env = new LmdbEnv({path, maxDbs: 128, onWarn: (message) => log.warn(message)})
   * ```
   *
   * @public
   */
  onWarn?: (message: string) => void
}

/**
 * LMDB compression options (passed as `compression` to override the boolean).
 *
 * @public
 */
export interface ICompressionOptions {
  /**
   * Minimum entry size in bytes to compress.
   *
   * @defaultValue `1000`
   */
  threshold?: number
  /**
   * Custom LZ4 dictionary buffer.
   *
   * @defaultValue built-in JSON/English dict
   */
  dictionary?: Buffer
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
