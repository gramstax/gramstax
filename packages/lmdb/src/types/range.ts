import type {Transaction} from "lmdb"
import type {ILmdbKey} from "./key"

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
  /**
   * Lower bound (inclusive). Iteration starts here.
   */
  start?: ILmdbKey

  /**
   * Upper bound (exclusive). Iteration stops before this key.
   */
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

  /**
   * Maximum number of entries to return.
   */
  limit?: number

  /**
   * Skip the first N entries. Useful with cursor iteration.
   */
  offset?: number

  /**
   * Reverse iteration order.
   */
  reverse?: boolean

  /**
   * Underlying LMDB read transaction object (set internally by
   * {@link LmdbEnv} when a transaction wrapper is passed).
   *
   * @internal
   */
  transaction?: Transaction
}
