import type {LmdbSubState} from "./sub-state"

/**
 * Runtime shape of one attached full-text search table.
 *
 * @remarks
 * One entry per `t.string().search()` column: `column` is the value field,
 * `state` the `{db}:search:{column}` dupSort sub-DB holding term → PK rows.
 *
 * @public
 */
export interface ISearchTable {
  /**
   * Searched value column name.
   */
  column: string
  /**
   * Backing dupSort sub-DB state (terms to primary keys).
   */
  state: LmdbSubState
}
