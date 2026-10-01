import {statSync} from "node:fs"
import {basename, extname, join} from "node:path"
import type {Database, DatabaseOptions, GetOptions, Key, PutOptions, RangeIterable, RangeOptions, RootDatabaseOptionsWithPath, TransactionFlags} from "lmdb"
import * as lmdbModule from "lmdb"
import {ABORT, open} from "lmdb"
import type {ICdcCallback, ICdcFilter, ICdcRecord, ICdcTailOptions} from "./cdc"
import {Cdc} from "./cdc"
import {LmdbError} from "./errors"
import type {LmdbSchema} from "./schema"
import type {LmdbEnvSub} from "./sub"
import {LmdbEnvSubManager} from "./sub-manager"
import {LmdbTransaction} from "./transaction"
import type {ILmdbEncoding, ILmdbEnvOptions, ILmdbEnvState, IMapUsage, IMigration, IRootStore, ITransformStep} from "./types/env"
import type {IIndexDef} from "./types/indexes"
import type {ILmdbKey} from "./types/key"

/**
 * lmdb-js's module-level handle registry.
 *
 * @remarks
 * Tracked via a runtime export absent from its d.ts; lmdb-js never deletes
 * entries, so this wrapper purges its own keys on close.
 */
const allDbsFromLmdb = (lmdbModule as unknown as {allDbs?: Map<string, unknown>}).allDbs ?? new Map<string, unknown>()

/**
 * The root handle for one LMDB environment and its registered subs.
 *
 * @remarks
 * One env per process is the common pattern (LMDB is designed for
 * single-writer / multi-reader). The env lazily opens sub-databases on
 * first access and caches them inside lmdb-js's native store layer.
 *
 * Each instance owns a **private per-instance** lmdb root store (built via
 * `openAsClass` in the constructor) so that sub-database (`openDB`) handle
 * caches are naturally isolated across envs — lmdb-js caches handles on the
 * store instance, and a single shared base class would leak handles across
 * envs in the same process. Native store methods (`transaction`, `openDB`,
 * `close`, `backup`, etc.) are forwarded explicitly.
 *
 * Collection operations are NOT on this class — register a schema class to
 * get a typed {@link LmdbEnvSub} handle, or use {@link LmdbEnv.sub} to
 * fetch an already-registered one.
 *
 * @public
 */
export class LmdbEnv {
  /**
   * Internal sub-DB holding the migration version plus per-step markers.
   *
   * @internal
   */
  private static readonly _MIGRATIONS_DB = `__migrations`
  /**
   * Meta key for the applied migration version.
   *
   * @internal
   */
  private static readonly _VERSION_KEY = `__version`
  /**
   * Meta key prefix for per-step transform completion markers.
   *
   * @internal
   */
  private static readonly _TRANSFORM_PREFIX = `transform:`

  /**
   * Current lifecycle state (`open` | `closing` | `closed`).
   *
   * @internal
   */
  private _state: ILmdbEnvState = `open`

  /**
   * Serializes concurrent write transactions.
   *
   * @remarks
   * Prevents lmdb-js child-txn nesting, where an outer abort would roll back
   * an inner txn's already-"committed" writes.
   *
   * @internal
   */
  private _txQueue: Promise<unknown> = Promise.resolve()

  /**
   * True while a transaction callback is executing (nesting detection).
   *
   * @internal
   */
  private _txInProgress = false

  /**
   * Per-instance lmdb root store.
   *
   * @remarks
   * Isolates sub-DB handle caches across envs in the same process.
   *
   * @internal
   */
  private readonly _root: IRootStore

  /**
   * Sub registry plus state factory.
   *
   * @internal
   */
  private readonly _subs: LmdbEnvSubManager

  /**
   * Configured virtual map size in bytes.
   *
   * @remarks
   * Used by {@link getMapSizeUsed} to report usage against the cap.
   *
   * @internal
   */
  private readonly _mapSize: number

  /**
   * Sub-DB options extracted from env options.
   *
   * @remarks
   * Forwarded to every `openDB` call, since lmdb does not inherit them
   * from the root env.
   *
   * @internal
   */
  private readonly _dbOpts: DatabaseOptions

  /**
   * Sub-DB handle cache (one LMDBStore wrapper per name plus encoding).
   *
   * @internal
   */
  private readonly _subDbCache = new Map<string, Database<unknown, Key>>()

  /**
   * Sub-DB handles opened via this env.
   *
   * @remarks
   * Used to purge this env's entries from lmdb-js `allDbs` on close.
   *
   * @internal
   */
  private readonly _subDbNames = new Map<string, Database<unknown, Key>>()

  /**
   * Commit-event listeners (user callback to registered wrapper).
   *
   * @internal
   */
  private readonly _commitListeners = new Map<`beforecommit` | `aftercommit`, Map<(event: unknown) => void, (event: unknown) => void>>()

  /**
   * Path where LMDB stores its data files.
   *
   * @public
   */
  readonly path: string

  /**
   * Maximum number of sub-databases.
   *
   * @remarks
   * Mirrors {@link ILmdbEnvOptions.maxDbs}.
   *
   * @public
   */
  readonly maxDbs: number

  /**
   * Whether the env is read-only.
   *
   * @remarks
   * Mirrors {@link ILmdbEnvOptions.readOnly}.
   *
   * @public
   */
  readonly readOnly: boolean

  /**
   * Default LMDB value encoding for all sub-DBs.
   *
   * @remarks
   * Mirrors {@link ILmdbEnvOptions.encoding}.
   *
   * @public
   */
  readonly encoding: ILmdbEncoding | undefined

  /**
   * Whether record versioning is enabled.
   *
   * @remarks
   * Mirrors {@link ILmdbEnvOptions.useVersions}.
   *
   * @public
   */
  readonly useVersions: boolean

  /**
   * Construct a new LmdbEnv and open the underlying LMDB environment.
   *
   * @remarks
   * Construction opens the env immediately. The `path` is required and
   * flows through to lmdb's native `open()`. No explicit `open()` call
   * is needed. Defaults: `mapSize` = 4 GB (`4 * 1024 * 1024 * 1024` bytes), `maxDbs` = 128.
   *
   * @param options - Env configuration. Supports the full set of LMDB
   * `open()` parameters via {@link ILmdbEnvOptions}.
   *
   * @example
   * ```typescript
   * // Default — LMDB native msgpack
   * const env = new LmdbEnv({ path: "./data" });
   *
   * // Human-readable JSON storage
   * const env = new LmdbEnv({ path: "./data", encoding: "json" });
   *
   * // With compression + custom page size
   * const env = new LmdbEnv({
   *   path: "./data",
   *   compression: true,
   *   pageSize: 8192
   * });
   * ```
   *
   * @public
   */
  constructor(options: ILmdbEnvOptions) {
    const mapSize = options.mapSize ?? 4 * 1024 * 1024 * 1024
    const maxDbs = options.maxDbs ?? 128
    const opts: RootDatabaseOptionsWithPath = {
      ...(options as unknown as RootDatabaseOptionsWithPath),
      mapSize,
      maxDbs,
      sharedStructuresKey: Symbol.for(`global-structure`)
    } as unknown as RootDatabaseOptionsWithPath
    // Per-instance root store. Each env calls open() independently so
    // sub-database handle caches are naturally isolated across envs.
    this._root = open(opts) as unknown as IRootStore
    this.path = options.path
    this.maxDbs = maxDbs
    this._mapSize = mapSize
    this.readOnly = options.readOnly ?? false
    this.encoding = options.encoding
    this.useVersions = options.useVersions ?? false

    // Extract sub-DB options that lmdb does NOT inherit from the root env.
    // These must be forwarded explicitly to every openDB() call.
    this._dbOpts = {
      ...(options.compression !== undefined && {compression: options.compression}),
      ...(options.cache !== undefined && {cache: options.cache}),
      ...(options.encoding !== undefined && {encoding: options.encoding as unknown as DatabaseOptions[`encoding`]}),
      ...(options.useVersions !== undefined && {useVersions: options.useVersions}),
      ...(options.keyEncoding !== undefined && {keyEncoding: options.keyEncoding}),
      ...(options.dupSort !== undefined && {dupSort: options.dupSort}),
      ...(options.strictAsyncOrder !== undefined && {strictAsyncOrder: options.strictAsyncOrder})
    } as DatabaseOptions

    this._subs = new LmdbEnvSubManager(this)
  }

  // ──────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────

  /**
   * Current lifecycle state of this env.
   *
   * @remarks
   * The env opens on construction, so `state` is `'open'` immediately after
   * `new LmdbEnv(...)`. After {@link close} it becomes `'closed'`.
   *
   * @public
   */
  get state(): ILmdbEnvState {
    return this._state
  }

  /**
   * Guard: require the env to be open before an operation.
   *
   * @remarks
   * Throws {@link LmdbError} when the env was closed (permanent),
   * or {@link LmdbError} for any other non-open state.
   *
   * @internal
   */
  private _assertOpen(): void {
    if (this._state === `closed`) throw new LmdbError(`LmdbEnv has been closed and cannot be reused. Create a new instance.`)
    if (this._state !== `open`) throw new LmdbError(`LmdbEnv is not open. The env must be in 'open' state before performing operations.`)
  }

  /**
   * Close the underlying LMDB environment and release all resources.
   *
   * @remarks
   * Delegates to the inherited lmdb root store `close()` (awaitable), then
   * clears the sub registry and purges this env's handles from
   * lmdb-js's module-level `allDbs` map so repeated open/close cycles do
   * not accumulate JS store wrappers for the process lifetime. Handles
   * obtained via {@link register} become unusable after close.
   *
   * @public
   */
  async close(): Promise<void> {
    if (this._state === `closed`) return
    this._state = `closing`
    try {
      await this._root.close()
    } finally {
      // Always land on a terminal state — even if the native close rejects,
      // subsequent calls must no-op instead of getting stuck in `closing`.
      this._state = `closed`

      this._subDbCache.clear()
      this._removeAllCommitListeners()
      this._purgeAllDbs()
    }
  }

  /**
   * Remove handles for this env from lmdb-js's module-level `allDbs` map.
   *
   * @internal
   */
  private _purgeAllDbs(): void {
    const key = this._lmdbKeyName()
    // Identity check: only delete if the entry belongs to THIS env, so
    // closing one env does not corrupt another env with the same basename
    // (C1 — cross-env allDbs collision fix).
    if (allDbsFromLmdb.get(key) === this._root) {
      allDbsFromLmdb.delete(key)
    }
    for (const [dbName, db] of this._subDbNames) {
      const entryKey = `${key}-${dbName}`
      if (allDbsFromLmdb.get(entryKey) === db) {
        allDbsFromLmdb.delete(entryKey)
      }
    }
  }

  /**
   * Compute this env's key inside lmdb-js's `allDbs` map.
   *
   * @remarks
   * lmdb-js derives it as `basename(path, extname(path))`.
   *
   * @returns The registry key for this env's root handle.
   *
   * @internal
   */
  private _lmdbKeyName(): string {
    const ext = extname(this.path)
    return basename(this.path, ext)
  }

  // ──────────────────────────────────────────────────────────────────
  // Sub-database access
  // ──────────────────────────────────────────────────────────────────

  /**
   * Get or create a sub-database by name.
   *
   * @remarks
   * Low-level. Most callers should use {@link register} to obtain a typed
   * {@link LmdbEnvSub} handle instead. Delegates to the inherited lmdb
   * `openDB(name, opts)` — lmdb-js caches per-name handles internally.
   *
   * @param name - Sub-database name.
   * @param overrideEncoding - LMDB native value encoding (`msgpack`/`json`/`binary`/`string`).
   * @returns The LMDB sub-database handle.
   *
   * @internal
   */
  getDb(name: string, overrides?: ILmdbEncoding | DatabaseOptions): Database<unknown, Key> {
    this._assertOpen()
    const overridesObj: DatabaseOptions = (typeof overrides === `string` ? {encoding: overrides} : ((overrides ?? {}) as DatabaseOptions)) as DatabaseOptions
    const encoding = (overridesObj.encoding as ILmdbEncoding | undefined) ?? this.encoding
    const dupSort = overridesObj.dupSort as boolean | undefined
    // Cache per (name, encoding, dupSort)
    const cacheKey = `${name}\u0000${encoding ?? ``}\u0000${dupSort ? `dupSort` : ``}`
    const cached = this._subDbCache.get(cacheKey)
    if (cached) return cached
    // Forward all env-level sub-DB options. lmdb does NOT inherit
    // compression/cache/encoding/etc. from the root env — each openDB()
    // must receive them explicitly for production correctness.
    const openOpts: DatabaseOptions = {...this._dbOpts, ...(overridesObj as DatabaseOptions)}
    if (encoding) (openOpts as unknown as {encoding: ILmdbEncoding}).encoding = encoding
    if (dupSort !== undefined) openOpts.dupSort = dupSort
    const db = this._root.openDB(name, openOpts)
    this._subDbCache.set(cacheKey, db)
    this._subDbNames.set(name, db)
    return db
  }

  // ──────────────────────────────────────────────────────────────────
  // Sub registration
  // ──────────────────────────────────────────────────────────────────

  /**
   * Register a {@link LmdbSchema} subclass as a sub-DB collection.
   *
   * @remarks
   * Validates the schema, materializes the sub-DB state through the internal
   * {@link LmdbEnvSubManager} (no anonymous-class synthesis, no
   * class-registration re-entry): the schema's `static db` becomes the sub-DB
   * name, and its derived indexes (from `static value`, via
   * {@link LmdbSchema.deriveIndexes}) are attached at registration. Optional
   * `static hookBeforeWrite`/`static hookBeforeRead` transforms are forwarded as the sub's
   * codec, and `static ttl` (ms) materializes a TTL sub — per-put `{ttlMs}`
   * overrides still apply. The returned handle is typed from the schema
   * class — value type via {@link ValueOf}, key type via {@link KeyOf}, and
   * the index map via {@link SchemaIndexesOf} — so `findByIndex({name:
   * value})` queries type-check against the declared index names.
   *
   * Registration is STRICT: re-registering the same schema class throws
   * {@link LmdbError}, and a schema whose `static db`
   * is already taken throws {@link LmdbError}. `register` is
   * the ONLY registration path.
   *
   * @param schemaClass - The {@link LmdbSchema} subclass.
   * @returns A typed {@link LmdbEnvSub} handle bound to the schema — cached,
   * so `env.register(Schema) === env.sub(Schema)`.
   *
   * @throws {LmdbError} When the schema fails {@link LmdbSchema.validate}
   * (missing `db`/`key`/`value`, encode without decode or vice versa, a
   * unique or indexed `key`, duplicate index names).
   * @throws {@link LmdbError} if the same schema class is registered twice.
   * @throws {@link LmdbError} if another sub uses the same `db`.
   *
   * @example
   * ```typescript
   * class UserSchema extends LmdbSchema {
   *   static db = `users`
   *   static key = t.number()
   *   static value = {id: t.number().unique(), username: t.string().index()}
   * }
   * const users = env.register(UserSchema)
   * ```
   *
   * @public
   */
  register<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S> {
    this._assertOpen()
    return this._subs.register(schemaClass)
  }

  /**
   * Get the cached handle for an already-registered schema class.
   *
   * @param schemaClass - The {@link LmdbSchema} subclass.
   * @returns The cached {@link LmdbEnvSub} handle — the same instance
   * `register` returned.
   * @throws {LmdbError} when the schema is not registered.
   *
   * @public
   */
  sub<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S> {
    this._assertOpen()
    return this._subs.sub(schemaClass)
  }

  /**
   * Check whether a LmdbSchema class has been registered.
   *
   * @param schemaClass - The LmdbSchema subclass constructor.
   * @returns `true` if registered, `false` otherwise.
   *
   * @public
   */
  isRegistered(schemaClass: typeof LmdbSchema): boolean {
    return this._subs.isRegistered(schemaClass)
  }

  /**
   * Attach embedded-index descriptors to an already-registered sub.
   *
   * @remarks
   * Internal — used by tests that need custom extractors schemas cannot
   * express. The sub-DB must already be registered.
   *
   * @internal
   */
  _attachIndexes(dbName: string, defs: Array<{name: string; def: IIndexDef<unknown, ILmdbKey>; dbName: string}>): void {
    this._subs.attachIndexes(dbName, defs)
  }

  // ──────────────────────────────────────────────────────────────────
  // Change-data-capture
  // ──────────────────────────────────────────────────────────────────

  /**
   * Subscribe to committed writes on a sub-DB.
   *
   * @remarks
   * Delivery rides the `aftercommit` tail: events fire only for committed
   * transactions (aborts publish nothing), in outbox sequence order.
   * Subscriptions are from-now — earlier history is available via
   * {@link LmdbEnv.tailCdc}. Returns an idempotent unsubscribe; the last
   * unsubscribe detaches the commit hook.
   *
   * @param filter - Sub-DB name, or `{db, op?}` to narrow the operation.
   * @param cb - Invoked per matching event as `{type, key, value}`.
   * @returns Unsubscribe function.
   * @throws {LmdbError} On malformed filters.
   * @public
   */
  subscribe(filter: ICdcFilter, cb: ICdcCallback): () => void {
    return Cdc.for(this).hub.subscribe(filter, cb)
  }

  /**
   * Tail the durable outbox above a floor.
   *
   * @remarks
   * A named consumer auto-registers on first tail and resumes past its ack
   * on later tails (including across restarts — acks persist in
   * `__cdc_meta`). An explicit `from` repositions forward past the ack but
   * never backward. Returns `{seq, db, type, key, value}` records for
   * {@link LmdbEnv.ackCdc}.
   *
   * @param options - `{consumer?, from?, limit?}`.
   * @returns Outbox records above the floor, oldest first.
   * @public
   */
  async tailCdc(options?: ICdcTailOptions): Promise<Array<ICdcRecord>> {
    return Cdc.for(this).hub.tail(options)
  }

  /**
   * Persist a consumer's position in the outbox.
   *
   * @param consumer - Name previously registered by {@link LmdbEnv.tailCdc}.
   * @param seq - Last consumed sequence.
   * @throws {LmdbError} For unknown consumers.
   * @public
   */
  async ackCdc(consumer: string, seq: number): Promise<void> {
    return Cdc.for(this).hub.ack(consumer, seq)
  }

  /**
   * Delete outbox records at or below the retention cutoff.
   *
   * @remarks
   * Cutoff is `min(minAck, newest - keep)`: entries consumed by every
   * registered consumer go, the newest `keep` entries always stay, and an
   * unacked consumer blocks pruning below its start. With no consumers the
   * keep window alone bounds growth — call periodically (like
   * `purgeExpired`) when producing without persistent followers.
   *
   * @param keep - Newest entries to retain regardless of acks (default `10000`).
   * @returns The number of records removed.
   * @throws {LmdbError} On negative keeps.
   * @public
   */
  pruneCdc(keep?: number): Promise<number> {
    const {store, hub} = Cdc.for(this)
    hub.activate()
    return store.prune(keep)
  }

  // ──────────────────────────────────────────────────────────────────
  // Transactions
  // ──────────────────────────────────────────────────────────────────

  /**
   * Run a callback inside a write transaction.
   *
   * @remarks
   * **SQL equivalent**:
   * ```sql
   * BEGIN;
   * -- <writes performed via sub.put() inside fn>
   * COMMIT;  -- on tx.commit() or callback return
   * -- ROLLBACK;  -- on tx.abort() or callback throw
   * ```
   * Wraps the inherited root-store `transaction(callback)`. All writes
   * performed by any sub-database inside the callback are batched into a
   * single atomic commit. If the callback resolves, the transaction is
   * committed. If it throws, the transaction is rolled back. If the
   * callback calls {@link LmdbTransaction.abort} on the wrapper, the wrapper
   * throws an internal abort error which rolls back the transaction.
   *
   * **Sync callback is strongly recommended.** The callback runs inside
   * lmdb-js's native write lock. An `async` callback yields to the event
   * loop, creating a microtask boundary — lmdb-js may flush the pending
   * writes before your next `await` completes, breaking the batching. A
   * sync callback keeps all writes in the same event turn, so lmdb-js
   * coalesces them into a single native LMDB write transaction. Sub
   * methods are non-async, making sync callbacks natural.
   *
   * The callback promise MUST settle: the native write transaction (and the
   * single writer lock) stays open until it does — a never-resolving promise
   * blocks all subsequent writes process-wide.
   *
   * @param fn - Callback receiving the {@link LmdbTransaction} wrapper.
   * @returns The callback's resolved value.
   *
   * @throws {@link LmdbError} if the env is read-only.
   *
   * @example
   * ```typescript
   * // ✅ Sync callback — recommended. All writes coalesced into one native
   * //    LMDB write transaction. Sub methods return Promise directly
   * //    without async wrapper, so no await is needed inside the callback.
   * const result = await env.transaction(() => {
   *   users.put("u1", user);
   *   sessions.put("s1", session);
   *   return { ok: true };
   * });
   * ```
   *
   * @public
   */
  async transaction<T>(fn: (tx: LmdbTransaction) => T | Promise<T>): Promise<T> {
    this._assertOpen()
    if (this.readOnly) throw new LmdbError(`Cannot perform 'transaction' on a read-only env.`)
    // Nesting (called from inside another transaction callback): run directly.
    // lmdb-js treats this as a child txn of the active write transaction.
    if (this._txInProgress) {
      return this._runTransaction(fn)
    }
    // Concurrent transactions are serialized: without this, lmdb-js nests the
    // second transactionSync inside the first via childTransaction(), so an
    // outer abort rolls back the inner txn's already-"committed" writes.
    const run = this._txQueue.then(() => this._runTransaction(fn))
    this._txQueue = run.catch(() => undefined)
    return run
  }

  /**
   * Publish staged CDC events after an outermost commit.
   *
   * @remarks
   * No-op without subscribers; nested completions skip it — only the
   * outermost frame drains.
   *
   * @internal
   */
  private _drainCdc(): void {
    Cdc.for(this).hub.drain()
  }

  /**
   * Execute a callback inside the native write transaction.
   *
   * @remarks
   * Nested calls join the outer transaction (no separate commit); only the
   * outermost completion publishes staged CDC events. Callback throws other
   * than the internal abort sentinel surface as `LmdbError` carrying the
   * original error as `cause`.
   *
   * @param fn - Callback receiving the {@link LmdbTransaction} wrapper.
   * @returns The callback's resolved value.
   *
   * @internal
   */
  private async _runTransaction<T>(fn: (tx: LmdbTransaction) => T | Promise<T>): Promise<T> {
    const tx = new LmdbTransaction()
    let syncResult: T | undefined
    let abortedValue: T | undefined

    // Nested calls join the outer txn (no separate commit) — only the
    // outermost completion publishes staged CDC events.
    const nested = this._txInProgress
    this._txInProgress = true
    try {
      const result = this._root.transactionSync(() => {
        const userResult = fn(tx)
        if (userResult && typeof (userResult as Promise<T>).then === `function`) {
          // Async callback: lmdb-js `when()` holds the native write txn open
          // until this promise settles, then commits — or aborts when it
          // resolves to the ABORT sentinel. Detect abort AFTER resolution so
          // `tx.abort()` following an `await` rolls back instead of silently
          // committing the writes queued so far.
          return (userResult as Promise<T>).then((value) => {
            abortedValue = value as T
            return tx.isAborted ? ABORT : value
          })
        }
        syncResult = userResult as T
        if (tx.isAborted) throw ABORT
        return userResult
      })
      if (result && typeof (result as Promise<T>).then === `function`) {
        const final = (await result) as T | typeof ABORT
        if (final === ABORT) return abortedValue as T
        if (!nested) this._drainCdc()
        return final as T
      }
      if (!nested) this._drainCdc()
      return result as T
    } catch (err) {
      if (err === ABORT) {
        return syncResult as T
      }
      throw new LmdbError(`Transaction failed`, err instanceof Error ? {cause: err} : undefined)
    } finally {
      // Reset only for the outermost frame — a nested completion must not
      // clear the flag while the outer transaction still runs (that hole
      // also deadlocked queued nested transactions and published early).
      if (!nested) this._txInProgress = false
    }
  }

  /**
   * Run a callback inside a read-only transaction.
   *
   * @remarks
   * **SQL equivalent**:
   * ```sql
   * START TRANSACTION READ ONLY;
   * -- <reads performed via sub.get/has/keys/values/entries/iterate inside fn>
   * COMMIT;
   * ```
   * Obtains a read transaction via the inherited root-store
   * `useReadTransaction()` and wraps it in a {@link LmdbTransaction} that
   * auto-releases when the callback returns. All reads inside the callback
   * see a consistent snapshot.
   *
   * The callback MUST settle: the raw read transaction (and one of the env's
   * limited reader slots, default 126) stays pinned until it does — a
   * never-resolving promise can exhaust readers for the whole env.
   *
   * @param fn - Callback receiving the read-only {@link LmdbTransaction}.
   * @returns The callback's resolved value.
   *
   * @example
   * ```typescript
   * const snapshot = await env.readTransaction(async (tx) => {
   *   return await users.entries({}, tx);
   * });
   * ```
   *
   * @public
   */
  async readTransaction<T>(fn: (tx: LmdbTransaction) => Promise<T>): Promise<T> {
    this._assertOpen()

    const rawTxn = this._root.useReadTransaction()
    const tx = new LmdbTransaction(rawTxn)

    try {
      const result = await fn(tx)
      tx.release() // mark released + rawTxn.done()
      return result
    } catch (err) {
      try {
        tx.abort()
      } catch {
        // ignore
      }
      throw err
    }
  }

  // Snapshot / durability

  /**
   * Promise resolving when all previous asynchronous writes have been
   * committed (visible to readers, not necessarily flushed to disk).
   *
   * @remarks
   * Forwards to the inherited lmdb root-store `committed`. Useful to await
   * after a batch of `put()`/`delete()`/`clear()` calls to guarantee
   * visibility before the next read.
   *
   * @public
   */
  get committed(): Promise<boolean> {
    this._assertOpen()
    return this._root.committed
  }

  /**
   * Promise resolving when all previous writes have been flushed to disk.
   *
   * @remarks
   * Forwards to the inherited lmdb root-store `flushed`. Stronger than
   * {@link committed} (visibility to readers): await this when durability
   * across process crashes matters.
   *
   * @returns Whether the flush completed.
   *
   * @public
   */
  get flushed(): Promise<boolean> {
    this._assertOpen()
    return this._root.flushed
  }

  /**
   * Force a reset of the auto-managed read transaction to the latest
   * snapshot.
   *
   * @remarks
   * By default LMDB renews the read transaction on new event turns.
   * Call this to force an immediate refresh — useful in multi-process
   * scenarios where another process has just written data you need to
   * read without waiting for the next event turn.
   *
   * @public
   */
  resetReadTxn(): void {
    // Intentional no-op after close: lmdb-js tolerates it, and the documented
    // contract (tested) treats it as safe to call on a closed env.
    if (this._state !== `open`) return
    this._root.resetReadTxn()
  }

  /**
   * Take a consistent snapshot backup of the env to another path.
   *
   * @remarks
   * Delegates to LMDB's `backup` which performs a live snapshot without
   * blocking writers. The target path must not already contain an LMDB env
   * (it is overwritten).
   *
   * @param destPath - Filesystem path for the backup env.
   *
   * @example
   * ```typescript
   * await env.backup("./backups/snapshot-2024-01-01");
   * ```
   *
   * @public
   */
  async backup(destPath: string): Promise<void> {
    this._assertOpen()
    await (this._root as unknown as {backup(destPath: string): Promise<void>}).backup(destPath)
  }

  // ──────────────────────────────────────────────────────────────────
  // Direct lmdb root interface (kept public for raw access)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Retrieve an entry (value + version) by key.
   * @param key - The key to look up.
   * @param options - Optional read transaction.
   * @returns The entry with value and optional version, or `undefined`.
   * @public
   */
  rootGetEntry(key: Key, options?: GetOptions): {value: unknown; version?: number} | undefined {
    this._assertOpen()
    return this._root.getEntry(key, options)
  }

  /**
   * Store a value at the given key, unconditionally.
   *
   * @param id - The key.
   * @param value - The value to store.
   * @returns Resolves `true` once the write is queued for commit.
   * @public
   */
  rootPut(id: Key, value: unknown): Promise<boolean>
  /**
   * Store a value only when its version check passes.
   *
   * @remarks
   * Requires the env to be opened with `useVersions`. The write applies and
   * stamps `version` when the stored version equals `ifVersion` (or when the
   * key holds no version yet); otherwise the write is skipped.
   *
   * @param id - The key.
   * @param value - The value to store.
   * @param version - Version number stamped on a successful write.
   * @param ifVersion - Only write when the existing version matches this.
   * @returns Resolves `true` when written, `false` when the version check failed.
   * @public
   */
  rootPut(id: Key, value: unknown, version: number, ifVersion?: number): Promise<boolean>
  /**
   * Store a value with native put options.
   *
   * @param id - The key.
   * @param value - The value to store.
   * @param options - {@link PutOptions} forwarded to the native `put`.
   * @returns Resolves `true` once the write is queued for commit.
   * @public
   */
  rootPut(id: Key, value: unknown, options: PutOptions): Promise<boolean>
  rootPut(id: Key, value: unknown, versionOrOptions?: number | PutOptions, ifVersion?: number): Promise<boolean> {
    this._assertOpen()
    return this._root.put(id, value, versionOrOptions as number, ifVersion)
  }

  /**
   * Synchronously store a value (blocks until written).
   *
   * @param id - The key.
   * @param value - The value to store.
   * @public
   */
  rootPutSync(id: Key, value: unknown): void
  /**
   * Synchronously store a value with an explicit version.
   *
   * @remarks
   * Requires the env to be opened with `useVersions`. Unlike the async
   * {@link rootPut} conditional form there is no `ifVersion` gate — `version`
   * is stamped on the write.
   *
   * @param id - The key.
   * @param value - The value to store.
   * @param version - Version number stamped on the write.
   * @public
   */
  rootPutSync(id: Key, value: unknown, version: number): void
  /**
   * Synchronously store a value with native put options.
   *
   * @param id - The key.
   * @param value - The value to store.
   * @param options - {@link PutOptions} forwarded to the native `putSync`.
   * @public
   */
  rootPutSync(id: Key, value: unknown, options: PutOptions): void
  rootPutSync(id: Key, value: unknown, versionOrOptions?: number | PutOptions): void {
    this._assertOpen()
    this._root.putSync(id, value, versionOrOptions as number)
  }

  /**
   * Iterate entries in a key range.
   * @param options - Range bounds, limit, reverse, etc.
   * @returns A lazy {@link RangeIterable}.
   * @public
   */
  rootGetRange(options?: RangeOptions): RangeIterable<{key: Key; value: unknown; version?: number}> {
    this._assertOpen()
    return this._root.getRange(options)
  }

  /**
   * Iterate unique keys in a range.
   * @param options - Range bounds, limit, reverse, etc.
   * @public
   */
  rootGetKeys(options?: RangeOptions): RangeIterable<Key> {
    this._assertOpen()
    return this._root.getKeys(options)
  }

  /**
   * Count entries in a range.
   * @param options - Range bounds.
   * @public
   */
  rootGetCount(options?: RangeOptions): number {
    this._assertOpen()
    return this._root.getCount(options)
  }

  /**
   * Check whether a key holds at least one entry.
   *
   * @param key - The key to check.
   * @returns `true` when the key exists.
   * @public
   */
  rootDoesExist(key: Key): boolean
  /**
   * Check whether a duplicate value exists under a key.
   *
   * @remarks
   * For `dupSort` sub-DBs: probes one value among the key's duplicates
   * instead of merely probing the key.
   *
   * @param key - The key to check.
   * @param value - The duplicate value to probe.
   * @param options - Optional read transaction.
   * @returns `true` when the value exists under the key.
   * @public
   */
  rootDoesExist(key: Key, value: unknown, options?: GetOptions): boolean
  /**
   * Check whether an entry's version matches.
   *
   * @param key - The key to check.
   * @param version - The expected version number.
   * @returns `true` when the stored version equals `version`.
   * @public
   */
  rootDoesExist(key: Key, version: number): boolean
  rootDoesExist(key: Key, valueOrVersion?: unknown, options?: GetOptions): boolean {
    this._assertOpen()
    return this._root.doesExist(key, valueOrVersion, options)
  }

  /**
   * Execute a synchronous transaction.
   * @param action - Callback performing reads and writes.
   * @param flags - {@link TransactionFlags} (abortable, synchronous-commit, etc.).
   * @returns The callback's return value.
   * @public
   */
  rootTransactionSync<T>(action: () => T, flags?: TransactionFlags): T {
    this._assertOpen()
    const nested = this._txInProgress
    this._txInProgress = true
    try {
      const result = this._root.transactionSync(action, flags)
      if (!nested) this._drainCdc()
      return result
    } finally {
      if (!nested) this._txInProgress = false
    }
  }

  /**
   * Describe all current reader locks (debugging).
   * @public
   */
  readerList(): string {
    this._assertOpen()
    return this._root.readerList()
  }

  /**
   * Return map usage — configured map size vs current on-disk size.
   *
   * @remarks
   * Simple estimation via `statSync` on the data file: `used` is the file
   * size, `ratio` is the free fraction of the configured map. When the file
   * cannot be measured (e.g. closed/not yet created) `ratio` is `1`.
   *
   * @public
   */
  getMapSizeUsed(): IMapUsage {
    const total = this._mapSize
    try {
      const pathStat = statSync(this.path)
      const used = pathStat.isDirectory() ? statSync(join(this.path, `data.mdb`)).size : pathStat.size
      const free = Math.max(total - used, 0)
      return {total, used, free, ratio: total > 0 ? free / total : 1}
    } catch {
      return {total, used: 0, free: total, ratio: 1}
    }
  }

  /**
   * Open or create a sub-database.
   * @param dbName - Sub-database name.
   * @param dbOptions - Encoding, cache, dupSort, and other options.
   * @returns The sub-database handle.
   * @public
   */
  openDB(dbName: string, dbOptions?: DatabaseOptions): Database<unknown, Key> {
    this._assertOpen()
    return this._root.openDB(dbName, dbOptions ?? {})
  }

  /**
   * Listen for LMDB commit events.
   * @param event - `'beforecommit'` or `'aftercommit'`.
   * @param callback - Event handler.
   * @public
   */
  on(event: `beforecommit` | `aftercommit`, callback: (event: unknown) => void): void {
    this._assertOpen()
    // lmdb-js stores beforecommit/aftercommit callbacks in module-level
    // arrays with NO removal API (its `on` override bypasses EventEmitter).
    // We register a wrapper that consults this env's listener registry, so
    // `off()`/close() can stop invocation and let user callbacks be GC'd
    // without holding a reference to them here.
    let registry = this._commitListeners.get(event)
    if (!registry) {
      registry = new Map()
      this._commitListeners.set(event, registry)
    }
    if (!registry.has(callback)) {
      /**
       * Invoke the user callback only while still registered.
       *
       * @remarks
       * Dropping from the registry (via `off` or `close`) stops invocation
       * and frees the callback, since lmdb-js offers no removal API.
       */
      const wrapper = (e: unknown) => {
        if (registry!.has(callback)) callback(e)
      }
      registry.set(callback, wrapper)
      this._root.on(event, wrapper as (event: unknown) => void)
    }
  }

  /**
   * Remove a previously attached commit-event listener.
   *
   * @param event - `'beforecommit'` or `'aftercommit'`.
   * @param callback - The exact handler previously passed to {@link on}.
   * @public
   */
  off(event: `beforecommit` | `aftercommit`, callback: (event: unknown) => void): void {
    const registry = this._commitListeners.get(event)
    if (!registry) return
    // lmdb-js has no way to unregister its module-level arrays — dropping the
    // wrapper from our registry stops invocation and frees the callback.
    registry.delete(callback)
  }

  /**
   * Detach all tracked commit listeners.
   *
   * @remarks
   * Called from {@link close} so user callbacks can be garbage-collected.
   *
   * @internal
   */
  private _removeAllCommitListeners(): void {
    this._commitListeners.clear()
  }

  /**
   * Get the current write-transaction id (inside a transaction callback).
   * @public
   */
  getWriteTxnId(): number {
    this._assertOpen()
    return this._root.getWriteTxnId()
  }

  /**
   * Current schema version as recorded by {@link migrate}.
   *
   * @returns The highest applied migration version, or `0` if none have run.
   *
   * @public
   */
  getMigrationVersion(): number {
    this._assertOpen()
    const db = this.getDb(LmdbEnv._MIGRATIONS_DB)
    const v = db.get(LmdbEnv._VERSION_KEY) as number | undefined
    return typeof v === `number` ? v : 0
  }

  /**
   * Backfill one transform step in 500-row transactions with progress.
   *
   * @remarks
   * Reads the sub lazily (`iterate`), rewrites every row through `map`,
   * and commits per chunk. A crash repeats the step from scratch on the
   * next `migrate()` (rows are keyed, so no duplicates) — `map` must be
   * idempotent. Skew (step target vs declared schema version) throws
   * `LmdbError` before touching any row.
   *
   * @internal
   */
  private async _runTransformStep(m: IMigration, step: ITransformStep): Promise<void> {
    const handle = this.sub(step.schema) as unknown as {
      count(): number
      iterate(): AsyncIterableIterator<[ILmdbKey, unknown]>
      putMany(entries: Array<[ILmdbKey, unknown]>): Promise<void>
    }
    const declared = step.schema.version
    if (declared !== undefined && step.schemaVersion !== declared) {
      throw new LmdbError(`migration v${m.version} ('${m.name}'): transform targets schema version ${String(step.schemaVersion)} but '${step.schema.db}' declares version ${declared}`)
    }
    const total = handle.count()
    let done = 0
    const CHUNK = 500
    let batch: Array<[ILmdbKey, unknown]> = []
    /**
     * Commit the current batch and report progress.
     *
     * @remarks
     * No-op on an empty batch; advances the completed count and fires
     * `onProgress` per committed chunk.
     */
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return
      const chunk = batch
      batch = []
      await handle.putMany(chunk)
      done += chunk.length
      step.onProgress?.(done, total)
    }
    for await (const [key, row] of handle.iterate()) {
      batch.push([key, step.map(row as never)])
      if (batch.length >= CHUNK) await flush()
    }
    await flush()
  }

  /**
   * Apply pending schema migrations.
   *
   * @remarks
   * Each migration's `up` runs inside its own writer transaction and the
   * stored version is bumped only on success. `transform` steps backfill
   * first (chunked top-level transactions, resumable), then `up` runs, then
   * the version bump and the per-step completion marker commit together.
   * Concurrent callers are serialized via LMDB's single-writer lock — the
   * second caller re-checks the version inside the transaction and skips
   * already-applied steps.
   *
   * @param migrations - Array of migrations with unique monotonic `version`.
   * @returns The list of actually applied migrations and the current version.
   *
   * @throws {@link LmdbError} for duplicate versions and steps with neither `up` nor `transform`.
   * @throws {@link LmdbError} for transform/schema version skew.
   *
   * @public
   */
  async migrate(migrations: IMigration[]): Promise<{applied: IMigration[]; currentVersion: number}> {
    this._assertOpen()
    if (!Array.isArray(migrations)) throw new LmdbError(`migrations must be an array`)
    const seen = new Set<number>()
    for (const m of migrations) {
      if (typeof m.version !== `number` || !Number.isInteger(m.version)) {
        throw new LmdbError(`migration version must be an integer: ${String(m.version)}`)
      }
      if (seen.has(m.version)) throw new LmdbError(`duplicate migration version ${m.version}`)
      seen.add(m.version)
    }
    const sorted = [...migrations].sort((a, b) => a.version - b.version)
    const applied: IMigration[] = []
    for (const m of sorted) {
      if (this.getMigrationVersion() >= m.version) continue
      if (m.up === undefined && m.transform === undefined) {
        throw new LmdbError(`migration v${m.version} ('${m.name}') has neither up nor transform — declare at least one`)
      }
      if (m.transform !== undefined) await this._runTransformStep(m, m.transform)
      try {
        await this.transaction(async () => {
          const meta = this.getDb(LmdbEnv._MIGRATIONS_DB)
          const insideRaw = meta.get(LmdbEnv._VERSION_KEY) as number | undefined
          const inside = typeof insideRaw === `number` ? insideRaw : 0
          if (inside >= m.version) return
          if (m.up !== undefined) await m.up(this)
          const putSync = (meta as unknown as {putSync: (k: Key, v: unknown) => void}).putSync
          if (typeof putSync === `function` && this._txInProgress) {
            putSync.call(meta, LmdbEnv._VERSION_KEY, m.version)
            if (m.transform !== undefined) putSync.call(meta, `${LmdbEnv._TRANSFORM_PREFIX}${m.version}`, Date.now())
          } else {
            await (meta as unknown as {put: (k: Key, v: unknown) => Promise<void>}).put(LmdbEnv._VERSION_KEY, m.version)
            if (m.transform !== undefined) {
              await (meta as unknown as {put: (k: Key, v: unknown) => Promise<void>}).put(`${LmdbEnv._TRANSFORM_PREFIX}${m.version}`, Date.now())
            }
          }
        })
      } catch (err) {
        if (err instanceof LmdbError && (err as unknown as {cause?: unknown}).cause) {
          throw (err as unknown as {cause: unknown}).cause
        }
        throw err
      }
      if (this.getMigrationVersion() >= m.version) applied.push(m)
    }
    return {applied, currentVersion: this.getMigrationVersion()}
  }
}

/**
 * Subset of {@link LmdbEnv} exposed to {@link LmdbSubState} sub-DB handles.
 *
 * @remarks
 * Picked directly from `LmdbEnv` so method signatures are always in sync.
 * At runtime the sub receives a combined object that delegates data
 * operations to its sub-DB handle and root-env methods to the owning env.
 *
 * @public
 */
export type IEnvForSub = Database<unknown, Key> & {
  /**
   * Write-transaction runner bound to the owning env.
   */
  transaction: LmdbEnv[`transaction`]
  /**
   * Read-transaction runner bound to the owning env.
   */
  readTransaction: LmdbEnv[`readTransaction`]
  /**
   * Whether the owning env is read-only.
   */
  readOnly: boolean
}
