/**
 * Codec for custom value transformations in {@link LmdbRepository}.
 *
 * @remarks
 * Most repositories do NOT need a Codec — LMDB encodes values natively
 * (see {@link LmdbEncoding}). A Codec is only useful for custom
 * transformations (e.g. `Date → number`, or wrapping a primitive in a
 * domain-specific envelope).
 *
 * When `static codec` is set on a Repository:
 * 1. `serialize(value)` runs first (your custom transform)
 * 2. LMDB then encodes the result using the sub-database's encoding
 *
 * To get human-readable JSON, use `static encoding = "json"` on the
 * Repository — LMDB does `JSON.stringify`/`JSON.parse` natively without
 * any codec, avoiding double encoding.
 *
 * @packageDocumentation
 * @public
 */

import type {ICodec} from "./types"

/**
 * Base class for custom value codecs.
 *
 * @typeParam T - The typed value handled by this codec.
 *
 * @public
 */
export abstract class LmdbCodec<T = any> implements ICodec<T> {
  /**
   * Convert a typed value into a form LMDB will encode.
   *
   * @param value - The typed value to serialize.
   * @returns The pre-encoding representation passed to LMDB.
   *
   * @public
   */
  abstract serialize(value: T): unknown

  /**
   * Convert LMDB-decoded value back into a typed value.
   *
   * @param raw - The decoded value from LMDB.
   * @returns The deserialized typed value.
   *
   * @public
   */
  abstract deserialize(raw: unknown): T

  /**
   * Factory: wrap a serialize/deserialize function pair in a Codec instance.
   *
   * @typeParam T - Typed value.
   * @typeParam R - Pre-encoding form passed to LMDB.
   * @param serialize - Function converting typed value → pre-encoding form.
   * @param deserialize - Function converting post-decoding form → typed value.
   * @returns A new {@link LmdbCodec} instance wrapping the two functions.
   *
   * @example
   * ```typescript
   * class DateRepo extends LmdbRepository<Date, string> {
   *   static dbName = `dates`
   *   static codec = LmdbCodec.create<Date, number>(
   *     (d) => d.getTime(),
   *     (n) => new Date(n)
   *   )
   * }
   * ```
   *
   * @public
   */
  static create<T, R = unknown>(
    serialize: (value: T) => R,
    deserialize: (raw: R) => T
  ): ICodec<T> {
    return new LmdbCodecConfigurable<T>(
      serialize as (value: T) => unknown,
      deserialize as (raw: unknown) => T
    )
  }
}

/**
 * Codec that wraps a custom serialize/deserialize function pair.
 *
 * @remarks
 * Created via {@link LmdbCodec.create}. Stored form type and value type are
 * independent — typically `R` is `number`/`string`/`Buffer` (a primitive
 * that LMDB will then encode).
 *
 * @typeParam T - Typed value.
 *
 * @internal
 */
export class LmdbCodecConfigurable<T> extends LmdbCodec<T> {
  constructor(
    private readonly _serialize: (value: T) => unknown,
    private readonly _deserialize: (raw: unknown) => T
  ) {
    super()
  }

  /**
   * @inheritdoc
   */
  serialize(value: T): unknown {
    return this._serialize(value)
  }

  /**
   * @inheritdoc
   */
  deserialize(raw: unknown): T {
    return this._deserialize(raw)
  }
}

/**
 * Determine the effective codec for a {@link LmdbRepository} subclass.
 *
 * @remarks
 * Resolution order:
 * 1. If a custom codec instance was passed via the repository's static
 *    `codec` property, use it.
 * 2. If the subclass defines static `serialize`/`deserialize`, wrap them.
 * 3. Otherwise, return `undefined` (no codec — LMDB encodes values natively
 *    based on the sub-database's `encoding` option).
 *
 * @param repoClass - The LmdbRepository subclass constructor.
 * @returns The resolved {@link ICodec} for the repository, or `undefined`
 * if no codec is needed.
 *
 * @internal
 */
export function resolveCodec(repoClass: any): ICodec<any> | undefined {
  const statics = repoClass

  if (statics.codec) {
    return statics.codec
  }

  if (typeof statics.serialize === `function` || typeof statics.deserialize === `function`) {
    return {
      serialize: typeof statics.serialize === `function` ? statics.serialize : (v: unknown) => v,
      deserialize: typeof statics.deserialize === `function` ? statics.deserialize : (r: unknown) => r
    }
  }

  return undefined
}