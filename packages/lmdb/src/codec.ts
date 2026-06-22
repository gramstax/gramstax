/**
 * Codec classes for {@link LmdbRepository} serialization.
 *
 * @remarks
 * The default codec is {@link LmdbCodecIdentity} (LMDB native msgpack).
 * Subclasses of {@link LmdbRepository} can override the static
 * `serialize` and `deserialize` methods, or provide a custom codec via
 * {@link LmdbCodec.create}.
 *
 * @packageDocumentation
 * @public
 */

import type {ICodec} from "./types"

/**
 * Base class for codecs that translate between typed values and LMDB-stored forms.
 *
 * @typeParam T - The typed value handled by this codec.
 *
 * @public
 */
export abstract class LmdbCodec<T = any> implements ICodec<T> {
  /**
   * Convert a typed value into a form LMDB can store.
   *
   * @param value - The typed value to serialize.
   * @returns The stored representation (string, Buffer, etc.).
   *
   * @public
   */
  abstract serialize(value: T): unknown

  /**
   * Convert an LMDB-stored representation back into a typed value.
   *
   * @param raw - The stored representation read from LMDB.
   * @returns The deserialized typed value.
   *
   * @public
   */
  abstract deserialize(raw: unknown): T

  /**
   * Factory: wrap a serialize/deserialize function pair in a Codec instance.
   *
   * @typeParam T - Typed value.
   * @typeParam R - Stored form returned by `serialize` and accepted by `deserialize`.
   * @param serialize - Function converting typed value → stored form.
   * @param deserialize - Function converting stored form → typed value.
   * @returns A new {@link LmdbCodec} instance wrapping the two functions.
   *
   * @example
   * ```typescript
   * const dateCodec = LmdbCodec.create<Date, number>(
   *   (d) => d.getTime(),
   *   (n) => new Date(n)
   * )
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
 * JSON-based codec. Opt-in for human-readable storage.
 *
 * @remarks
 * Serializes values via `JSON.stringify` and deserializes via `JSON.parse`.
 * Suitable for plain JSON-safe data (no `Date`, `Map`, `Set`, `BigInt`,
 * functions, or circular references).
 *
 * @public
 */
export class LmdbCodecJson extends LmdbCodec<any> {
  /**
   * @inheritdoc
   */
  serialize(value: any): string {
    return JSON.stringify(value)
  }

  /**
   * @inheritdoc
   */
  deserialize(raw: any): any {
    if (typeof raw !== `string`) {
      return raw
    }
    return JSON.parse(raw)
  }
}

/**
 * Identity codec — stores values as-is, no transformation.
 *
 * @remarks
 * Default codec. Lets LMDB encode values with its native MessagePack
 * encoding — works for any JS value (primitives, objects, arrays, nested
 * structures). Fastest, smallest on disk.
 *
 * @public
 */
export class LmdbCodecIdentity extends LmdbCodec<any> {
  /**
   * @inheritdoc
   */
  serialize(value: any): any {
    return value
  }

  /**
   * @inheritdoc
   */
  deserialize(raw: any): any {
    return raw
  }
}

/**
 * Codec that wraps a custom serialize/deserialize function pair.
 *
 * @remarks
 * Created via {@link LmdbCodec.create}. Stored form type and value type are
 * independent — typically `R` is `string` (for JSON-like encoding) or
 * `Buffer` (for binary encoding).
 *
 * @typeParam T - Typed value.
 *
 * @internal
 */
export class LmdbCodecConfigurable<T> extends LmdbCodec<T> {
  /**
   * @param serialize - Function converting typed value → stored form.
   * @param deserialize - Function converting stored form → typed value.
   */
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
 * 3. Otherwise, fall back to {@link LmdbCodecIdentity} (LMDB native msgpack —
 *    fastest, smallest; use `new LmdbCodecJson()` for human-readable storage).
 *
 * @param repoClass - The LmdbRepository subclass constructor.
 * @returns The resolved {@link ICodec} for the repository.
 *
 * @internal
 */
export function resolveCodec(repoClass: any): ICodec<any> {
  const statics = repoClass

  // 1. Explicit codec instance
  if (statics.codec) {
    return statics.codec
  }

  // 2. Static serialize/deserialize
  if (typeof statics.serialize === `function` || typeof statics.deserialize === `function`) {
    return {
      serialize: typeof statics.serialize === `function` ? statics.serialize : new LmdbCodecJson().serialize,
      deserialize: typeof statics.deserialize === `function` ? statics.deserialize : new LmdbCodecJson().deserialize
    }
  }

  // 3. Default — LmdbCodecIdentity (LMDB native msgpack)
  return new LmdbCodecIdentity()
}
