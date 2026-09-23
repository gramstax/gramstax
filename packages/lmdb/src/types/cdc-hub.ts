import type {ICdcCallback} from "./cdc"

/**
 * A live in-process subscription registered on {@link CdcHub}.
 *
 * @remarks
 * Created by `subscribe()` from a parsed {@link CdcFilter} — `db` scopes
 * delivery to one sub-DB, `op` narrows to one write kind (`undefined` means
 * all kinds). Held in the hub's subscriber list until the idempotent
 * unsubscribe closure removes it.
 *
 * @internal
 */
export interface ISubscription {
  /**
   * Source sub-DB name this subscription listens to.
   */
  db: string
  /**
   * Write kind filter (`undefined` delivers puts, deletes, and clears).
   */
  op: `put` | `delete` | `clear` | undefined
  /**
   * Subscriber callback invoked per matching record on drain.
   */
  cb: ICdcCallback
}
