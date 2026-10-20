import type {LmdbSchema} from "../schema"
import type {IIndexDef} from "./indexes"
import type {ILmdbKey} from "./key"

/**
 * Column value kinds supported by the {@link t} builders.
 *
 * @remarks
 * Each member maps to a TypeScript type in {@link IInferSchemaValue} via
 * `ITsKind` (see {@link IColumnBuilder}).
 *
 * @public
 */
export type IColumnKind = `string` | `number` | `bigint` | `boolean` | `object` | `array` | `date` | `buffer` | `any` | `map` | `set`

/**
 * Type-level index marker carried by a {@link IColumnBuilder}.
 *
 * @remarks
 * The runtime flags on a builder are plain `boolean`/`string`, so they widen
 * away any literal information. Each modifier instead re-tags the builder
 * with this literal marker: `.unique()` → `"unique"`, `.index(...)` →
 * `"index"`, base builders stay `"none"`. {@link ISchemaIndexesOf} key-remaps
 * columns through the marker to recover literal index keys.
 *
 * @public
 */
export type IColumnIndexFlag = `none` | `index` | `unique`

/**
 * Any concrete {@link IColumnBuilder} regardless of its literal index marker.
 *
 * @remarks
 * The narrowed defaults (`I = "none"`, `N = undefined`) reject builders
 * tagged `"unique"`/`"index"` by callers, so generic constraints over a
 * column-definition map must widen to this type — the concrete `D` generic
 * still captures the literal markers per column.
 *
 * @public
 */
export type IAnyColumnBuilder = IColumnBuilder<IColumnKind, IColumnIndexFlag, string | undefined, unknown, boolean>

/**
 * Union of accepted runtime shapes for param-based builders —
 * `t.object({...})` / `t.array({...})` / `t.map({key, value})` /
 * `t.set({...})`. A shape is either a single {@link IAnyColumnBuilder}
 * (`t.array(t.string())`), an array of builders (`t.array([t.string()])` —
 * element becomes an array of the mapped scalar types), or a value-column
 * map (`t.array({name: t.string()})`).
 *
 * @internal
 */
export type IAnyShapeParam = IAnyColumnBuilder | readonly IAnyColumnBuilder[] | Record<string, IAnyColumnBuilder>

/**
 * Join composite columns with `+` at the type level (`['a','b']` → `'a+b'`).
 *
 * @remarks
 * Mirrors the runtime `columns.join('+')` in `makeBuilder` so the composite
 * index name stays literal in {@link ISchemaIndexesOf}.
 *
 * @internal
 */
export type IJoinPlus<C extends readonly string[]> = C extends readonly [infer H extends string, ...infer T extends Array<string>] ? (T extends readonly [] ? H : `${H}+${IJoinPlus<T>}`) : string

/**
 * Immutable column descriptor produced by the {@link t} builders.
 *
 * @remarks
 * Metadata object carrying the column's kind, index flags, and nullability.
 * Every modifier returns a NEW builder (spread-copy semantics) — the original
 * is never mutated. `kind` is carried as a generic type parameter so
 * {@link ValueOf} can map columns back to their TypeScript types.
 * `I` carries the {@link IColumnIndexFlag} literal and `N` the explicit index
 * name literal, so {@link ISchemaIndexesOf} can produce narrow per-index keys.
 * `V` carries the element/value type for `object`/`array` columns — set via
 * `t.object<T>()` / `t.array<T>()` (defaults: `Record<string, unknown>` /
 * `unknown`). `Nl` carries the nullability literal (`false` by default, `true`
 * after `.optional()`).
 * @typeParam Nl - Nullability literal — `false` (default) or `true` after `.optional()`.
 * @typeParam C - Composite column tuple for `.index([...])`, or `unknown` otherwise.
 *
 * @public
 */
export interface IColumnBuilder<K extends IColumnKind = IColumnKind, I extends IColumnIndexFlag = `none`, N extends string | undefined = undefined, V = unknown, Nl extends boolean = false, C = unknown> {
  /**
   * The column's value kind.
   */
  readonly kind: K
  /**
   * Whether the column participates in a unique index.
   *
   * @remarks
   * Flag form of the {@link IColumnBuilder.unique} modifier — named `isUnique`
   * so it cannot collide with the `unique()` method on the same object.
   */
  readonly isUnique: boolean
  /**
   * Explicit index name.
   *
   * @remarks
   * `""` (set by a no-argument `.index()` call) means "index under the column
   * name" — see {@link LmdbSchema.deriveIndexes}. The literal (when supplied
   * via `.index("name")`) is carried by the generic `N`.
   */
  readonly indexName: N
  /**
   * Literal index marker — see {@link IColumnIndexFlag}.
   *
   * @remarks
   * The type-level counterpart of `isUnique`/`indexName`: `"unique"` for
   * columns built with `.unique()`, `"index"` for columns built with
   * `.index(...)`, `"none"` otherwise. This is what keeps per-index keys
   * literal in {@link ISchemaIndexesOf}.
   */
  readonly indexFlag: I
  /**
   * Composite column list for concatenated-key indexes.
   *
   * @remarks
   * Set by `.index([...])` — the sub-DB `{db}:idx:{a+b}` keys rows by the
   * ordered tuple. `undefined` for single-column indexes. Cleared by
   * `.unique()`/`.index(name)`; preserved by the other modifiers. The tuple
   * literal is carried by the `C` generic for {@link ISchemaIndexesOf}.
   */
  readonly compositeColumns?: Array<string>
  /**
   * Type-level composite column tuple (phantom — never materialized).
   *
   * @remarks
   * Carries the `.index([...])` literal for {@link ISchemaIndexesOf} while
   * `compositeColumns` carries the runtime list, keeping assignability to
   * {@link IAnyColumnBuilder} intact either way.
   *
   * @internal
   */
  readonly compositeMarker?: C
  /**
   * Whether the column is full-text searchable.
   *
   * @remarks
   * Flag form of the {@link IColumnBuilder.search} modifier — named
   * `isSearchable` so it cannot collide with the `search()` method on the
   * same object. Storage-only: it provisions a `{db}:search:{column}`
   * posting table and never changes the row type.
   */
  readonly isSearchable: boolean
  /**
   * Whether the column accepts `null`/`undefined` values.
   *
   * @remarks
   * Flag form of the {@link IColumnBuilder.optional} modifier — named
   * `isOptional` so it cannot collide with the `optional()` method on the
   * same object. `false` by default (not optional); `true` after
   * `.optional()`. The literal drives {@link ValueOf} column inference:
   * optional columns yield `T | undefined`.
   */
  readonly isOptional: Nl
  /**
   * Runtime shape for param-based builders — `t.object({...})` /
   * `t.array(t.string())` / `t.array([t.string()])` /
   * `t.array({...})`. Stored so registration can reject nested
   * `unique`/`index` flags (silent-ignore hazard) and so `ValueOf`
   * inference can recover the element type.
   *
   * @internal
   */
  readonly shape?: IAnyShapeParam
  /**
   * Allowed values for enum columns (`t.enum(...)` and the literal
   * params of `t.string(...)` / `t.number(...)` / `t.bigint(...)`).
   *
   * @remarks
   * Carried at runtime so write paths can validate (`LmdbError`
   * on out-of-enum values). `undefined` for non-enum columns (zero-cost:
   * validation is skipped). Preserved by `.unique()` / `.index()` /
   * `.optional()` copies.
   *
   * @public
   */
  readonly enumValues?: readonly unknown[]
  /**
   * Static default applied at write time when the field is `undefined`.
   */
  readonly defaultValue?: unknown
  /**
   * Whether a static default was declared via `.default()`.
   */
  readonly hasDefault?: boolean
  /**
   * Dynamic default factory applied at write time (wins over `.default()`).
   */
  readonly defaultFn?: () => unknown
  /**
   * Mark the column as a unique index.
   *
   * @remarks
   * Unique indexes ARE indexes — this implies {@link IColumnBuilder.index}:
   * the column registers as an index with `{unique: true}`.
   *
   * @returns A new builder with `isUnique: true`.
   */
  unique(): IColumnBuilder<K, `unique`, N, V, Nl>
  /**
   * Mark the column as an index.
   *
   * @remarks
   * Two forms: `.index(name?)` for a single-column index (replaces any
   * composite marker), and `.index([`a`, `b`, ...])` for a concatenated-key
   * composite over the listed columns (replaces any single marker, clears
   * `unique`). The composite is named `a+b`, lives in `{db}:idx:{a+b}`,
   * and is queried with full tuples (point), short tuples (prefix), or
   * `{start, end}` bounds (range). By convention declare it on the first
   * column; arity must be ≥ 2 (enforced at registration).
   *
   * @param name - Index name (single form), or the composite column list.
   * @returns A new builder carrying the index flag.
   */
  index<N2 extends string | undefined = undefined, const Cc extends readonly [string, ...string[]] | undefined = undefined>(
    name?: N2 | Cc
  ): [Cc] extends [undefined] ? IColumnBuilder<K, I extends `unique` ? `unique` : `index`, N2 extends string ? (N2 extends `` ? undefined : N2) : undefined, V, Nl, unknown> : IColumnBuilder<K, `index`, IJoinPlus<NonNullable<Cc>>, V, Nl, NonNullable<Cc>>
  /**
   * Mark the column as full-text searchable.
   *
   * @remarks
   * Storage-only: the row type is unchanged. Only valid on `string`
   * columns of row-shaped values (registration throws otherwise).
   *
   * @returns A new builder with `isSearchable: true`.
   */
  search(): IColumnBuilder<K, I, N, V, Nl>
  /**
   * Mark the column as optional.
   *
   * @returns A new builder with `isOptional: true`.
   */
  optional(): IColumnBuilder<K, I, N, V, true>
  /**
   * Static write-time default — applied when the field is `undefined`.
   *
   * @remarks
   * Implies `.optional()` (the field becomes omit-able). Replaces any
   * `.$defaultFn()` set before it (last call wins). Validated immediately:
   * wrong-kind values and out-of-enum values throw `LmdbError` here, not
   * at the first `put`. The parameter stays `unknown` on purpose — typing
   * it from the column would make the whole builder invariant and break
   * `AnyColumnBuilder` assignability.
   *
   * @param value - The default value (validated immediately against the
   * column kind and enum).
   * @returns A new builder with `isOptional: true` carrying the default.
   */
  default(value: unknown): IColumnBuilder<K, I, N, V, true>
  /**
   * Dynamic write-time default factory, called per write.
   *
   * @remarks
   * Same optionality as {@link IColumnBuilder.default}. Replaces any
   * `.default()` set before it (last call wins). The produced value is
   * validated like any write.
   *
   * @param fn - Factory producing the default per write.
   * @returns A new builder with `isOptional: true` carrying the factory.
   */
  $defaultFn(fn: () => unknown): IColumnBuilder<K, I, N, V, true>
}

/**
 * Value type inferred from a schema class's value columns.
 *
 * @remarks
 * Maps every value column to its TypeScript type — `T` by default,
 * `T | undefined` for optional (`.optional()`) columns. Prefer the short
 * alias {@link ValueOf} (`ValueOf<typeof UserSchema>`) over spelling this
 * out — `IInferSchemaValue<typeof UserSchema.value>` resolves to the same
 * value type, so values stay in sync with the schema definition without
 * manual interfaces.
 *
 * @typeParam D - Value column definition map (from `static value`).
 *
 * @public
 */
export type IInferSchemaValue<D extends Record<string, IAnyColumnBuilder>> = {
  [K in keyof (IRequiredColumnsOf<D> & IOptionalColumnsOf<D>)]: (IRequiredColumnsOf<D> & IOptionalColumnsOf<D>)[K]
}

/**
 * Required (non-optional) columns of a value-column map.
 *
 * @remarks
 * Key-remaps `D` to the columns whose `isOptional` is not `true`, mapping
 * each through `IColumnKindToTs`. Paired with
 * {@link IOptionalColumnsOf} by {@link IInferSchemaValue}.
 *
 * @internal
 */
type IRequiredColumnsOf<D extends Record<string, IAnyColumnBuilder>> = {
  [K in keyof D as D[K][`isOptional`] extends true ? never : K]: IColumnKindToTs<D[K][`kind`], D[K][`isOptional`], IColumnElementOf<D[K]>>
}

/**
 * Optional columns of a value-column map.
 *
 * @remarks
 * Key-remaps `D` to the columns whose `isOptional` is `true` (each key
 * optional via `?`), mapping each through `IColumnKindToTs`. Paired
 * with {@link IRequiredColumnsOf} by {@link IInferSchemaValue}.
 *
 * @internal
 */
type IOptionalColumnsOf<D extends Record<string, IAnyColumnBuilder>> = {
  [K in keyof D as D[K][`isOptional`] extends true ? K : never]?: IColumnKindToTs<D[K][`kind`], D[K][`isOptional`], IColumnElementOf<D[K]>>
}

/**
 * Resolve a column kind + nullability to its TypeScript type.
 *
 * @remarks
 * `N` is a literal `false` (default) or `true` (after `.optional()`). When
 * `N` is `true` the result includes `| undefined`; otherwise it is the bare
 * TypeScript type. If `N` is `boolean` (e.g. inside a generic schema class
 * whose value columns are not fully resolved), the conditional distributes
 * and yields `T | undefined` as a safe fallback.
 *
 * @internal
 */
type IColumnKindToTs<K, N, V> = N extends true ? ITsKind<K, V> | undefined : ITsKind<K, V>

/**
 * Value type inferred from a param-based builder shape — `t.object({...})`
 * / `t.array({...})`. Maps each shape field through the same
 * `IColumnKindToTs` machinery as {@link IInferSchemaValue}, so
 * `.optional()` fields resolve to `T | undefined` and nested shapes
 * recursively to their object type.
 *
 * @internal
 */
export type IShapeValueOf<S extends Record<string, IAnyColumnBuilder> | undefined> = S extends Record<string, IAnyColumnBuilder> ? {[K in keyof (IRequiredColumnsOf<S> & IOptionalColumnsOf<S>)]: (IRequiredColumnsOf<S> & IOptionalColumnsOf<S>)[K]} : never

/**
 * Value type inferred from a param-based `t.map({key, value})` shape.
 *
 * @internal
 */
export type IShapeMapOf<S extends {key: IAnyColumnBuilder; value: IAnyColumnBuilder} | undefined> = S extends {key: IAnyColumnBuilder; value: IAnyColumnBuilder}
  ? Map<IColumnKindToTs<S[`key`][`kind`], S[`key`][`isOptional`], IColumnElementOf<S[`key`]>>, IColumnKindToTs<S[`value`][`kind`], S[`value`][`isOptional`], IColumnElementOf<S[`value`]>>>
  : never

/**
 * Element type inferred from a param-based `t.array`/`t.set` shape — a bare
 * builder (`t.array(t.string())` → `string`), an array of builders
 * (`t.array([t.string()])` → `string[]`, i.e. nested arrays), or a field map
 * (`t.array({name: t.string()})` → `{name: string}`).
 *
 * @internal
 */
export type IShapeElementOf<S extends IAnyShapeParam | undefined> = S extends IAnyColumnBuilder ? IScalarValueOf<S> : S extends readonly IAnyColumnBuilder[] ? Array<IScalarValueOf<S[number]>> : S extends Record<string, IAnyColumnBuilder> ? IShapeValueOf<S> : never

/**
 * Map a column kind to its TypeScript type.
 *
 * @remarks
 * `object` columns map to their carried value type `V` (falling back to
 * `Record<string, unknown>` for a bare `unknown`); `array` columns map to
 * `V[]`; `map`/`set` map to their carried type `V`.
 *
 * @internal
 */
type ITsKind<K, V = unknown> = K extends `string`
  ? unknown extends V
    ? string
    : V extends string
      ? V
      : string
  : K extends `number`
    ? unknown extends V
      ? number
      : V extends number
        ? V
        : number
    : K extends `bigint`
      ? unknown extends V
        ? bigint
        : V extends bigint
          ? V
          : bigint
      : K extends `boolean`
        ? boolean
        : K extends `object`
          ? unknown extends V
            ? Record<string, unknown>
            : V
          : K extends `array`
            ? V[]
            : K extends `date`
              ? Date
              : K extends `buffer`
                ? Uint8Array
                : K extends `any`
                  ? unknown
                  : K extends `map`
                    ? V
                    : K extends `set`
                      ? V
                      : never

/**
 * Recover the element/value type carried by a {@link IColumnBuilder}'s `V`
 * generic (`t.object<T>()` / `t.array<T>()`).
 *
 * @internal
 */
type IColumnElementOf<C> = C extends IColumnBuilder<IColumnKind, IColumnIndexFlag, string | undefined, infer V, boolean> ? V : unknown

/**
 * Key type inferred from a schema class's `key` builder.
 *
 * @remarks
 * Gives the key VALUE type (`bigint` for `key: t.bigint()`), usable as
 * `KeyOf<S>`'s key parameter. Prefer the short alias {@link KeyOf}
 * (`KeyOf<typeof UserSchema>`) — it intersects with `ILmdbKey` exactly like
 * the runtime {@link LmdbEnv.register} overload does.
 *
 * @typeParam C - The key column builder (from `static key`).
 *
 * @public
 */
export type IInferSchemaKey<C extends IAnyColumnBuilder> = C extends IColumnBuilder<infer K, IColumnIndexFlag, string | undefined, infer V, boolean> ? ITsKind<K, V> : never

/**
 * Index-definition map of a schema's VALUE columns.
 *
 * @remarks
 * Key-remaps a value-column definition map `D` (whose keys are literal when
 * the user declares `static value` as an object literal) into an
 * `IIndexDefs`-compatible map (`Record<string, IIndexDef<unknown, ILmdbKey>>`),
 * i.e. the schema index map (`SchemaIndexesOf`). Only columns whose
 * {@link IColumnBuilder.indexFlag} is `"index"` or `"unique"` produce entries;
 * the index name is the explicit `.index("name")` literal when set, otherwise
 * the column key. Unique columns carry `{unique: true}` so `findByIndex`'s
 * return type narrows per query exactly like a class collection's
 * `as const` `static indexes`. Unknown keys (`coll.findByIndex({nope: 1})`)
 * are therefore compile errors instead of silently passing. Scalar schemas
 * (`static value = t.number()`) yield the empty map `{}`.
 *
 * @typeParam D - Value column definition map (each entry a {@link IColumnBuilder}).
 *
 * @public
 */
export type ISchemaIndexesOf<D extends IAnyColumnBuilder | Record<string, IAnyColumnBuilder>> = IIndexMapOf<D>

/**
 * Index-map dispatch helper — scalar builders yield `{}`, column maps yield
 * the remapped index map. The generic `V` makes the conditional distribute
 * when `V` is a union (e.g. `S['value']` on a generic schema class).
 *
 * @internal
 */
type IIndexMapOf<V> = V extends {kind: IColumnKind}
  ? object
  : V extends Record<string, IAnyColumnBuilder>
    ? {
        [K in keyof V as V[K][`indexFlag`] extends `unique` ? (V[K][`indexName`] extends string ? V[K][`indexName`] : K) : V[K][`indexFlag`] extends `index` ? (V[K][`indexName`] extends string ? V[K][`indexName`] : K) : never]: V[K][`indexFlag`] extends `unique`
          ? IIndexDef<unknown, ILmdbKey> & {unique: true}
          : V[K] extends IColumnBuilder<IColumnKind, IColumnIndexFlag, string | undefined, unknown, boolean, infer Cc>
            ? NonNullable<Cc> extends readonly [string, ...string[]]
              ? IIndexDef<unknown, ILmdbKey> & {composite: NonNullable<Cc>}
              : IIndexDef<unknown, ILmdbKey>
            : IIndexDef<unknown, ILmdbKey>
      }
    : never

/**
 * Row value of a schema's `static value` — dispatches scalar builders to
 * their scalar type and column maps to {@link IInferSchemaValue}. The
 * generic `V` makes the conditional distribute when `V` is a union (e.g.
 * `S['value']` on a generic schema class).
 *
 * @internal
 */
type IValueOfDispatch<V> = V extends {kind: IColumnKind} ? IScalarValueOf<Extract<V, IAnyColumnBuilder>> : V extends Record<string, IAnyColumnBuilder> ? IInferSchemaValue<V> : never

/**
 * Value type inferred from a schema class.
 *
 * @remarks
 * Short alias for `IInferSchemaValue<typeof X.value>` — the value type
 * derived from a schema class's `static value` columns. For scalar schemas
 * (`static value = t.number()`), resolves to the scalar's TypeScript type:
 *
 * ```typescript
 * type UserValue = ValueOf<typeof UserSchema>
 * type CounterValue = ValueOf<typeof CounterSchema> // number
 * ```
 *
 * Columns are `T` by default and become `T | undefined` only when declared
 * optional (`.optional()`).
 *
 * @typeParam S - The schema class (a `typeof LmdbSchema` subclass).
 *
 * @public
 */
export type ValueOf<S extends typeof LmdbSchema> = IValueOfDispatch<S[`value`]>

/**
 * Scalar value type of a {@link IColumnBuilder} — maps a scalar column's kind
 * + nullability + carried element type to its TypeScript type (used by
 * {@link ValueOf} for scalar-value schemas).
 *
 * @internal
 */
type IScalarValueOf<C extends IAnyColumnBuilder> = IColumnKindToTs<C[`kind`], C[`isOptional`], IColumnElementOf<C>>

/**
 * Key type inferred from a schema class.
 *
 * @remarks
 * Short alias for `IInferSchemaKey<typeof X.key> & ILmdbKey` — the key value
 * type intersected with `ILmdbKey`, mirroring the runtime
 * {@link LmdbEnv.register} overload (lmdb-js keys are
 * `Key[] | string | symbol | number | boolean | Uint8Array`), so a
 * `t.bigint()` key column degrades to `never` at the type level:
 *
 * ```typescript
 * type UserKey = KeyOf<typeof UserSchema>
 * ```
 *
 * @typeParam S - The schema class (a `typeof LmdbSchema` subclass).
 *
 * @public
 */
export type KeyOf<S extends typeof LmdbSchema> = IInferSchemaKey<S[`key`]> & ILmdbKey

/**
 * Collection type materialized from a schema class.
 *
 * @remarks
 * Resolves the schema-derived types (`ValueOf`/`KeyOf`/`SchemaIndexesOf`) when
 * passed to {@link LmdbEnv.register} — the value type (via {@link ValueOf}),
 * the key type (via {@link KeyOf}, intersected with `ILmdbKey` to mirror the
 * runtime `register` overload), and the narrow per-index definitions from
 * {@link ISchemaIndexesOf}. Prefer this over spelling out the three type
 * parameters by hand. This is also the fallback when you want a single alias
 * instead of a `typeof X.$infer`-style helper — TypeScript does not polymorph
 * `this` in static getters, so the value type stays `ValueOf<typeof X>` while
 * `env` methods accept the schema class directly:
 *
 * ```typescript
 * class UserSchema extends LmdbSchema {
 *   static db = `users`
 *   static key = t.number()
 *   static value = {
 *     id: t.number().unique(),
 *     username: t.string().index(),
 *     email: t.string()
 *   }
 * }
 *
 * type UserColl = LmdbSchema
 * env.register(UserSchema)
 * ```
 *
 * @typeParam S - The schema class (a `typeof LmdbSchema` subclass).
 *
 * @public
 */
