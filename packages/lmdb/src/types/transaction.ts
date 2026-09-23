import type {Transaction} from "lmdb"

/**
 * Raw LMDB read transaction augmented with optional lifecycle hooks.
 *
 * @remarks
 * `useReadTransaction()` returns a plain `Transaction`; the optional hooks
 * below are probed defensively (`typeof x.done === 'function'`) before use.
 *
 * @public
 */
export type IRawReadTransaction = Transaction & {
  /**
   * Release the raw read transaction.
   */
  done?: () => void
  /**
   * Abort the raw read transaction.
   */
  abort?: () => void
}

/**
 * Lifecycle of a {@link LmdbTransaction}.
 *
 * @remarks
 * `released` is used for read transactions that finished normally — the raw
 * LMDB read transaction is freed but the wrapper was NOT aborted by user
 * code. Distinguishing it from `aborted` matters for `isAborted` consumers.
 *
 * @public
 */
export type ITransactionLifecycle = `active` | `committed` | `aborted` | `released`
