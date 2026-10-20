import {LmdbError} from "./errors"
import type {IRawReadTransaction, ITransactionLifecycle} from "./types/transaction"

export type {IRawReadTransaction, ITransactionLifecycle} from "./types/transaction"

/**
 * Wraps the underlying `lmdb` transaction lifecycle with a stable API.
 *
 * @remarks
 * The underlying `lmdb` library uses a callback-based transaction model:
 * - **Write transactions** are managed by `rootDb.childTransaction(callback)`.
 *   The wrapper detects user intent and either returns the `ABORT` sentinel
 *   (causing LMDB to roll back) or returns normally (causing LMDB to commit).
 * - **Read transactions** are obtained via `db.useReadTransaction()` and
 *   released via `rawTxn.done()` when the wrapper finalizes.
 *
 * This class wraps both flavors behind a unified lifecycle API:
 * - `commit()` marks the wrapper as committed — LMDB commits when the
 *   childTransaction callback returns normally.
 * - `abort()` marks the wrapper as aborted — LMDB rolls back when the
 *   childTransaction callback returns the `ABORT` sentinel.
 *
 * You do not construct this class directly — {@link LmdbEnv.transaction} and
 * {@link LmdbEnv.readTransaction} create and manage the instance.
 *
 * @public
 */
export class LmdbTransaction {
  /**
   * Current lifecycle state.
   *
   * @internal
   */
  private _lifecycle: ITransactionLifecycle = `active`

  /**
   * The wrapped raw read transaction, if any.
   *
   * @internal
   */
  private _rawReadTxn: IRawReadTransaction | undefined

  /**
   * Guard so the raw read txn is released at most once.
   *
   * @internal
   */
  private _rawReleased = false

  /**
   * Whether this transaction runs on an lmdb-js path that cannot roll back.
   *
   * @remarks
   * `lmdb`'s `db.transaction()` records a callback error and rethrows it, but
   * never calls `mdb_txn_abort` — the native write transaction still commits.
   * So on that path {@link LmdbTransaction.abort} would silently do nothing while the caller
   * believes the writes were discarded. We fail loudly instead.
   *
   * @internal
   */
  private readonly _noAbort: boolean

  /**
   * Set when {@link LmdbTransaction.abort} refused because the backing path cannot roll back.
   *
   * @remarks
   * Lets the caller re-surface the original "cannot abort" error instead of
   * replacing it with a generic commit-on-throw message.
   *
   * @internal
   */
  private _abortRejected = false

  /**
   * Whether {@link LmdbTransaction.abort} threw because this transaction cannot roll back.
   *
   * @internal
   */
  get abortRejected(): boolean {
    return this._abortRejected
  }

  /**
   * Create a transaction wrapper.
   *
   * @remarks
   * Called by {@link LmdbEnv.transaction} (no raw txn),
   * {@link LmdbEnv.transactionFast} (no raw txn, `noAbort`) and
   * {@link LmdbEnv.readTransaction} (with the raw read txn) — never
   * construct directly.
   *
   * @param rawReadTxn - The raw LMDB read transaction (from
   * `db.useReadTransaction()`), or `undefined` for write transactions.
   * @param noAbort - `true` when the backing lmdb-js API cannot roll back, so
   * {@link LmdbTransaction.abort} must throw instead of pretending to succeed.
   * @internal
   */
  constructor(rawReadTxn?: IRawReadTransaction, noAbort = false) {
    this._rawReadTxn = rawReadTxn
    this._noAbort = noAbort
  }

  /**
   * Current lifecycle of this transaction.
   *
   * @public
   */
  get lifecycle(): ITransactionLifecycle {
    return this._lifecycle
  }

  /**
   * Whether this transaction has been finalized (committed or aborted).
   *
   * @public
   */
  get done(): boolean {
    return this._lifecycle !== `active`
  }

  /**
   * Whether the user explicitly called {@link LmdbTransaction.abort}.
   *
   * @remarks
   * Read by {@link LmdbEnv.transaction} after the user's callback returns —
   * if true, the LMDB childTransaction callback returns the `ABORT` sentinel.
   *
   * @public
   */
  get isAborted(): boolean {
    return this._lifecycle === `aborted`
  }

  /**
   * Whether the user explicitly called {@link LmdbTransaction.commit}.
   *
   * @public
   */
  get isCommitted(): boolean {
    return this._lifecycle === `committed`
  }

  /**
   * Underlying LMDB read transaction object (only present for read transactions).
   *
   * @remarks
   * Low-level escape hatch. Most callers should not need this.
   *
   * @public
   */
  get raw(): IRawReadTransaction | undefined {
    return this._rawReadTxn
  }

  /**
   * Mark this transaction as committed.
   *
   * @remarks
   * **SQL equivalent**: `COMMIT;` — ends the transaction and makes all
   * writes durable.
   *
   * For write transactions (inside {@link LmdbEnv.transaction}): sets the
   * internal flag so the wrapper callback returns normally and LMDB commits.
   * The actual commit is performed by LMDB once the wrapper returns.
   *
   * For read transactions (inside {@link LmdbEnv.readTransaction}): this is
   * a no-op — the raw LMDB read transaction is released automatically when
   * the wrapper returns.
   *
   * @throws {@link LmdbError} if already committed or aborted.
   *
   * @example
   * ```typescript
   * await env.transaction(async (tx) => {
   *   await users.put("u1", user, tx);
   *   await sessions.put("s1", session, tx);
   *   tx.commit();
   * });
   * ```
   *
   * @public
   */
  commit(): void {
    if (this.done) {
      throw new LmdbError(`Transaction has already been committed or aborted and cannot be reused.`)
    }
    this._lifecycle = `committed`
  }

  /**
   * Mark this transaction as aborted.
   *
   * @remarks
   * **SQL equivalent**: `ROLLBACK;` — discards all writes performed inside
   * the transaction.
   *
   * For write transactions (inside {@link LmdbEnv.transaction}): the wrapper
   * callback detects this flag and throws an internal abort error, causing
   * LMDB to roll back all writes in the transaction.
   *
   * For read transactions: releases the underlying LMDB read transaction
   * immediately. Safe to call multiple times.
   *
   * Inside {@link LmdbEnv.transactionFast} this **throws** `LmdbError`: that
   * path commits through lmdb-js `db.transaction()`, which cannot roll back.
   * Silently ignoring the call would let the caller believe the writes were
   * discarded when they are in fact committed.
   *
   * @example
   * ```typescript
   * await env.transaction(async (tx) => {
   *   try {
   *     await users.put("u1", user, tx);
   *     await someRiskyOp();
   *     tx.commit();
   *   } catch (err) {
   *     tx.abort();
   *     throw err;
   *   }
   * });
   * ```
   *
   * @public
   */
  abort(): void {
    if (this._noAbort) {
      this._abortRejected = true
      throw new LmdbError(`Cannot abort a 'transactionFast' transaction — its lmdb path commits even when the callback throws. Use 'transaction()' when you need rollback.`)
    }
    if (this.done) {
      // Already committed or aborted — still release the raw read txn if
      // one is held (e.g. the user called commit() inside readTransaction).
      this._releaseReadTxn()
      return
    }
    this._lifecycle = `aborted`
    this._releaseReadTxn()
  }

  /**
   * Release the underlying LMDB read transaction, at most once.
   *
   * @remarks
   * Calls the raw txn's `done()` — the lmdb-js-documented release for a
   * transaction acquired via `useReadTransaction()`. Calling `abort()`
   * directly would kill the env's SHARED read transaction (used by every
   * subsequent `get`/range in the same event turn), leaving it dead until
   * the next macrotask reset — EINVAL "No transaction to renew" on the next
   * read. `done()` only decrements the reader refcount and lets lmdb-js
   * renew the shared snapshot normally.
   *
   * @internal
   */
  _releaseReadTxn(): void {
    if (this._rawReleased) return
    this._rawReleased = true
    if (this._rawReadTxn && typeof this._rawReadTxn.done === `function`) {
      this._rawReadTxn.done()
    }
  }

  /**
   * Mark a read transaction as finished successfully (release the raw txn
   * without reporting an abort).
   *
   * @remarks
   * Used by {@link LmdbEnv.readTransaction} on normal completion — the
   * wrapper lifecycle becomes `released` (not `aborted`), so `isAborted`
   * stays `false` for transactions that simply ran to completion.
   * Safe to call multiple times; the raw read txn is released at most once.
   *
   * @public
   */
  release(): void {
    if (this.done) {
      // Already committed/aborted/released — still release the raw read txn
      // if one is held (e.g. the user called commit() inside readTransaction).
      this._releaseReadTxn()
      return
    }
    this._lifecycle = `released`
    this._releaseReadTxn()
  }
}
