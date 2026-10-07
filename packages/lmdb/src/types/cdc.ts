import type {ILmdbKey} from "./key"

/**
 * In-process subscriber event — exactly `{type, key, value}`.
 *
 * @remarks
 * Delivered to `subscribe` callbacks post-commit and persisted on outbox
 * records. Deletes are key-only (`value` is `undefined`); clears cover a
 * whole sub (`key` and `value` are both `undefined`).
 *
 * @public
 */
export interface ICdcEvent {
  /**
   * Write kind (`clear` covers whole-sub clears).
   */
  type: `put` | `delete` | `clear`
  /**
   * Primary key (`undefined` for `clear`).
   */
  key: ILmdbKey | undefined
  /**
   * Row value (`undefined` for deletes and clears).
   */
  value: unknown
}

/**
 * Durable outbox record — the subscriber event plus routing metadata.
 *
 * @remarks
 * Appended in the same writer transaction as the primary write, so aborts
 * publish nothing and sequences stay gapless per env.
 *
 * @public
 */
export interface ICdcRecord extends ICdcEvent {
  /**
   * Outbox sequence (gapless, per-env).
   */
  seq: number
  /**
   * Source sub-DB name.
   */
  db: string
}

/**
 * Subscribe filter — a sub-DB name, or name plus operation.
 *
 * @remarks
 * A plain string listens to all write kinds on that sub-DB; the object
 * form narrows delivery to one `op`.
 *
 * @public
 */
export type ICdcFilter = string | {db: string; op?: `put` | `delete` | `clear`}

/**
 * In-process subscriber callback.
 *
 * @remarks
 * Invoked per matching record on drain. A throwing callback is reported to
 * the env's diagnostics sink and never breaks the writer's commit.
 *
 * @public
 */
export type ICdcCallback = (event: ICdcEvent) => void

/**
 * Tail options — consumer resume, lower bound, and batch cap.
 *
 * @remarks
 * A named `consumer` auto-registers on first tail (floor 0) and later
 * tails resume past its ack. An explicit `from` repositions forward past
 * the ack but never backward.
 *
 * @public
 */
export interface ICdcTailOptions {
  /**
   * Named persistent consumer (auto-registers on first tail).
   */
  consumer?: string
  /**
   * Lower sequence bound (exclusive); consumer ack wins when lower.
   */
  from?: number
  /**
   * Maximum records returned.
   */
  limit?: number
}
