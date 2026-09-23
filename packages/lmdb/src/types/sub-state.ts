import type {IEnvForSub} from "../env"
import type {ICodec} from "./codec"
import type {IndexDescriptor} from "./indexes"
import type {ISearchTable} from "./search"

/**
 * Per-sub-DB state kept by {@link LmdbEnvSubManager}.
 *
 * @internal
 */
export type LmdbSubState = {
  /**
   * Sub-DB name (the schema's `static db`).
   */
  dbName: string
  /**
   * Sub-DB handle combined with root-env methods — the same shape the sub handle operates on.
   */
  env: IEnvForSub
  /**
   * Optional write/read hook pair (schema `hookBeforeWrite`/`hookBeforeRead` bridge).
   */
  codec?: ICodec<unknown>
  /**
   * Pre-resolved read hook — decided once per state.
   */
  hookBeforeRead: (raw: unknown) => unknown
  /**
   * Attached embedded-index descriptors.
   */
  indexes: IndexDescriptor[]
  /**
   * O(1) index-name → descriptor lookup (built alongside `indexes`).
   */
  indexByName: Map<string, IndexDescriptor>
  /**
   * Attached full-text search tables (one per searched column).
   */
  searchTables: ISearchTable[]
  /**
   * Cached key-type probe result (plan 007 P1).
   */
  keyType?: `string` | `buffer` | `number` | `empty`
  /**
   * Sub-DB flags + codec — mirrors the old collection constructor opts.
   */
  opts: {
    dupSort: boolean
    useVersions: boolean
    encoding?: string
    codec?: ICodec<unknown>
  }
  /**
   * Whether this collection is a TTL collection (envelope-wrapped).
   */
  isTtl: boolean
  /**
   * Collection-wide default TTL in ms (only when `isTtl`).
   */
  ttlMs?: number
}
