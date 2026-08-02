/**
 * LmdbTransaction wrapper for cross-repository atomic operations.
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
 * @packageDocumentation
 * @public
 */

import type {Transaction} from "lmdb"
import {LmdbTransactionDoneError} from "./errors"

type RawReadTransaction = Transaction & {
  done?: () => void
  abort?: () => void
}

/**
 * Lifecycle of a {@link LmdbTransaction}.
 *
 * @public
 */
export type TransactionLifecycle = `active` | `committed` | `aborted`

/**
 * Wraps the underlying `lmdb` transaction lifecycle with a stable API.
 *
 * @remarks
 * You do not construct this class directly — {@link LmdbEnv.transaction} and
 * {@link LmdbEnv.readTransaction} create and manage the instance.
 *
 * @public
 */
export class LmdbTransaction {
  /** @internal */
  private _lifecycle: TransactionLifecycle = `active`

  /** @internal */
  private readonly _rawReadTxn: RawReadTransaction | undefined

  /** @internal Guard so the raw read txn is released at most once. */
  private _rawReleased = false

  /**
   * @param rawReadTxn - The raw LMDB read transaction (from
   * `db.useReadTransaction()`), or `undefined` for write transactions.
   * @internal
   */
  constructor(rawReadTxn?: RawReadTransaction) {
    this._rawReadTxn = rawReadTxn
  }

  /**
   * Current lifecycle of this transaction.
   *
   * @public
   */
  get lifecycle(): TransactionLifecycle {
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
   * Whether the user explicitly called {@link abort}.
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
   * Whether the user explicitly called {@link commit}.
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
  get raw(): RawReadTransaction | undefined {
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
   * @throws {@link LmdbTransactionDoneError} if already committed or aborted.
   *
   * @example
   * ```typescript
   * await env.transaction(async (tx) => {
   *   await userRepo.set("u1", user, tx);
   *   await sessionRepo.set("s1", session, tx);
   *   tx.commit();
   * });
   * ```
   *
   * @public
   */
  commit(): void {
    if (this.done) {
      throw new LmdbTransactionDoneError()
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
   * @example
   * ```typescript
   * await env.transaction(async (tx) => {
   *   try {
   *     await userRepo.set("u1", user, tx);
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
   * Calls the raw txn's `abort()` — `done()` only decrements the cursor
   * refcount and leaves the reader slot occupied until env close.
   *
   * @internal
   */
  _releaseReadTxn(): void {
    if (this._rawReleased) return
    this._rawReleased = true
    if (this._rawReadTxn && typeof this._rawReadTxn.abort === `function`) {
      this._rawReadTxn.abort()
    }
  }
}
