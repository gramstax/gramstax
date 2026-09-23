import type {ILmdbKey} from "./key"
import type {LmdbSubState} from "./sub-state"

/**
 * Declarative embedded secondary index definition.
 *
 * @remarks
 * Declared via `static indexes` on a schema class:
 *
 * ```typescript
 * class UserSchema extends LmdbSchema {
 *   static db = `user`;
 *   static indexes = {
 *     email: {unique: true},            // auto-resolved field `user.email`
 *     emailLower: {extractor: (u) => u.email.toLowerCase()},
 *     profileCity: {dbName: `user:idx:city`}  // dotted path, custom dbName
 *   } as const;
 * }
 * ```
 *
 * When `extractor` is omitted the index name is treated as a field path on
 * the value (`username` → `value.username`, `profile.email` →
 * `value.profile.email`). A missing field path throws {@link LmdbError} on
 * the first write; a resolved `undefined`/`null` value skips the entry.
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam K - Key type of the index sub-DB (the indexed field's value type).
 *
 * @public
 */
export interface IIndexDef<T, K extends ILmdbKey = ILmdbKey> {
  /**
   * Extract the indexed value from a primary value.
   *
   * @remarks
   * Returning `undefined`/`null` skips the index entry. When omitted, the
   * index name is auto-resolved as a (possibly dotted) field path.
   */
  extractor?: (value: T) => K | undefined | null

  /**
   * Enforce uniqueness on this index.
   *
   * @remarks
   * `true` → SQL `CREATE UNIQUE INDEX`: a write whose index value is already
   * owned by a different primary key throws {@link LmdbError}
   * and rolls back. `false` (default) → SQL `CREATE INDEX` (duplicates allowed).
   * @defaultValue `false`
   */
  unique?: boolean

  /**
   * Override the auto-generated index sub-DB name.
   *
   * @remarks
   * Default is `` `${dbName}:idx:${name}` `` (Q3). Must not collide with any
   * other registered sub-DB name.
   */
  dbName?: string

  /**
   * Composite column list for concatenated-key indexes.
   *
   * @remarks
   * Set by `t.*.index([`a`, `b`])` via {@link LmdbSchema.deriveIndexes} —
   * the extractor returns the ordered tuple and the sub-DB pins
   * `ordered-binary` key/value encoding so tuples seek natively. Custom
   * `attachIndexes` definitions may set it alongside their own extractor.
   */
  composite?: Array<string>
}

/**
 * Explicit bounds for a composite index range seek.
 *
 * @remarks
 * Accepted as a `findByIndex` value for composite keys (`t.*.index([`a`,
 * `b`])`, queried as ``{[`a+b`]: {start, end}} ``). Either bound may be
 * omitted (open-ended); each present bound is a tuple of 1..arity elements.
 * `start` is inclusive, `end` is exclusive.
 *
 * @public
 */
export interface ICompositeRange {
  /**
   * Inclusive lower tuple bound.
   */
  start?: Array<ILmdbKey>
  /**
   * Exclusive upper tuple bound.
   */
  end?: Array<ILmdbKey>
}

/**
 * Declarative index definition map: `static indexes` shape.
 *
 * @remarks
 * `Record<string, IIndexDef<T, ILmdbKey>>` — every declared index name maps to
 * its {@link IIndexDef}. Used as the third type parameter of
 * a schema class so the subclass can bind its own `static indexes`
 * type: `class UserSchema extends LmdbSchema` with `static value` columns.
 *
 * @typeParam T - Value type of the primary collection.
 *
 * @public
 */
export type IIndexDefs<T = unknown> = Record<string, IIndexDef<T, ILmdbKey>>

/**
 * Value type of a single index key inside {@link IIndexQuery}.
 *
 * @remarks
 * Resolves to the indexed field's type when the index name is an auto-resolved
 * field path on `T` (`username` → `T["username"]`); otherwise falls back to
 * {@link ILmdbKey} (explicit extractors may index arbitrary key-shaped values).
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam P - Declared index name (a key of `static indexes`).
 *
 * @public
 */
export type IndexQueryValue<T, P extends string, D = unknown> = P extends keyof T ? T[P] : D extends {composite: readonly [string, ...string[]]} ? ILmdbKey | ICompositeRange : ILmdbKey

/**
 * Object query accepted by {@link LmdbEnv.findByIndex}: maps declared
 * index names to the values to match. Every supplied key is ANDed.
 *
 * @remarks
 * At least one key is required — the intersection term forces a non-empty
 * query, so `{}` is a compile-time error. The index definitions come from the
 * schema's index map type: `SchemaIndexesOf<typeof UserSchema[`value`]>`
 * with `static indexes` declared `as const` (so `unique: true` survives as a
 * literal type); without the self-reference or `as const`, queries still type
 * but the return type degrades to `T[]` for every query (runtime unchanged).
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam I - The collection's `static indexes` type.
 *
 * @public
 */
export type IIndexQuery<T, I> = Partial<{[P in keyof I]: IndexQueryValue<T, P & string, I[P]>}> & {[P in keyof I]-?: Record<P, IndexQueryValue<T, P & string, I[P]>>}[keyof I]

/**
 * Return type of {@link LmdbEnv.findByIndex} for a given query.
 *
 * @remarks
 * `T | undefined` when EVERY queried index is unique (`unique: true` — at
 * most one primary key can match, so a miss is `undefined`); `T[]` when ANY
 * queried index is non-unique (several primaries may share the value, so a
 * miss is an empty array).
 *
 * @typeParam T - Value type of the primary collection.
 * @typeParam I - The collection's `static indexes` type.
 * @typeParam Q - The concrete query type.
 *
 * @public
 */
export type IIndexResult<T, I, Q> = AllKeysUnique<I, Q> extends true ? T | undefined : T[]

/**
 * Whether every key present in query `Q` names a `unique: true` index.
 *
 * @remarks
 * `false` for empty queries and for queries touching any non-unique index.
 * With `as const` on `static indexes`, `unique: true` is a literal type and
 * the check resolves statically; without it the index definitions widen to
 * `IIndexDef` and every query reports `false` (degrades to `T[]`).
 *
 * @internal
 */
type AllKeysUnique<I, Q> = Extract<keyof Q, keyof I> extends never ? false : {[P in Extract<keyof Q, keyof I>]: I[P] extends {unique: true} ? true : false}[Extract<keyof Q, keyof I>] extends true ? true : false

/**
 * Runtime shape of one attached embedded-index descriptor.
 *
 * @remarks
 * Built at registration from the schema's declared indexes and kept on the
 * sub state — the write path walks `indexes` to maintain index rows in the
 * same writer transaction as the primary write.
 *
 * @public
 */
export type IndexDescriptor = {
  /**
   * Declared index name (the `static indexes` key).
   */
  name: string
  /**
   * Resolved value extractor (custom or auto-resolved field path).
   */
  extractor: (value: unknown) => ILmdbKey | undefined | null
  /**
   * Whether this index enforces uniqueness.
   */
  unique: boolean
  /**
   * State of the index's backing sub-DB (unique: plain map; non-unique: dupSort).
   */
  state: LmdbSubState
  /**
   * Whether the extractor was auto-resolved from the field path.
   */
  autoResolved: boolean
  /**
   * Composite column list (`undefined` for single-column indexes).
   */
  composite: Array<string> | undefined
}
