import type {LmdbSchema} from "../schema"
import type {ICodec} from "./codec"
import type {IIndexDef} from "./indexes"
import type {ILmdbKey} from "./key"

/**
 * Schema class usable as a `Map` key for sub-DB state lookups.
 *
 * @remarks
 * `typeof LmdbSchema` itself rather than a generic subclass, so the
 * registry maps accept any schema class plus the internal meta schema.
 *
 * @internal
 */
export type ISchemaConstructor = typeof LmdbSchema

/**
 * Sub-DB construction options for the sub registry.
 *
 * @remarks
 * Shared by {@link LmdbEnvSubManager.register} (which builds it from
 * schema metadata) and the internal sub-state factory (which also reads
 * `keyEncoding` for composite tables).
 *
 * @internal
 */
export interface ISubStateOptions {
  /**
   * Open the sub-DB with duplicate-keys sorting.
   */
  dupSort?: boolean
  /**
   * Open the sub-DB with record versions (optimistic locking).
   */
  useVersions?: boolean
  /**
   * Native value encoding override for the sub-DB.
   */
  encoding?: string
  /**
   * Native key encoding override for the sub-DB.
   */
  keyEncoding?: string
  /**
   * Row codec bridging the hook slot (positional record storage).
   */
  codec?: ICodec<unknown>
  /**
   * TTL in ms — presence marks the sub as a TTL collection.
   */
  ttlMs?: number
}

/**
 * Index descriptor with its resolved sub-DB name.
 *
 * @remarks
 * Derived descriptors carry no `dbName` (schema indexes); the manager
 * resolves `${db}:idx:${name}` (or a custom name) before attaching.
 *
 * @internal
 */
export interface IResolvedIndexDef {
  /**
   * Index name (explicit override or derived column name).
   */
  name: string
  /**
   * Uniqueness, extractor, and composite marker.
   */
  def: IIndexDef<unknown, ILmdbKey>
  /**
   * Resolved sub-DB name holding the index table.
   */
  dbName: string
}
