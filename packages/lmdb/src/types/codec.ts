/**
 * A write/read hook pair used by {@link LmdbEnv} for custom transforms.
 *
 * @remarks
 * Default encoding (lmdb-js native) is msgpack/JSON/etc. Use this to
 * transform rows at the repository boundary — `hookBeforeWrite` runs
 * before LMDB serializes the value, `hookBeforeRead` after it deserializes
 * it (e.g. `Date → number`). This runs BEFORE the native LMDB encoding.
 *
 * @public
 */
export interface ICodec<T> {
  /**
   * Convert a typed value to a storable representation.
   */
  hookBeforeWrite(value: T): unknown

  /**
   * Convert a stored representation back to a typed value.
   */
  hookBeforeRead(raw: unknown): T
}
