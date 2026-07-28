/**
 * LmdbEnv — the root handle for one LMDB environment and its registered
 * repositories.
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
 * envs in the same process.
 *
 * @packageDocumentation
 * @public
 */

import {open, ABORT} from "lmdb"
import type {RootDatabaseOptionsWithPath, RootDatabase, Database, DatabaseOptions, Key, GetOptions, RangeOptions, RangeIterable, PutOptions, TransactionFlags, Transaction} from "lmdb"
import {LmdbTransaction} from "./transaction"
import {LmdbRepository} from "./repository"
import {LmdbEnvNotOpenError, LmdbDuplicateDbNameError, LmdbRepositoryNotRegisteredError, LmdbRepositoryAlreadyRegisteredError, LmdbMissingDbNameError, LmdbReadOnlyError, LmdbTransactionError} from "./errors"
import type {ILmdbEnvOptions, ILmdbEnvState, ILmdbEncoding} from "./types"

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
interface LmdbRootStore extends RootDatabase<any, Key> {
  sync(callback?: (error: any) => void): Promise<void>
  isOperational(): boolean
}

/**
 * The root handle for one LMDB environment and its repositories.
 *
 * @remarks
 * Holds a private per-instance lmdb root store internally — no shared
 * `openAsClass` base class, so sub-database handle caches never leak across
 * envs. Native store methods (`transaction`, `openDB`, `close`, `backup`,
 * etc.) are forwarded explicitly.
 *
 * @public
 */
export class LmdbEnv {
  /** @internal */
  private _state: ILmdbEnvState = `open`

  /** @internal Per-instance lmdb root store */
  private readonly _root: LmdbRootStore

  /** @internal */
  private readonly _repoInstances = new Map<string, LmdbRepository<any, any>>()

  /** @internal */
  private readonly _repoByClass = new Map<new (...args: any[]) => LmdbRepository<any, any>, LmdbRepository<any, any>>()

  /** @internal Full LMDB options — stored for reference. */
  private readonly _opts: ILmdbEnvOptions

  /** Path where LMDB stores its data files. */
  readonly path: string

  /** Maximum number of sub-databases (mirrors {@link ILmdbEnvOptions.maxDbs}). */
  readonly maxDbs: number

  /** Whether the env is read-only (mirrors {@link ILmdbEnvOptions.readOnly}). */
  readonly readOnly: boolean

  /** Default LMDB value encoding for all sub-DBs (mirrors {@link ILmdbEnvOptions.encoding}). */
  readonly encoding: ILmdbEncoding | undefined

  /** @internal Sub-DB options extracted from env options — forwarded to every openDB call. */
  private readonly _dbOpts: DatabaseOptions

  /**
   * Construct a new LmdbEnv and open the underlying LMDB environment.
   *
   * @remarks
   * Construction opens the env immediately. The `path` is required and
   * flows through to lmdb's native `open()`. No explicit `open()` call
   * is needed.
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
   *
   * // At-rest encryption (32-byte key)
   * const env = new LmdbEnv({
   *   path: "./data",
   *   encryptionKey: process.env.LMDB_KEY
   * });
   * ```
   *
   * @public
   */
  constructor(options: ILmdbEnvOptions) {
    const opts: RootDatabaseOptionsWithPath = {
      ...options,
      sharedStructuresKey: Symbol.for(`global-structure`)
    }
    // Per-instance root store. Each env calls open() independently so
    // sub-database handle caches are naturally isolated across envs.
    this._root = open(opts) as any as LmdbRootStore
    this._opts = options
    this.path = options.path
    this.maxDbs = options.maxDbs ?? 10
    this.readOnly = options.readOnly ?? false
    this.encoding = options.encoding

    // Extract sub-DB options that lmdb does NOT inherit from the root env.
    // These must be forwarded explicitly to every openDB() call.
    this._dbOpts = {
      ...(options.compression !== undefined && {compression: options.compression}),
      ...(options.cache !== undefined && {cache: options.cache}),
      ...(options.encoding !== undefined && {encoding: options.encoding}),
      ...(options.useVersions !== undefined && {useVersions: options.useVersions}),
      ...(options.keyEncoding !== undefined && {keyEncoding: options.keyEncoding}),
      ...(options.dupSort !== undefined && {dupSort: options.dupSort}),
      ...(options.strictAsyncOrder !== undefined && {strictAsyncOrder: options.strictAsyncOrder})
    }
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
   * Close the underlying LMDB environment and release all resources.
   *
   * @remarks
   * Delegates to the inherited lmdb root store `close()` (awaitable), then
   * clears the repository registry. Repositories obtained via {@link get}
   * become unusable after close.
   *
   * @public
   */
  async close(): Promise<void> {
    if (this._state === `closed`) return
    this._state = `closing`
    this._repoInstances.clear()
    this._repoByClass.clear()
    await this._root.close()
    this._state = `closed`
  }

  // ──────────────────────────────────────────────────────────────────
  // Sub-database access
  // ──────────────────────────────────────────────────────────────────

  /**
   * Get or create a sub-database by name.
   *
   * @remarks
   * Low-level. Most callers should use {@link get} to obtain a typed
   * {@link LmdbRepository} instead. Delegates to the inherited lmdb
   * `openDB(name, opts)` — lmdb-js caches per-name handles internally.
   *
   * @param name - Sub-database name. Matches the `static dbName` of a repository.
   * @param overrideEncoding - LMDB native value encoding (`msgpack`/`json`/`binary`/`string`).
   * @returns The LMDB sub-database handle.
   *
   * @internal
   */
  getDb(name: string, overrideEncoding?: ILmdbEncoding): Database<any, any> {
    // Forward all env-level sub-DB options. lmdb does NOT inherit
    // compression/cache/encoding/etc. from the root env — each openDB()
    // must receive them explicitly for production correctness.
    const encoding = overrideEncoding ?? this.encoding
    const openOpts: DatabaseOptions = {...this._dbOpts}
    if (encoding) openOpts.encoding = encoding
    return this._root.openDB(name, openOpts)
  }

  // ──────────────────────────────────────────────────────────────────
  // LmdbRepository management
  // ──────────────────────────────────────────────────────────────────

  /**
   * Register a {@link LmdbRepository} subclass.
   *
   * @remarks
   * The first registration also lazily opens the underlying sub-database.
   * Re-registering the same class throws.
   *
   * @param repoClass - The LmdbRepository subclass constructor.
   * @returns The instantiated repository (same as {@link get}).
   *
   * @throws {@link LmdbMissingDbNameError} if `static dbName` is missing.
   * @throws {@link LmdbDuplicateDbNameError} if another class uses the same `dbName`.
   * @throws {@link LmdbRepositoryAlreadyRegisteredError} if the same class is registered twice.
   *
   * @example
   * ```typescript
   * env.register(UserRepository);
   * ```
   *
   * @public
   */
  register<T extends LmdbRepository<any, any>>(repoClass: new (...args: any[]) => T): T {
    if (this._repoByClass.has(repoClass)) {
      throw new LmdbRepositoryAlreadyRegisteredError(repoClass.name)
    }
    const dbName = (repoClass as any).dbName as string | undefined
    if (!dbName) {
      throw new LmdbMissingDbNameError(repoClass.name)
    }
    if (this._repoInstances.has(dbName)) {
      throw new LmdbDuplicateDbNameError(dbName)
    }
    const instance = new repoClass(this as any, dbName)
    this._repoInstances.set(dbName, instance)
    this._repoByClass.set(repoClass, instance)
    return instance
  }

  /**
   * Retrieve a previously registered {@link LmdbRepository} instance.
   *
   * @param repoClass - The LmdbRepository subclass constructor.
   * @returns The same instance returned by {@link register}.
   *
   * @throws {@link LmdbRepositoryNotRegisteredError} if the class is not registered.
   *
   * @example
   * ```typescript
   * const userRepo = env.get(UserRepository);
   * ```
   *
   * @public
   */
  get<T extends LmdbRepository<any, any>>(repoClass: new (...args: any[]) => T): T
  /**
   * Retrieve a value from the root database by key.
   *
   * @remarks
   * Forwards to the lmdb root store `get()`. Most consumers should use a
   * typed {@link LmdbRepository} instead — this is provided for direct
   * low-level access when needed.
   *
   * @param key - The key to look up.
   * @param options - Optional read transaction or other options.
   *
   * @public
   */
  get(key: Key, options?: GetOptions): any
  get(arg: any, options?: any): any {
    if (typeof arg === `function`) {
      const instance = this._repoByClass.get(arg)
      if (!instance) {
        throw new LmdbRepositoryNotRegisteredError(arg.name)
      }
      return instance
    }
    return this._root.get(arg, options)
  }

  /**
   * @internal
   */
  getRepository<T extends LmdbRepository<any, any>>(repoClass: new (...args: any[]) => T): T {
    return this.get(repoClass)
  }

  /**
   * Check whether a LmdbRepository class has been registered.
   *
   * @param repoClass - The LmdbRepository subclass constructor.
   * @returns `true` if registered, `false` otherwise.
   *
   * @public
   */
  has(repoClass: new (...args: any[]) => LmdbRepository<any, any>): boolean {
    return this._repoByClass.has(repoClass)
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
   * -- <writes performed via repository.set() inside fn>
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
   * coalesces them into a single native LMDB write transaction. Repository
   * methods are non-async, making sync callbacks natural.
   *
   * @param fn - Callback receiving the {@link LmdbTransaction} wrapper.
   * @returns The callback's resolved value.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @example
   * ```typescript
   * // ✅ Sync callback — recommended. All writes coalesced into one native
   * //    LMDB write transaction. Repository methods return Promise directly
   * //    without async wrapper, so no await is needed inside the callback.
   * const result = await env.transaction(() => {
   *   userRepo.set("u1", user);
   *   sessionRepo.set("s1", session);
   *   return { ok: true };
   * });
   *
   * // ⚠️  Async callback — works but not recommended. Each await creates a
   * //    microtask boundary that may cause lmdb-js to flush writes early.
   * await env.transaction(async (tx) => {
   *   await userRepo.set("u1", user);
   *   await sessionRepo.set("s1", session);
   * });
   * ```
   *
   * @public
   */
  async transaction<T>(fn: (tx: LmdbTransaction) => T): Promise<T> {
    if (this.readOnly) throw new LmdbReadOnlyError(`transaction`)
    if (this._state !== `open`) throw new LmdbEnvNotOpenError()

    const tx = new LmdbTransaction()
    let userResult: T | undefined

    try {
      this._root.transactionSync(() => {
        userResult = fn(tx)
        if (tx.isAborted) throw ABORT
        return userResult
      })
      return userResult as T
    } catch (err) {
      if (err === ABORT) {
        return userResult as T
      }
      throw new LmdbTransactionError(`Transaction failed`, err)
    }
  }

  /**
   * Run a callback inside a read-only transaction.
   *
   * @remarks
   * **SQL equivalent**:
   * ```sql
   * START TRANSACTION READ ONLY;
   * -- <reads performed via repository.get/has/keys/values/entries/iterate inside fn>
   * COMMIT;
   * ```
   * Obtains a read transaction via the inherited root-store
   * `useReadTransaction()` and wraps it in a {@link LmdbTransaction} that
   * auto-releases when the callback returns. All reads inside the callback
   * see a consistent snapshot.
   *
   * @param fn - Callback receiving the read-only {@link LmdbTransaction}.
   * @returns The callback's resolved value.
   *
   * @example
   * ```typescript
   * const snapshot = await env.readTransaction(async (tx) => {
   *   return await userRepo.entries({}, tx);
   * });
   * ```
   *
   * @public
   */
  async readTransaction<T>(fn: (tx: LmdbTransaction) => Promise<T>): Promise<T> {
    if (this._state !== `open`) throw new LmdbEnvNotOpenError()

    const rawTxn = this._root.useReadTransaction()
    const tx = new LmdbTransaction(rawTxn)

    try {
      const result = await fn(tx)
      tx.abort() // releases the raw read txn via rawTxn.done()
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
   * after a batch of `set()`/`delete()`/`clear()` calls to guarantee
   * visibility before the next read.
   *
   * @public
   */
  get committed(): Promise<boolean> {
    return this._root.committed
  }

  get flushed(): Promise<boolean> {
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
    if (this._state !== `open`) throw new LmdbEnvNotOpenError()
    await (this._root as any).backup(destPath)
  }

  // ──────────────────────────────────────────────────────────────────
  // Direct lmdb Database interface
  // ──────────────────────────────────────────────────────────────────

  /**
   * Retrieve an entry (value + version) by key.
   * @param key - The key to look up.
   * @param options - Optional read transaction.
   * @returns The entry with value and optional version, or `undefined`.
   * @public
   */
  getEntry(key: Key, options?: GetOptions): {value: any; version?: number} | undefined {
    return this._root.getEntry(key, options)
  }

  /**
   * Retrieve the raw binary value by key.
   * @param key - The key to look up.
   * @returns A `Buffer`, or `undefined` if not found.
   * @public
   */
  getBinary(key: Key): Buffer | undefined {
    return this._root.getBinary(key)
  }

  /**
   * Retrieve the raw binary value as a temporary buffer (faster).
   * @remarks
   * The returned buffer is only valid until the next `get` operation.
   * Copy the data with `Buffer.from()` if you need it later.
   * @param key - The key to look up.
   * @public
   */
  getBinaryFast(key: Key): Buffer | undefined {
    return this._root.getBinaryFast(key)
  }

  /**
   * Keep a reference to binary data so it is not garbage-collected.
   * @param data - Data previously returned by {@link getBinaryFast}.
   * @public
   */
  retain(data: any): any {
    return this._root.retain(data)
  }

  /**
   * Asynchronously pre-fetch entries into the OS page cache.
   * @param ids - Keys to pre-fetch.
   * @param callback - Optional completion callback.
   * @public
   */
  prefetch(ids: Key[], callback?: (...args: any[]) => any): Promise<void> {
    return this._root.prefetch(ids, callback)
  }

  /**
   * Batch-read values for multiple keys.
   * @param ids - Keys to retrieve.
   * @param callback - Optional completion callback.
   * @returns Array of values (or `undefined` for missing keys) in input order.
   * @public
   */
  getMany(ids: Key[], callback?: (error: any, values: any[]) => void): Promise<(any | undefined)[]> {
    return this._root.getMany(ids, callback)
  }

  /**
   * Store a value at the given key.
   * @param id - The key.
   * @param value - The value to store.
   * @param version - Optional version number (requires `useVersions`).
   * @param ifVersion - Optional: only write if existing version matches.
   * @returns `true` if written, `false` if conditional check failed.
   * @public
   */
  put(id: Key, value: any): Promise<boolean>
  put(id: Key, value: any, version: number, ifVersion?: number): Promise<boolean>
  put(id: Key, value: any, version?: number, ifVersion?: number): Promise<boolean> {
    return this._root.put(id, value, version!, ifVersion)
  }

  /**
   * Delete an entry by key.
   * @param id - The key to remove.
   * @param ifVersion - Optional: only remove if existing version matches.
   * @public
   */
  remove(id: Key): Promise<boolean>
  remove(id: Key, ifVersion: number): Promise<boolean>
  remove(id: Key, valueOrIfVersion?: any): Promise<boolean> {
    return this._root.remove(id, valueOrIfVersion)
  }

  /**
   * Synchronously store a value (blocks until written).
   * @param id - The key.
   * @param value - The value to store.
   * @param versionOrOptions - Optional version number or {@link PutOptions}.
   * @public
   */
  putSync(id: Key, value: any): void
  putSync(id: Key, value: any, version: number): void
  putSync(id: Key, value: any, options: PutOptions): void
  putSync(id: Key, value: any, versionOrOptions?: number | PutOptions): void {
    this._root.putSync(id, value, versionOrOptions as number)
  }

  /**
   * Synchronously delete an entry.
   * @param id - The key to remove.
   * @param valueToRemove - For dupSort databases, the specific value to remove.
   * @returns `true` if an entry was removed.
   * @public
   */
  removeSync(id: Key): boolean
  removeSync(id: Key, valueToRemove: any): boolean
  removeSync(id: Key, valueToRemove?: any): boolean {
    return this._root.removeSync(id, valueToRemove)
  }

  /**
   * Iterate entries in a key range.
   * @param options - Range bounds, limit, reverse, etc.
   * @returns A lazy {@link RangeIterable}.
   * @public
   */
  getRange(options?: RangeOptions): RangeIterable<{key: Key; value: any; version?: number}> {
    return this._root.getRange(options)
  }

  /**
   * Iterate all values for a key (dupSort databases only).
   * @param key - The key whose values to retrieve.
   * @param options - Optional range bounds for the values.
   * @public
   */
  getValues(key: Key, options?: RangeOptions): RangeIterable<any> {
    return this._root.getValues(key, options)
  }

  /**
   * Count the number of values for a key (dupSort databases only).
   * @param key - The key to count.
   * @param options - Optional range bounds.
   * @public
   */
  getValuesCount(key: Key, options?: RangeOptions): number {
    return this._root.getValuesCount(key, options)
  }

  /**
   * Iterate unique keys in a range.
   * @param options - Range bounds, limit, reverse, etc.
   * @public
   */
  getKeys(options?: RangeOptions): RangeIterable<Key> {
    return this._root.getKeys(options)
  }

  /**
   * Count unique keys in a range.
   * @param options - Range bounds.
   * @public
   */
  getKeysCount(options?: RangeOptions): number {
    return this._root.getKeysCount(options)
  }

  /**
   * Count entries in a range.
   * @param options - Range bounds.
   * @public
   */
  getCount(options?: RangeOptions): number {
    return this._root.getCount(options)
  }

  /**
   * Check if an entry exists.
   * @param key - The key to check.
   * @param valueOrVersion - Optional: check value (dupSort) or version.
   * @param options - Optional read transaction.
   * @public
   */
  doesExist(key: Key): boolean
  doesExist(key: Key, value: any, options?: GetOptions): boolean
  doesExist(key: Key, version: number): boolean
  doesExist(key: Key, valueOrVersion?: any, options?: GetOptions): boolean {
    return this._root.doesExist(key, valueOrVersion, options)
  }

  /**
   * Execute a synchronous transaction.
   * @param action - Callback performing reads and writes.
   * @param flags - {@link TransactionFlags} (abortable, synchronous-commit, etc.).
   * @returns The callback's return value.
   * @public
   */
  transactionSync<T>(action: () => T, flags?: TransactionFlags): T {
    return this._root.transactionSync(action, flags)
  }

  /**
   * Execute an abortable child transaction.
   * @param action - Callback performing reads and writes. Return `ABORT` to roll back.
   * @public
   */
  childTransaction<T>(action: () => T): Promise<T> {
    return this._root.childTransaction(action)
  }

  /**
   * Batch multiple writes into the next queued transaction.
   * @param action - Callback performing writes.
   * @public
   */
  batch(action: () => any): Promise<boolean> {
    return this._root.batch(action)
  }

  /**
   * Conditionally execute writes only if a key has the expected version.
   * @param id - The key to check.
   * @param version - Expected version number.
   * @param action - Callback performing conditional writes.
   * @public
   */
  ifVersion(id: Key, version: number, action: () => any): Promise<boolean> {
    return this._root.ifVersion(id, version, action)
  }

  /**
   * Conditionally execute writes only if a key does not exist.
   * @param id - The key to check.
   * @param action - Callback performing conditional writes.
   * @public
   */
  ifNoExists(id: Key, action: () => any): Promise<boolean> {
    return this._root.ifNoExists(id, action)
  }

  /**
   * Asynchronously clear all entries from the database.
   * @public
   */
  clearAsync(): Promise<void> {
    return this._root.clearAsync()
  }

  /**
   * Synchronously clear all entries from the database.
   * @public
   */
  clearSync(): void {
    this._root.clearSync()
  }

  /**
   * Delete this database (asynchronously).
   * @public
   */
  drop(): Promise<void> {
    return this._root.drop()
  }

  /**
   * Delete this database (synchronously).
   * @public
   */
  dropSync(): void {
    this._root.dropSync()
  }

  /**
   * Check and remove stale reader locks.
   * @returns Number of stale locks removed.
   * @public
   */
  readerCheck(): number {
    return this._root.readerCheck()
  }

  /**
   * Describe all current reader locks (debugging).
   * @public
   */
  readerList(): string {
    return this._root.readerList()
  }

  /**
   * Return database statistics.
   * @public
   */
  getStats(): Record<string, unknown> {
    return this._root.getStats()
  }

  /**
   * Open or create a sub-database.
   * @param dbName - Sub-database name.
   * @param dbOptions - Encoding, cache, dupSort, and other options.
   * @returns The sub-database handle.
   * @public
   */
  openDB(dbName: string, dbOptions?: DatabaseOptions): Database<any, Key> {
    return this._root.openDB(dbName, dbOptions ?? {})
  }

  /**
   * Obtain a read transaction for manual snapshot management.
   * @returns An LMDB Transaction handle. Call `.done()` to release.
   * @public
   */
  useReadTransaction(): Transaction {
    return this._root.useReadTransaction()
  }

  /**
   * Listen for LMDB commit events.
   * @param event - `'beforecommit'` or `'aftercommit'`.
   * @param callback - Event handler.
   * @public
   */
  on(event: `beforecommit` | `aftercommit`, callback: (event: any) => void): void {
    this._root.on(event, callback)
  }

  /**
   * Get the current write-transaction id (inside a transaction callback).
   * @public
   */
  getWriteTxnId(): number {
    return this._root.getWriteTxnId()
  }

  /**
   * Force sync all data to disk.
   * @param callback - Optional completion callback.
   * @public
   */
  sync(callback?: (error: any) => void): Promise<void> {
    return this._root.sync(callback)
  }

  /**
   * Check whether the database is operational (open).
   * @public
   */
  isOperational(): boolean {
    return this._root.isOperational()
  }
}

/**
 * Subset of {@link LmdbEnv} exposed to {@link LmdbRepository} instances.
 *
 * @remarks
 * Picked directly from `LmdbEnv` so method signatures are always in sync.
 * At runtime the repository receives a combined object that delegates data
 * operations to its sub-DB handle and root-env methods to the owning env.
 *
 * @public
 */
export type IEnvForRepo = Pick<
  LmdbEnv,
  `get` | `put` | `putSync` | `remove` | `removeSync` | `doesExist` | `clearAsync` | `drop` | `prefetch` | `getMany` | `getCount` | `getKeys` | `getKeysCount` | `getRange` | `transactionSync` | `getDb` | `readOnly` | `transaction` | `readTransaction` | `getRepository`
>
