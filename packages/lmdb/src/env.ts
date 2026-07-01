/**
 * LmdbEnv — the root handle for one LMDB environment and its registered
 * repositories.
 *
 * @remarks
 * One env per process is the common pattern (LMDB is designed for
 * single-writer / multi-reader). The env lazily opens sub-databases on
 * first access and caches them.
 *
 * @packageDocumentation
 * @public
 */

import {open} from "lmdb"
import {LmdbTransaction} from "./transaction"
import {LmdbRepository} from "./repository"
import {LmdbEnvClosedError, LmdbEnvNotOpenError, LmdbDuplicateDbNameError, LmdbRepositoryNotRegisteredError, LmdbRepositoryAlreadyRegisteredError, LmdbMissingDbNameError, LmdbReadOnlyError, LmdbTransactionError} from "./errors"
import type {ILmdbEnvOptions, LmdbEnvState, LmdbEncoding} from "./types"

/**
 * The root handle for one LMDB environment and its repositories.
 *
 * @public
 */
export class LmdbEnv {
  /** @internal */
  private _root: any = null

  /** @internal */
  private _state: LmdbEnvState = `closed`

  /** @internal */
  private readonly _subDbs = new Map<string, any>()

  /** @internal */
  private readonly _repoInstances = new Map<string, LmdbRepository<any, any>>()

  /** @internal */
  private readonly _repoByClass = new Map<new (...args: any[]) => LmdbRepository<any, any>, LmdbRepository<any, any>>()

  /** @internal */
  private readonly _dbByTx = new WeakMap<LmdbTransaction, Map<string, any>>()

  /** @internal Full LMDB options — passed verbatim to `root.openDB()` */
  private readonly _opts: ILmdbEnvOptions

  /** Path where LMDB stores its data files. */
  readonly path: string

  /** Maximum number of sub-databases (mirrors {@link ILmdbEnvOptions.maxDbs}). */
  readonly maxDbs: number

  /** Whether the env is read-only (mirrors {@link ILmdbEnvOptions.readOnly}). */
  readonly readOnly: boolean

  /** Default LMDB value encoding for all sub-DBs (mirrors {@link ILmdbEnvOptions.encoding}). */
  readonly encoding: LmdbEncoding | undefined

  /**
   * Construct a new LmdbEnv (does NOT open it yet).
   *
   * @remarks
   * Call {@link open} (or use `await env.open()`) before performing operations.
   * The constructor only stores options.
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
    this._opts = options
    this.path = options.path
    this.maxDbs = options.maxDbs ?? 10
    this.readOnly = options.readOnly ?? false
    this.encoding = options.encoding
  }

  // ──────────────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────────────

  /**
   * Current lifecycle state of this env.
   *
   * @public
   */
  get state(): LmdbEnvState {
    return this._state
  }

  /**
   * Open the underlying LMDB environment.
   *
   * @remarks
   * Idempotent — calling `open()` on an already-open env is a no-op.
   * Must be called before any repository operation.
   *
   * @public
   */
  async open(): Promise<void> {
    if (this._state === `open`) return
    if (this._state === `closing`) {
      throw new LmdbEnvClosedError()
    }
    this._state = `opening`
    this._root = open({...this._opts, sharedStructuresKey: Symbol.for(`global-structure`)})
    this._state = `open`
  }

  /**
   * Close the underlying LMDB environment and release all resources.
   *
   * @remarks
   * Idempotent — calling `close()` on an already-closed env is a no-op.
   * Repositories obtained via {@link get} become unusable after close.
   *
   * @public
   */
  async close(): Promise<void> {
    if (this._state === `closed`) return
    this._state = `closing`
    this._repoInstances.clear()
    this._repoByClass.clear()
    this._subDbs.clear()
    if (this._root) {
      this._root.close()
      this._root = null
    }
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
   * {@link LmdbRepository} instead.
   *
   * @param name - Sub-database name. Matches the `static dbName` of a repository.
   * @param encoding - LMDB native value encoding (`msgpack`/`json`/`binary`/`string`).
   * @param tx - Optional transaction to scope the lookup.
   * @returns The LMDB sub-database handle (or transaction-bound equivalent).
   *
   * @internal
   */
  getDb(name: string, overrideEncoding?: LmdbEncoding, tx?: LmdbTransaction): any {
    if (this._state !== `open`) throw new LmdbEnvNotOpenError()

    const encoding = overrideEncoding ?? this.encoding
    const openOpts: {encoding?: LmdbEncoding} = {}
    if (encoding) openOpts.encoding = encoding

    if (tx) {
      let txMap = this._dbByTx.get(tx)
      if (!txMap) {
        txMap = new Map()
        this._dbByTx.set(tx, txMap)
      }
      let txDb = txMap.get(name)
      if (!txDb) {
        const rawTxn = tx.raw()
        txDb = this._root.openDB(name, openOpts, rawTxn)
        txMap.set(name, txDb)
      }
      return txDb
    }

    let db = this._subDbs.get(name)
    if (!db) {
      db = this._root.openDB(name, openOpts)
      this._subDbs.set(name, db)
    }
    return db
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
  get<T extends LmdbRepository<any, any>>(repoClass: new (...args: any[]) => T): T {
    const instance = this._repoByClass.get(repoClass)
    if (!instance) {
      throw new LmdbRepositoryNotRegisteredError(repoClass.name)
    }
    return instance as T
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
   * Wraps `rootDb.transaction(callback)`. All writes performed by any
   * sub-database inside the callback are batched into a single atomic
   * commit. If the callback resolves, the transaction is committed. If it
   * throws, the transaction is rolled back. If the
   * callback calls {@link LmdbTransaction.abort} on the wrapper, the wrapper
   * throws an internal abort error which rolls back the transaction.
   *
   * Caveat: LMDB's callback model batches writes that occur in the same
   * "event turn" — if your callback awaits across multiple ticks, batching
   * may include operations from other code. Keep the callback tight.
   *
   * @param fn - Callback receiving the {@link LmdbTransaction} wrapper.
   * @returns The callback's resolved value.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @example
   * ```typescript
   * const result = await env.transaction(async (tx) => {
   *   await userRepo.set("u1", user, tx);
   *   await sessionRepo.set("s1", session, tx);
   *   tx.commit();
   *   return { ok: true };
   * });
   * ```
   *
   * @public
   */
  async transaction<T>(fn: (tx: LmdbTransaction) => Promise<T>): Promise<T> {
    if (this.readOnly) throw new LmdbReadOnlyError(`transaction`)
    if (this._state !== `open`) throw new LmdbEnvNotOpenError()

    const tx = new LmdbTransaction()
    let userResult: T | undefined
    let userError: unknown

    try {
      return await this._root.transaction(async () => {
        try {
          userResult = await fn(tx)
          if (tx.isAborted) {
            throw new LmdbTransactionError(`__ABORT__`)
          }
          return userResult
        } catch (err) {
          if (err instanceof LmdbTransactionError && err.message === `__ABORT__`) {
            throw err
          }
          userError = err
          throw err
        }
      })
    } catch (err) {
      if (err instanceof LmdbTransactionError && err.message === `__ABORT__`) {
        return userResult as T
      }
      throw new LmdbTransactionError(`LmdbTransaction aborted`, userError ?? err)
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
   * Obtains a read transaction via `rootDb.useReadTransaction()` and wraps
   * it in a {@link LmdbTransaction} that auto-releases when the callback
   * returns. All reads inside the callback see a consistent snapshot.
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
   * Mirrors LMDB's `db.committed`. Useful to await after a batch of
   * `set()`/`delete()`/`clear()` calls to guarantee visibility before
   * the next read.
   *
   * @public
   */
  get committed(): Promise<unknown> {
    if (this._state !== `open` || !this._root) return Promise.resolve()
    return this._root.committed
  }

  /**
   * Promise resolving when all previous writes have been committed
   * AND fully flushed to disk (durable across power loss).
   *
   * @remarks
   * Mirrors LMDB's `db.flushed`. Use after critical writes when you need
   * durability guarantees beyond just visibility.
   *
   * @public
   */
  get flushed(): Promise<unknown> {
    if (this._state !== `open` || !this._root) return Promise.resolve()
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
    if (this._state !== `open` || !this._root) return
    this._root.resetReadTxn()
  }

  /**
   * Take a consistent snapshot backup of the env to another path.
   *
   * @remarks
   * Delegates to LMDB's `db.backup` which performs a live snapshot
   * without blocking writers. The target path must not already contain
   * an LMDB env (it is overwritten).
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
    await this._root.backup(destPath)
  }
}
