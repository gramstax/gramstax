import type {KeyOf, LmdbSchema} from "../schema"

/**
 * Options for {@link LmdbSyncStream}.
 *
 * @remarks
 * Every field is optional — omitted fields select the default full
 * verified copy under the destination-db stream name.
 *
 * @public
 */
export interface ISyncOptions<S extends typeof LmdbSchema = typeof LmdbSchema> {
  /**
   * Stream name for the persisted cursor (defaults to the destination db).
   */
  name?: string
  /**
   * One-shot exclusive lower bound (ignores and preserves the stored cursor).
   */
  checkpoint?: KeyOf<S>
  /**
   * Maximum rows copied this run (a truncated run reports `verified: false`).
   */
  limit?: number
  /**
   * Run the count+hash verify step (default `true`).
   */
  verify?: boolean
}

/**
 * Result of {@link LmdbSyncStream}.
 *
 * @public
 */
export interface ISyncResult<S extends typeof LmdbSchema = typeof LmdbSchema> {
  /**
   * Rows copied this run.
   */
  copied: number
  /**
   * Last copied key (`undefined` when nothing was copied).
   */
  checkpoint: KeyOf<S> | undefined
  /**
   * Whether the verify step ran clean.
   */
  verified: boolean
}
