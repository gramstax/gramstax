import {LmdbError} from "./errors"
import type {IIndexDef, ILmdbKey} from "./types"

/**
 * Column value kinds supported by the {@link t} builders.
 *
 * @remarks
 * Each member maps to a TypeScript type in {@link InferSchemaValue} via
 * `TsKind` (see {@link ColumnBuilder}).
 *
 * @public
 */
export type ColumnKind = `string` | `number` | `bigint` | `boolean` | `object` | `array` | `date` | `buffer` | `any` | `map` | `set`

/**
 * Type-level index marker carried by a {@link ColumnBuilder}.
 *
 * @remarks
 * The runtime flags on a builder are plain `boolean`/`string`, so they widen
 * away any literal information. Each modifier instead re-tags the builder
 * with this literal marker: `.unique()` → `"unique"`, `.index(...)` →
 * `"index"`, base builders stay `"none"`. {@link SchemaIndexesOf} key-remaps
 * columns through the marker to recover literal index keys.
 *
 * @public
 */
export type ColumnIndexFlag = `none` | `index` | `unique`

/**
 * Any concrete {@link ColumnBuilder} regardless of its literal index marker.
 *
 * @remarks
 * The narrowed defaults (`I = "none"`, `N = undefined`) reject builders
 * tagged `"unique"`/`"index"` by callers, so generic constraints over a
 * column-definition map must widen to this type — the concrete `D` generic
 * still captures the literal markers per column.
 *
 * @public
 */
export type AnyColumnBuilder = ColumnBuilder<ColumnKind, ColumnIndexFlag, string | undefined, unknown, boolean>

/**
 * Union of accepted runtime shapes for param-based builders —
 * `t.object({...})` / `t.array({...})` / `t.map({key, value})` /
 * `t.set({...})`. A shape is either a single {@link AnyColumnBuilder}
 * (`t.array(t.string())`), an array of builders (`t.array([t.string()])` —
 * element becomes an array of the mapped scalar types), or a value-column
 * map (`t.array({name: t.string()})`).
 *
 * @internal
 */
export type AnyShapeParam = AnyColumnBuilder | readonly AnyColumnBuilder[] | Record<string, AnyColumnBuilder>

/**
 * Immutable column descriptor produced by the {@link t} builders.
 *
 * @remarks
 * Metadata object carrying the column's kind, index flags, and nullability.
 * Every modifier returns a NEW builder (spread-copy semantics) — the original
 * is never mutated. `kind` is carried as a generic type parameter so
 * {@link ValueOf} can map columns back to their TypeScript types.
 * `I` carries the {@link ColumnIndexFlag} literal and `N` the explicit index
 * name literal, so {@link SchemaIndexesOf} can produce narrow per-index keys.
 * `V` carries the element/value type for `object`/`array` columns — set via
 * `t.object<T>()` / `t.array<T>()` (defaults: `Record<string, unknown>` /
 * `unknown`). `Nl` carries the nullability literal (`false` by default, `true`
 * after `.nullable()`).
 *
 * @typeParam K - The column kind (a member of {@link ColumnKind}).
 * @typeParam I - Literal index marker (`"none"` | `"index"` | `"unique"`).
 * @typeParam N - Literal explicit index name, or `undefined` for the default.
 * @typeParam V - Element/value type for `object`/`array` kinds; unused for other kinds.
 * @typeParam Nl - Nullability literal — `false` (default) or `true` after `.nullable()`.
 *
 * @public
 */
export interface ColumnBuilder<K extends ColumnKind = ColumnKind, I extends ColumnIndexFlag = `none`, N extends string | undefined = undefined, V = unknown, Nl extends boolean = false> {
  /** The column's value kind. */
  readonly kind: K
  /**
   * Whether the column participates in a unique index.
   *
   * @remarks
   * Flag form of the {@link ColumnBuilder.unique} modifier — named `isUnique`
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
   * Literal index marker — see {@link ColumnIndexFlag}.
   *
   * @remarks
   * The type-level counterpart of `isUnique`/`indexName`: `"unique"` for
   * columns built with `.unique()`, `"index"` for columns built with
   * `.index(...)`, `"none"` otherwise. This is what keeps per-index keys
   * literal in {@link SchemaIndexesOf}.
   */
  readonly indexFlag: I
  /**
   * Whether the column accepts `null`/`undefined` values.
   *
   * @remarks
   * Flag form of the {@link ColumnBuilder.nullable} modifier — named
   * `isNullable` so it cannot collide with the `nullable()` method on the
   * same object. `false` by default (not nullable); `true` after
   * `.nullable()`. The literal drives {@link ValueOf} column inference:
   * nullable columns yield `T | undefined`.
   */
  readonly isNullable: Nl
  /**
   * Runtime shape for param-based builders — `t.object({...})` /
   * `t.array(t.string())` / `t.array([t.string()])` /
   * `t.array({...})`. Stored so registration can reject nested
   * `unique`/`index` flags (silent-ignore hazard) and so `ValueOf`
   * inference can recover the element type.
   *
   * @internal
   */
  readonly shape?: AnyShapeParam
  /**
   * Mark the column as a unique index.
   *
   * @remarks
   * Unique indexes ARE indexes — this implies {@link ColumnBuilder.index}:
   * the column registers as an index with `{unique: true}`.
   *
   * @returns A new builder with `isUnique: true`.
   */
  unique(): ColumnBuilder<K, `unique`, N, V, Nl>
  /**
   * Mark the column as an index.
   *
   * @param name - Index name; defaults to the column name when omitted.
   * @returns A new builder carrying the index flag.
   */
  index<N2 extends string | undefined = undefined>(name?: N2): ColumnBuilder<K, I extends `unique` ? `unique` : `index`, N2 extends string ? (N2 extends `` ? undefined : N2) : undefined, V, Nl>
  /**
   * Mark the column as nullable.
   *
   * @returns A new builder with `isNullable: true`.
   */
  nullable(): ColumnBuilder<K, I, N, V, true>
}

/**
 * Runtime check: is a value a single {@link ColumnBuilder} (scalar) rather
 * than a value-column map?
 *
 * @internal
 */
function isColumnBuilder(value: unknown): value is AnyColumnBuilder {
  return typeof value === `object` && value !== null && typeof (value as {kind?: unknown}).kind === `string`
}

/**
 * Reject nested `unique`/`index` flags inside a param-based builder shape
 * (`t.object({...})` / `t.array({...})`).
 *
 * @remarks
 * Embedded-index detection (`deriveIndexes`) only inspects top-level value
 * columns, so a `unique`/`index` buried inside a shape would be silently
 * ignored — a data-integrity hazard (duplicates would pass). Registration
 * therefore throws instead of ignoring. Nested index intent must use a
 * top-level dotted-path column (`"bio.email": t.string().unique()`).
 *
 * @internal
 */
function assertNoNestedIndex(builder: AnyColumnBuilder, db: string): void {
  const shape = builder.shape
  if (!shape) return
  const entries: Array<[string, AnyColumnBuilder]> = isColumnBuilder(shape)
    ? [[`*`, shape]]
    : Array.isArray(shape)
      ? shape.map((nested, i): [string, AnyColumnBuilder] => [String(i), nested])
      : Object.entries(shape).filter((e): e is [string, AnyColumnBuilder] => isColumnBuilder(e[1]))
  for (const [name, nested] of entries) {
    if (nested.isUnique || nested.indexName !== undefined) {
      throw new LmdbError(
        `Schema '${db}': nested unique/index on '${name}' inside a t.object/t.array shape is not supported — the index would be silently ignored. Declare it as a top-level dotted column instead, e.g. "bio.email": t.string().unique().`
      )
    }
    assertNoNestedIndex(nested, db)
  }
}

/**
 * Build a new {@link ColumnBuilder} with the given metadata.
 *
 * @remarks
 * Immutability comes from always constructing a fresh object; the modifier
 * methods delegate here with the updated flag. The `I`/`N` generics re-tag
 * the returned builder with the literal index marker + explicit index name;
 * the inner casts are safe because the runtime flags (`isUnique`,
 * `indexName`) stay plain `boolean`/`string`.
 *
 * @internal
 */
function makeBuilder<K extends ColumnKind, I extends ColumnIndexFlag = `none`, N extends string | undefined = undefined, V = unknown, Nl extends boolean = false>(kind: K, isUnique = false, indexName: string | undefined = undefined, isNullable: Nl = false as Nl, shape?: AnyShapeParam): ColumnBuilder<K, I, N, V, Nl> {
  return {
    kind,
    isUnique,
    indexName: indexName as N,
    indexFlag: (isUnique ? `unique` : indexName !== undefined ? `index` : `none`) as I,
    isNullable,
    shape,
    unique: (): ColumnBuilder<K, `unique`, N, V, Nl> => makeBuilder(kind, true, indexName, isNullable, shape) as ColumnBuilder<K, `unique`, N, V, Nl>,
    index: <N2 extends string | undefined = undefined>(name?: N2): ColumnBuilder<K, I extends `unique` ? `unique` : `index`, N2 extends string ? (N2 extends `` ? undefined : N2) : undefined, V, Nl> =>
      makeBuilder(kind, isUnique, name ?? ``, isNullable, shape) as ColumnBuilder<K, I extends `unique` ? `unique` : `index`, N2 extends string ? (N2 extends `` ? undefined : N2) : undefined, V, Nl>,
    nullable: (): ColumnBuilder<K, I, N, V, true> => makeBuilder(kind, isUnique, indexName, true as true, shape) as ColumnBuilder<K, I, N, V, true>
  } as ColumnBuilder<K, I, N, V, Nl>
}

/**
 * Column type builders.
 *
 * @remarks
 * Each builder creates a {@link ColumnBuilder} of the corresponding kind:
 * `t.string()`, `t.number()`, `t.bigint()`, `t.boolean()`, `t.object()`,
 * `t.array()`, `t.date()`, `t.buffer()`. Kind is preserved as a literal type
 * parameter (`ColumnBuilder<`string`>`), which is what drives
 * {@link InferSchemaValue}. `t.object<T>()` / `t.array<T>()` accept an
 * optional element/value type — `t.object<{bio: string}>()` infers the row
 * field as `{bio: string}` and `t.array<string>()` as `string[]`.
 *
 * @public
 */
export const t = {
  /** @returns A `string` column builder. */
  string: (): ColumnBuilder<`string`> => makeBuilder(`string`),
  /** @returns A `number` column builder. */
  number: (): ColumnBuilder<`number`> => makeBuilder(`number`),
  /** @returns A `bigint` column builder. */
  bigint: (): ColumnBuilder<`bigint`> => makeBuilder(`bigint`),
  /** @returns A `boolean` column builder. */
  boolean: (): ColumnBuilder<`boolean`> => makeBuilder(`boolean`),
  /**
   * An `object` column builder.
   *
   * @typeParam T - Value type of the object field (default `Record<string, unknown>`).
   * @returns A `Record<string, unknown>` column builder, or a builder of the
   * given `T` when supplied via `t.object<T>()`.
   */
  object: <T = Record<string, unknown>, S extends Record<string, AnyColumnBuilder> | undefined = undefined>(
    shape?: S
  ): ColumnBuilder<`object`, `none`, undefined, [S] extends [undefined] ? T : ShapeValueOf<S>> =>
    makeBuilder(`object`, false, undefined, false, shape) as ColumnBuilder<`object`, `none`, undefined, [S] extends [undefined] ? T : ShapeValueOf<S>>,
  /**
   * An `array` column builder.
   *
   * @typeParam T - Element type of the array field (default `unknown`).
   * @returns An `unknown[]` column builder, or a `T[]` builder when supplied
   * via `t.array<T>()`, or a builder of the element type inferred from a
   * shape — `t.array(t.string())` → `string[]`, `t.array([t.string()])` →
   * `string[][]` (nested arrays), `t.array({name: t.string()})` →
   * `{name: string}[]`.
   */
  array: <T = unknown, S extends AnyShapeParam | undefined = undefined>(
    shape?: S
  ): ColumnBuilder<`array`, `none`, undefined, [S] extends [undefined] ? T : ShapeElementOf<S>> =>
    makeBuilder(`array`, false, undefined, false, shape) as ColumnBuilder<`array`, `none`, undefined, [S] extends [undefined] ? T : ShapeElementOf<S>>,
  /** @returns A `Date` column builder. */
  date: (): ColumnBuilder<`date`> => makeBuilder(`date`),
  /** @returns A `Uint8Array` column builder. */
  buffer: (): ColumnBuilder<`buffer`> => makeBuilder(`buffer`),
  /** @returns An `any` column builder (type `unknown`). */
  any: (): ColumnBuilder<`any`> => makeBuilder(`any`),
  /**
   * A `Map` column builder.
   *
   * @typeParam K - Key type (default `unknown`).
   * @typeParam V - Value type (default `unknown`).
   */
  map: <K = unknown, V = unknown, S extends {key: AnyColumnBuilder; value: AnyColumnBuilder} | undefined = undefined>(
    shape?: S
  ): ColumnBuilder<`map`, `none`, undefined, [S] extends [undefined] ? Map<K, V> : ShapeMapOf<S>> =>
    makeBuilder(`map`, false, undefined, false, shape) as ColumnBuilder<`map`, `none`, undefined, [S] extends [undefined] ? Map<K, V> : ShapeMapOf<S>>,
  /**
   * A `Set` column builder.
   *
   * @typeParam T - Element type (default `unknown`).
   * @returns A `Set<unknown>` column builder, or a `Set<T>` builder when
   * supplied via `t.set<T>()`, or a builder of the element type inferred
   * from a shape — `t.set(t.string())` → `Set<string>`,
   * `t.set([t.string()])` → `Set<string[]>`, `t.set({name: t.string()})` →
   * `Set<{name: string}>`.
   */
  set: <T = unknown, S extends AnyShapeParam | undefined = undefined>(
    shape?: S
  ): ColumnBuilder<`set`, `none`, undefined, [S] extends [undefined] ? Set<T> : Set<ShapeElementOf<S>>> =>
    makeBuilder(`set`, false, undefined, false, shape) as ColumnBuilder<`set`, `none`, undefined, [S] extends [undefined] ? Set<T> : Set<ShapeElementOf<S>>>
}

/**
 * Declarative schema base class — extend it to describe a collection.
 *
 * @remarks
 * Subclass with `static db` (used as the collection's `dbName`),
 * `static key` (a single {@link ColumnBuilder} from the {@link t} builders
 * for the primary key), and `static value` (a map of value columns, each a
 * {@link ColumnBuilder}). The `key` column must NOT carry `unique`/`index` —
 * the key is implicitly the primary index and is excluded from the derived
 * `indexes`.
 *
 * Pass the class to {@link LmdbEnv.register} to materialize a typed
 * collection:
 *
 * ```typescript
 * class UserSchema extends LmdbSchema {
 *   static db = `users`
 *   static key = t.number()
 *   static value = {
 *     id: t.number().unique(),
 *     username: t.string().index(),
 *     email: t.string(),
 *     tags: t.array().nullable(),
 *     createdAt: t.date()
 *   }
 * }
 *
 * const users = env.register(UserSchema) // → registers the collection
 * type UserValue = ValueOf<typeof UserSchema>
 * ```
 *
 * Derived indexes match the {@link LmdbEnv} index attachment input shape:
 * each value column with `unique` or an index flag becomes
 * `{name: indexName ?? columnName, def: {unique}, dbName: undefined}` (see
 * {@link LmdbSchema.deriveIndexes}). The `attachIndexes` machinery
 * auto-resolves the index name as a (possibly dotted) field path on the
 * value, so the column name doubles as the field path.
 *
 * Optional `static hookBeforeWrite`/`static hookBeforeRead` functions transform rows at the
 * collection boundary — `hookBeforeWrite` runs before LMDB serializes the value and
 * `hookBeforeRead` after it deserializes it (e.g. `Date → number`). They must be
 * declared TOGETHER or registration throws.
 *
 * {@link LmdbSchema.validate} enforces the schema rules at registration time
 * (missing `db`/`key`/`value`, write-hook without read-hook or vice versa, a unique
 * or indexed `key`, duplicate index names); it is called lazily by
 * {@link LmdbEnv.register}. The inherited `static _schemaBrand` lets
 * {@link LmdbEnv.register} recognize schema classes at runtime.
 *
 * @public
 */
export abstract class LmdbSchema {
  /** Sub-database name — used as the registered collection's `dbName`. */
  static db: string
  /**
   * Key column builder — the collection's primary key.
   *
   * @remarks
   * Must be a single {@link ColumnBuilder} (from the {@link t} builders).
   * Must NOT carry `unique`/`index` — the key is implicitly the primary
   * index and is excluded from the derived `indexes`.
   */
  static key: AnyColumnBuilder
  /**
   * Value column definition — either a single {@link ColumnBuilder} (scalar
   * value collections: `static value = t.number()`, `t.buffer()`,
   * `t.array<T>()`, `t.object<T>()`) or a map of {@link ColumnBuilder}s
   * (row-shaped collections). Scalar values carry no derived indexes.
   *
   * @remarks
   * Each map column maps to a field of the row value type via
   * {@link InferSchemaValue}; columns carrying `.unique()`/`.index(...)`
   * become derived indexes (see {@link LmdbSchema.deriveIndexes}).
   */
  static value: AnyColumnBuilder | Record<string, AnyColumnBuilder>
  /**
   * Optional `dupSort` flag for the underlying sub-DB.
   *
   * @remarks
   * Set `static dupSort = true` for one-key-to-many-ordered-values
   * collections (e.g. `tag → postId` tables). Requires a scalar
   * `static value` (the stored duplicate values). Defaults to `false`.
   */
  static dupSort?: boolean
  /**
   * Optional `useVersions` flag for the underlying sub-DB.
   *
   * @remarks
   * Enable optimistic locking via LMDB record versions on this collection
   * (`env.compareAndSet` / `env.ifVersion` / `env.ifNoExists` require it).
   * Defaults to the env's `useVersions` when omitted.
   */
  static useVersions?: boolean
  /**
   * Optional value encoding for the underlying sub-DB.
   *
   * @remarks
   * One of `msgpack` (default), `json`, `binary`, `string`,
   * `ordered-binary`. Overrides the env-level encoding for this collection.
   */
  static encoding?: string
  /**
   * Optional write hook — converts a typed row to its stored form.
   *
   * @remarks
   * Runs before LMDB serializes the value (like a collection codec's
   * `serialize`). Must be declared together with
   * {@link LmdbSchema.hookBeforeRead} — declaring only one of the pair
   * throws at registration.
   *
   * @param value - The typed row about to be stored.
   * @returns The pre-encoding representation passed to LMDB.
   */
  static hookBeforeWrite?: (value: unknown) => unknown
  /**
   * Optional read hook — converts the stored form back to a typed row.
   *
   * @remarks
   * Runs after LMDB deserializes the value (like a collection codec's
   * `deserialize`). Must be declared together with
   * {@link LmdbSchema.hookBeforeWrite} — declaring only one of the pair
   * throws at registration.
   *
   * @param raw - The value as decoded by LMDB.
   * @returns The typed row.
   */
  static hookBeforeRead?: (raw: unknown) => unknown
  /**
   * Optional collection-wide default TTL in milliseconds.
   *
   * @remarks
   * When set, the registered collection is a TTL collection: every `put`
   * stores an expiry envelope and reads (`get`/`has`) treat expired entries
   * as missing. Priority: per-put `{ttlMs}` override → `static ttl` →
   * never expires.
   */
  static ttl?: number
  /**
   * Runtime discriminator for {@link LmdbEnv.register} — inherited by
   * subclasses, never read by user code.
   */
  static readonly _schemaBrand = true as const

  /**
   * Validate a schema subclass before registration.
   *
   * @remarks
   * Called lazily by {@link LmdbEnv.register} on every schema-class
   * registration (registration is once-per-class anyway). Throws
   * {@link LmdbError} when:
   * - `static db` is missing or empty
   * - only one of `static hookBeforeWrite` / `static hookBeforeRead` is declared
   * - `static key` is missing
   * - the `key` builder carries `unique`/`index`
   * - `static value` is missing or not a plain record
   * - two columns resolve to the same index name (explicit `.index("x")`
   *   names and derived column names)
   *
   * @param schemaClass - The schema subclass to validate.
   *
   * @throws {LmdbError} On any of the rules above.
   *
   * @public
   */
  static validate(schemaClass: typeof LmdbSchema): void {
    const className = schemaClass.name
    const db = schemaClass.db
    if (db === undefined || db === ``) {
      throw new LmdbError(`Schema class '${className}': missing static 'db'. Declare it, e.g. static db = \`users\`.`)
    }
    const hasWriteHook = typeof schemaClass.hookBeforeWrite === `function`
    const hasReadHook = typeof schemaClass.hookBeforeRead === `function`
    if (hasWriteHook !== hasReadHook) {
      throw new LmdbError(`Schema '${db}' (class '${className}'): static hookBeforeWrite and static hookBeforeRead must be declared together.`)
    }
    const key = schemaClass.key
    if (key === undefined) {
      throw new LmdbError(`Schema '${db}' (class '${className}'): missing required static 'key'. Declare it, e.g. static key = t.number().`)
    }
    if (key.isUnique || key.indexName !== undefined) {
      throw new LmdbError(`Schema '${db}': the 'key' column must not be unique or indexed — the key is the primary key and is not part of the derived indexes.`)
    }
    const value = schemaClass.value
    const isScalar = isColumnBuilder(value)
    if (value === undefined || value === null) {
      throw new LmdbError(`Schema '${db}' (class '${className}'): missing required static 'value'. Declare it, e.g. static value = {id: t.number(), ...} or static value = t.number().`)
    }
    if (!isScalar && (typeof value !== `object` || Array.isArray(value))) {
      throw new LmdbError(`Schema '${db}' (class '${className}'): missing required static 'value' map. Declare it, e.g. static value = {id: t.number(), ...}.`)
    }
    if (schemaClass.dupSort === true && !isScalar) {
      throw new LmdbError(`Schema '${db}' (class '${className}'): static dupSort = true requires a scalar static value (e.g. static value = t.string()).`)
    }
    if (isScalar) {
      assertNoNestedIndex(value, db)
      return
    }
    const seen = new Set<string>()
    for (const [columnName, column] of Object.entries(value)) {
      assertNoNestedIndex(column, db)
      if (column.isUnique || column.indexName !== undefined) {
        const indexName = column.indexName || columnName
        if (seen.has(indexName)) {
          throw new LmdbError(`Schema '${db}': duplicate index name '${indexName}'. Give each indexed column a distinct name or an explicit .index(name) override.`)
        }
        seen.add(indexName)
      }
    }
  }

  /**
   * Derive index descriptors from a schema's columns.
   *
   * @remarks
   * Same derivation as the former `lmdbSchema` body: every value column with
   * `unique` or an index flag becomes
   * `{name: indexName ?? columnName, def: {unique}, dbName: undefined}`.
   * Called by {@link LmdbEnv.register} after {@link LmdbSchema.validate};
   * validation already guarantees no duplicate names, so this never throws.
   *
   * @param columns - The schema's `static value` map.
   * @returns Index descriptors in the {@link LmdbEnv} index attachment shape.
   *
   * @public
   */
  static deriveIndexes(columns: AnyColumnBuilder | Record<string, AnyColumnBuilder>): Array<{name: string; def: IIndexDef<unknown, ILmdbKey>; dbName?: string}> {
    const indexes: Array<{name: string; def: IIndexDef<unknown, ILmdbKey>; dbName?: string}> = []
    if (isColumnBuilder(columns)) return indexes // scalar values carry no derived indexes
    for (const [columnName, column] of Object.entries(columns)) {
      if (columnName === `key`) continue
      if (column.isUnique || column.indexName !== undefined) {
        indexes.push({name: column.indexName || columnName, def: {unique: column.isUnique}, dbName: undefined})
      }
    }
    return indexes
  }
}

/**
 * Value type inferred from a schema class's value columns.
 *
 * @remarks
 * Maps every value column to its TypeScript type — `T` by default,
 * `T | undefined` for nullable (`.nullable()`) columns. Prefer the short
 * alias {@link ValueOf} (`ValueOf<typeof UserSchema>`) over spelling this
 * out — `InferSchemaValue<typeof UserSchema.value>` resolves to the same
 * value type, so values stay in sync with the schema definition without
 * manual interfaces.
 *
 * @typeParam D - Value column definition map (from `static value`).
 *
 * @public
 */
export type InferSchemaValue<D extends Record<string, AnyColumnBuilder>> = {
  [K in keyof D]: ColumnKindToTs<D[K][`kind`], D[K][`isNullable`], ColumnElementOf<D[K]>>
}

/**
 * Resolve a column kind + nullability to its TypeScript type.
 *
 * @remarks
 * `N` is a literal `false` (default) or `true` (after `.nullable()`). When
 * `N` is `true` the result includes `| undefined`; otherwise it is the bare
 * TypeScript type. If `N` is `boolean` (e.g. inside a generic schema class
 * whose value columns are not fully resolved), the conditional distributes
 * and yields `T | undefined` as a safe fallback.
 *
 * @internal
 */
type ColumnKindToTs<K, N, V> = N extends true ? TsKind<K, V> | undefined : TsKind<K, V>

/**
 * Value type inferred from a param-based builder shape — `t.object({...})`
 * / `t.array({...})`. Maps each shape field through the same
 * {@link ColumnKindToTs} machinery as {@link InferSchemaValue}, so
 * `.nullable()` fields resolve to `T | undefined` and nested shapes
 * recursively to their object type.
 *
 * @internal
 */
export type ShapeValueOf<S extends Record<string, AnyColumnBuilder> | undefined> = S extends Record<string, AnyColumnBuilder>
  ? {[K in keyof S]: ColumnKindToTs<S[K][`kind`], S[K][`isNullable`], ColumnElementOf<S[K]>>}
  : never

/**
 * Value type inferred from a param-based `t.map({key, value})` shape.
 *
 * @internal
 */
export type ShapeMapOf<S extends {key: AnyColumnBuilder; value: AnyColumnBuilder} | undefined> = S extends {key: AnyColumnBuilder; value: AnyColumnBuilder}
  ? Map<ColumnKindToTs<S[`key`][`kind`], S[`key`][`isNullable`], ColumnElementOf<S[`key`]>>, ColumnKindToTs<S[`value`][`kind`], S[`value`][`isNullable`], ColumnElementOf<S[`value`]>>>
  : never

/**
 * Element type inferred from a param-based `t.array`/`t.set` shape — a bare
 * builder (`t.array(t.string())` → `string`), an array of builders
 * (`t.array([t.string()])` → `string[]`, i.e. nested arrays), or a field map
 * (`t.array({name: t.string()})` → `{name: string}`).
 *
 * @internal
 */
export type ShapeElementOf<S extends AnyShapeParam | undefined> = S extends AnyColumnBuilder
  ? ScalarValueOf<S>
  : S extends readonly AnyColumnBuilder[]
    ? Array<ScalarValueOf<S[number]>>
    : S extends Record<string, AnyColumnBuilder>
      ? ShapeValueOf<S>
      : never

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
type TsKind<K, V = unknown> = K extends `string`
  ? string
  : K extends `number`
    ? number
    : K extends `bigint`
      ? bigint
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
 * Recover the element/value type carried by a {@link ColumnBuilder}'s `V`
 * generic (`t.object<T>()` / `t.array<T>()`).
 *
 * @internal
 */
type ColumnElementOf<C> = C extends ColumnBuilder<ColumnKind, ColumnIndexFlag, string | undefined, infer V, boolean> ? V : unknown

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
export type InferSchemaKey<C extends AnyColumnBuilder> = C extends {kind: infer K} ? TsKind<K> : never

/**
 * Index-definition map of a schema's VALUE columns.
 *
 * @remarks
 * Key-remaps a value-column definition map `D` (whose keys are literal when
 * the user declares `static value` as an object literal) into an
 * `IIndexDefs`-compatible map (`Record<string, IIndexDef<unknown, ILmdbKey>>`),
 * i.e. the schema index map (`SchemaIndexesOf`). Only columns whose
 * {@link ColumnBuilder.indexFlag} is `"index"` or `"unique"` produce entries;
 * the index name is the explicit `.index("name")` literal when set, otherwise
 * the column key. Unique columns carry `{unique: true}` so `findByIndex`'s
 * return type narrows per query exactly like a class collection's
 * `as const` `static indexes`. Unknown keys (`coll.findByIndex({nope: 1})`)
 * are therefore compile errors instead of silently passing. Scalar schemas
 * (`static value = t.number()`) yield the empty map `{}`.
 *
 * @typeParam D - Value column definition map (each entry a {@link ColumnBuilder}).
 *
 * @public
 */
export type SchemaIndexesOf<D extends AnyColumnBuilder | Record<string, AnyColumnBuilder>> = IndexMapOf<D>

/**
 * Index-map dispatch helper — scalar builders yield `{}`, column maps yield
 * the remapped index map. The generic `V` makes the conditional distribute
 * when `V` is a union (e.g. `S['value']` on a generic schema class).
 *
 * @internal
 */
type IndexMapOf<V> = V extends {kind: ColumnKind} ? object : V extends Record<string, AnyColumnBuilder> ? {
  [K in keyof V as V[K][`indexFlag`] extends `unique` ? (V[K][`indexName`] extends string ? V[K][`indexName`] : K) : V[K][`indexFlag`] extends `index` ? (V[K][`indexName`] extends string ? V[K][`indexName`] : K) : never]: V[K][`indexFlag`] extends `unique`
    ? IIndexDef<unknown, ILmdbKey> & {unique: true}
    : IIndexDef<unknown, ILmdbKey>
} : never

/**
 * Row value of a schema's `static value` — dispatches scalar builders to
 * their scalar type and column maps to {@link InferSchemaValue}. The
 * generic `V` makes the conditional distribute when `V` is a union (e.g.
 * `S['value']` on a generic schema class).
 *
 * @internal
 */
type ValueOfDispatch<V> = V extends {kind: ColumnKind} ? ScalarValueOf<Extract<V, AnyColumnBuilder>> : V extends Record<string, AnyColumnBuilder> ? InferSchemaValue<V> : never

/**
 * Value type inferred from a schema class.
 *
 * @remarks
 * Short alias for `InferSchemaValue<typeof X.value>` — the value type
 * derived from a schema class's `static value` columns. For scalar schemas
 * (`static value = t.number()`), resolves to the scalar's TypeScript type:
 *
 * ```typescript
 * type UserValue = ValueOf<typeof UserSchema>
 * type CounterValue = ValueOf<typeof CounterSchema> // number
 * ```
 *
 * Columns are `T` by default and become `T | undefined` only when declared
 * nullable (`.nullable()`).
 *
 * @typeParam S - The schema class (a `typeof LmdbSchema` subclass).
 *
 * @public
 */
export type ValueOf<S extends typeof LmdbSchema> = ValueOfDispatch<S[`value`]>

/**
 * Scalar value type of a {@link ColumnBuilder} — maps a scalar column's kind
 * + nullability + carried element type to its TypeScript type (used by
 * {@link ValueOf} for scalar-value schemas).
 *
 * @internal
 */
type ScalarValueOf<C extends AnyColumnBuilder> = ColumnKindToTs<C[`kind`], C[`isNullable`], ColumnElementOf<C>>

/**
 * Key type inferred from a schema class.
 *
 * @remarks
 * Short alias for `InferSchemaKey<typeof X.key> & ILmdbKey` — the key value
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
export type KeyOf<S extends typeof LmdbSchema> = InferSchemaKey<S[`key`]> & ILmdbKey

/**
 * Collection type materialized from a schema class.
 *
 * @remarks
 * Resolves the schema-derived types (`ValueOf`/`KeyOf`/`SchemaIndexesOf`) when
 * passed to {@link LmdbEnv.register} — the value type (via {@link ValueOf}),
 * the key type (via {@link KeyOf}, intersected with `ILmdbKey` to mirror the
 * runtime `register` overload), and the narrow per-index definitions from
 * {@link SchemaIndexesOf}. Prefer this over spelling out the three type
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
