import {RecordCodec} from "./codec"
import {LmdbError} from "./errors"
import type {IIndexDef} from "./types/indexes"
import type {ILmdbKey} from "./types/key"
import type {IAnyColumnBuilder, IAnyShapeParam, IColumnBuilder, IColumnIndexFlag, IColumnKind, IJoinPlus, IShapeElementOf, IShapeMapOf, IShapeValueOf} from "./types/schema"

export type {IAnyColumnBuilder, IAnyShapeParam, IColumnBuilder, IColumnIndexFlag, IColumnKind, IInferSchemaKey, IInferSchemaValue, ISchemaIndexesOf, IShapeElementOf, IShapeMapOf, IShapeValueOf, KeyOf, ValueOf} from "./types/schema"

/**
 * Column type builders.
 *
 * @remarks
 * Each builder creates a {@link IColumnBuilder} of the corresponding kind:
 * `t.string()`, `t.number()`, `t.bigint()`, `t.boolean()`, `t.object()`,
 * `t.array()`, `t.date()`, `t.buffer()`. Kind is preserved as a literal type
 * parameter (`ColumnBuilder<`string`>`), which is what drives
 * {@link IInferSchemaValue}. `t.object<T>()` / `t.array<T>()` accept an
 * optional element/value type — `t.object<{bio: string}>()` infers the row
 * field as `{bio: string}` and `t.array<string>()` as `string[]`.
 *
 * @public
 */
export const t = {
  /**
   * A `string` column builder with optional literal params (drizzle-style enum).
   *
   * @remarks
   * `t.string()` → `string`, `t.string('active', 'archived')` →
   * `'active' | 'archived'`. The literals ride the `V` generic so
   * `ValueOf`/`KeyOf`/`.optional()`/`.unique()`/`.index()` narrow
   * automatically, and are stored as `enumValues` for runtime validation
   * (`LmdbError` on out-of-enum writes).
   *
   * @param values - Allowed literals (empty call stays a wide `string`).
   * @returns A `string` column builder, narrowed to the literals union when given.
   */
  string: ((...values: Array<string>) => (values.length === 0 ? LmdbSchema.makeBuilder(`string`) : LmdbSchema.makeBuilder(`string`, false, undefined, false, undefined, values))) as {
    (): IColumnBuilder<`string`>
    <T extends string>(...values: T[]): IColumnBuilder<`string`, `none`, undefined, T>
  },
  /**
   * A `number` column builder with optional literal params.
   *
   * @remarks
   * `t.number()` → `number`, `t.number(1, 2)` → `1 | 2`. Literals are
   * stored as `enumValues` for runtime validation.
   *
   * @param values - Allowed literals (empty call stays a wide `number`).
   * @returns A `number` column builder, narrowed to the literals union when given.
   */
  number: ((...values: Array<number>) => (values.length === 0 ? LmdbSchema.makeBuilder(`number`) : LmdbSchema.makeBuilder(`number`, false, undefined, false, undefined, values))) as {
    (): IColumnBuilder<`number`>
    <T extends number>(...values: T[]): IColumnBuilder<`number`, `none`, undefined, T>
  },
  /**
   * A `bigint` column builder with optional literal params.
   *
   * @remarks
   * `t.bigint()` → `bigint`, `t.bigint(1n, 2n)` → `1n | 2n`. Literals are
   * stored as `enumValues` for runtime validation.
   *
   * @param values - Allowed literals (empty call stays a wide `bigint`).
   * @returns A `bigint` column builder, narrowed to the literals union when given.
   */
  bigint: ((...values: Array<bigint>) => (values.length === 0 ? LmdbSchema.makeBuilder(`bigint`) : LmdbSchema.makeBuilder(`bigint`, false, undefined, false, undefined, values))) as {
    (): IColumnBuilder<`bigint`>
    <T extends bigint>(...values: T[]): IColumnBuilder<`bigint`, `none`, undefined, T>
  },
  /**
   * A homogen enum column builder across `string` | `number` | `bigint`
   * (drizzle-style).
   *
   * @remarks
   * One builder for all three scalar kinds — the `kind` is inferred from
   * the first value: `t.enum('a', 'b')` → kind `string`,
   * `t.enum(1, 2)` → kind `number`, `t.enum(1n, 2n)` → kind `bigint`.
   * Homogen only: mixed kinds (`t.enum('a', 1)`) throw `LmdbError`, as
   * does the empty call (`t.enum()`). Allowed values are stored as
   * `enumValues` for runtime validation.
   *
   * @param values - Allowed literals, all of one kind (non-empty).
   * @returns A column builder of the inferred kind, narrowed to the literals union.
   */
  enum: ((...values: Array<string | number | bigint>) => {
    if (values.length === 0) throw new LmdbError(`t.enum() requires at least one value, e.g. t.enum('active', 'archived').`)
    const first = typeof values[0]
    if (first !== `string` && first !== `number` && first !== `bigint`) throw new LmdbError(`t.enum() supports string, number and bigint values only — received '${first}'.`)
    for (const v of values) {
      if (typeof v !== first) throw new LmdbError(`t.enum() requires homogen values of one kind — received mixed '${first}' and '${typeof v}'.`)
    }
    return LmdbSchema.makeBuilder(first as IColumnKind, false, undefined, false, undefined, values)
  }) as {
    (): never
    <T extends string>(...values: T[]): IColumnBuilder<`string`, `none`, undefined, T>
    <T extends number>(...values: T[]): IColumnBuilder<`number`, `none`, undefined, T>
    <T extends bigint>(...values: T[]): IColumnBuilder<`bigint`, `none`, undefined, T>
  },
  /**
   * A `boolean` column builder.
   *
   * @returns A `boolean` column builder.
   */
  boolean: (): IColumnBuilder<`boolean`> => LmdbSchema.makeBuilder(`boolean`),
  /**
   * An `object` column builder.
   *
   * @typeParam T - Value type of the object field (default `Record<string, unknown>`).
   * @returns A `Record<string, unknown>` column builder, or a builder of the
   * given `T` when supplied via `t.object<T>()`.
   */
  object: <T = Record<string, unknown>, S extends Record<string, IAnyColumnBuilder> | undefined = undefined>(shape?: S): IColumnBuilder<`object`, `none`, undefined, [S] extends [undefined] ? T : IShapeValueOf<S>> =>
    LmdbSchema.makeBuilder(`object`, false, undefined, false, shape) as IColumnBuilder<`object`, `none`, undefined, [S] extends [undefined] ? T : IShapeValueOf<S>>,
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
  array: <T = unknown, S extends IAnyShapeParam | undefined = undefined>(shape?: S): IColumnBuilder<`array`, `none`, undefined, [S] extends [undefined] ? T : IShapeElementOf<S>> =>
    LmdbSchema.makeBuilder(`array`, false, undefined, false, shape) as IColumnBuilder<`array`, `none`, undefined, [S] extends [undefined] ? T : IShapeElementOf<S>>,
  /**
   * A `Date` column builder (msgpack-native).
   *
   * @returns A `Date` column builder.
   */
  date: (): IColumnBuilder<`date`> => LmdbSchema.makeBuilder(`date`),
  /**
   * A `Uint8Array` column builder.
   *
   * @returns A `Uint8Array` column builder.
   */
  buffer: (): IColumnBuilder<`buffer`> => LmdbSchema.makeBuilder(`buffer`),
  /**
   * An `any` column builder (type `unknown`).
   *
   * @returns An `unknown`-typed column builder.
   */
  any: (): IColumnBuilder<`any`> => LmdbSchema.makeBuilder(`any`),
  /**
   * A `Map` column builder.
   *
   * @typeParam K - Key type (default `unknown`).
   * @typeParam V - Value type (default `unknown`).
   * @returns A `Map` column builder, typed from `K`/`V` or the shape.
   */
  map: <K = unknown, V = unknown, S extends {key: IAnyColumnBuilder; value: IAnyColumnBuilder} | undefined = undefined>(shape?: S): IColumnBuilder<`map`, `none`, undefined, [S] extends [undefined] ? Map<K, V> : IShapeMapOf<S>> =>
    LmdbSchema.makeBuilder(`map`, false, undefined, false, shape) as IColumnBuilder<`map`, `none`, undefined, [S] extends [undefined] ? Map<K, V> : IShapeMapOf<S>>,
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
  set: <T = unknown, S extends IAnyShapeParam | undefined = undefined>(shape?: S): IColumnBuilder<`set`, `none`, undefined, [S] extends [undefined] ? Set<T> : Set<IShapeElementOf<S>>> =>
    LmdbSchema.makeBuilder(`set`, false, undefined, false, shape) as IColumnBuilder<`set`, `none`, undefined, [S] extends [undefined] ? Set<T> : Set<IShapeElementOf<S>>>
}

/**
 * Declarative schema base class — extend it to describe a collection.
 *
 * @remarks
 * Subclass with `static db` (used as the collection's `dbName`),
 * `static key` (a single {@link IColumnBuilder} from the {@link t} builders
 * for the primary key), and `static value` (a map of value columns, each a
 * {@link IColumnBuilder}). The `key` column must NOT carry `unique`/`index` —
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
 *     tags: t.array().optional(),
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
  /**
   * Sub-database name — used as the registered collection's `dbName`.
   *
   * @remarks
   * Required on every schema subclass; must be unique per env.
   */
  static db: string
  /**
   * Key column builder — the collection's primary key.
   *
   * @remarks
   * Must be a single {@link IColumnBuilder} (from the {@link t} builders).
   * Must NOT carry `unique`/`index` — the key is implicitly the primary
   * index and is excluded from the derived `indexes`.
   */
  static key: IAnyColumnBuilder
  /**
   * Value column definition — either a single {@link IColumnBuilder} (scalar
   * value collections: `static value = t.number()`, `t.buffer()`,
   * `t.array<T>()`, `t.object<T>()`) or a map of {@link IColumnBuilder}s
   * (row-shaped collections). Scalar values carry no derived indexes.
   *
   * @remarks
   * Each map column maps to a field of the row value type via
   * {@link IInferSchemaValue}; columns carrying `.unique()`/`.index(...)`
   * become derived indexes (see {@link LmdbSchema.deriveIndexes}).
   */
  static value: IAnyColumnBuilder | Record<string, IAnyColumnBuilder>
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
   * Enable optimistic locking via LMDB record versions on this collection —
   * `env.rootPut(id, value, version, ifVersion)` and `env.rootGetEntry(id)`
   * require it. Defaults to the env's `useVersions` when omitted.
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
   * Optional shape version for migration transforms.
   *
   * @remarks
   * Declares the row-shape version this schema class models. Transform
   * steps name the version they produce (`schemaVersion`); the runner
   * refuses skewed steps whose target disagrees with this declaration.
   * Unversioned schemas skip the check.
   */
  static version?: number
  /**
   * Runtime discriminator for {@link LmdbEnv.register} — inherited by
   * subclasses, never read by user code.
   */
  static readonly _schemaBrand = true as const

  /**
   * Build the ordered tuple for a composite index from a row.
   *
   * @remarks
   * Walks each component (dotted paths supported via
   * {@link RecordCodec.getPath}); a `null`/`undefined` component — or a
   * non-object row — skips the entry, mirroring how null extracts skip
   * embedded indexes.
   *
   * @param value - The row value to extract from.
   * @param components - Ordered component column names (dotted paths allowed).
   * @returns The ordered tuple, or `null` when a component is absent.
   *
   * @internal
   */
  static compositeTuple(value: unknown, components: Array<string>): Array<ILmdbKey> | null {
    if (value === null || typeof value !== `object`) return null
    const row = value as Record<string, unknown>
    const tuple: Array<ILmdbKey> = []
    for (const component of components) {
      const part = RecordCodec.getPath(row, component)
      if (part === undefined || part === null) return null
      tuple.push(part as ILmdbKey)
    }
    return tuple
  }

  /**
   * Runtime check: is a value a single {@link IColumnBuilder} (scalar) rather
   * than a value-column map?
   *
   * @param value - The `static value` to inspect.
   * @returns `true` for a single builder, `false` for a column map.
   *
   * @public
   */
  static isColumnBuilder(value: unknown): value is IAnyColumnBuilder {
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
   * @param builder - The builder (or nested shape member) to inspect.
   * @param db - Owning sub-DB name, used in thrown messages.
   *
   * @internal
   */
  private static _assertNoNestedIndex(builder: IAnyColumnBuilder, db: string): void {
    const shape = builder.shape
    if (!shape) return
    const entries: Array<[string, IAnyColumnBuilder]> = LmdbSchema.isColumnBuilder(shape)
      ? [[`*`, shape]]
      : Array.isArray(shape)
        ? shape.map((nested, i): [string, IAnyColumnBuilder] => [String(i), nested])
        : Object.entries(shape).filter((e): e is [string, IAnyColumnBuilder] => LmdbSchema.isColumnBuilder(e[1]))
    for (const [name, nested] of entries) {
      // Composite first: every composite marker also sets an indexName, so the
      // unique/index branch below would swallow it with the wrong message.
      if (nested.compositeColumns !== undefined) {
        throw new LmdbError(`Schema '${db}': nested composite index on '${name}' inside a t.object/t.array shape is not supported — the marker would be silently ignored. Declare it as a top-level column instead.`)
      }
      if (nested.isUnique || nested.indexName !== undefined) {
        throw new LmdbError(`Schema '${db}': nested unique/index on '${name}' inside a t.object/t.array shape is not supported — the index would be silently ignored. Declare it as a top-level dotted column instead, e.g. "bio.email": t.string().unique().`)
      }
      if (nested.isSearchable === true) {
        throw new LmdbError(`Schema '${db}': nested .search() on '${name}' inside a t.object/t.array shape is not supported — the marker would be silently ignored. Declare it as a top-level string column instead.`)
      }
      LmdbSchema._assertNoNestedIndex(nested, db)
    }
  }

  /**
   * Validate a `.default(value)` candidate against its column kind + enum.
   *
   * @remarks
   * Extracted from `LmdbSchema.makeBuilder` so future column markers (search,
   * composite) share the same declaration-time gate without duplicating the
   * checks.
   *
   * @throws {@link LmdbError} when the value mismatches the scalar kind or enum.
   *
   * @param kind - The column kind to check against.
   * @param value - The `.default()` candidate.
   * @param enumValues - Allowed enum values, if the column is an enum.
   *
   * @internal
   */
  private static _validateDefaultValue(kind: IColumnKind, value: unknown, enumValues: readonly unknown[] | undefined): void {
    if ((kind === `string` || kind === `number` || kind === `bigint` || kind === `boolean`) && typeof value !== kind) {
      throw new LmdbError(`.default() value for a '${kind}' column must be a ${kind} — received '${typeof value}'.`)
    }
    if (enumValues !== undefined && !enumValues.includes(value as unknown)) {
      throw new LmdbError(`.default() value '${String(value)}' is outside the column enum — allowed: ${enumValues.map((v) => String(v)).join(`, `)}.`)
    }
  }

  /**
   * Build a new {@link IColumnBuilder} with the given metadata.
   *
   * @remarks
   * Immutability comes from always constructing a fresh object; the modifier
   * methods delegate here with the updated flag. The `I`/`N` generics re-tag
   * the returned builder with the literal index marker + explicit index name;
   * the inner casts are safe because the runtime flags (`isUnique`,
   * `indexName`) stay plain `boolean`/`string`.
   *
   * @param kind - Column value kind.
   * @param isUnique - Whether `.unique()` was applied.
   * @param indexName - Explicit index name or composite `a+b` name, if any.
   * @param isOptional - Whether `.optional()` was applied.
   * @param shape - Runtime shape for param-based builders, if any.
   * @param enumValues - Allowed enum values, if the column is an enum.
   * @param defaults - Static or factory default declaration, if any.
   * @param isSearchable - Whether `.search()` was applied.
   * @param compositeColumns - Composite member list for `.index([...])`, if any.
   * @returns A new immutable {@link IColumnBuilder} carrying the metadata.
   *
   * @internal
   */
  static makeBuilder<K extends IColumnKind, I extends IColumnIndexFlag = `none`, N extends string | undefined = undefined, V = unknown, Nl extends boolean = false>(
    kind: K,
    isUnique = false,
    indexName: string | undefined = undefined,
    isOptional: Nl = false as Nl,
    shape?: IAnyShapeParam,
    enumValues?: readonly unknown[],
    defaults?: {value?: unknown; has: boolean; fn?: () => unknown},
    isSearchable = false,
    compositeColumns?: Array<string>
  ): IColumnBuilder<K, I, N, V, Nl> {
    return {
      kind,
      isUnique,
      indexName: indexName as N,
      indexFlag: (isUnique ? `unique` : indexName !== undefined ? `index` : `none`) as I,
      isOptional,
      isSearchable,
      ...(compositeColumns !== undefined ? {compositeColumns} : {}),
      shape,
      ...(enumValues !== undefined ? {enumValues} : {}),
      ...(defaults?.has ? {defaultValue: defaults.value, hasDefault: true as const, defaultFn: defaults.fn} : {}),
      unique: (): IColumnBuilder<K, `unique`, N, V, Nl> => LmdbSchema.makeBuilder(kind, true, indexName, isOptional, shape, enumValues, defaults, isSearchable, undefined) as IColumnBuilder<K, `unique`, N, V, Nl>,
      index: <N2 extends string | undefined = undefined, const Cc extends readonly [string, ...string[]] | undefined = undefined>(
        name?: N2 | Cc
      ): [Cc] extends [undefined] ? IColumnBuilder<K, I extends `unique` ? `unique` : `index`, N2 extends string ? (N2 extends `` ? undefined : N2) : undefined, V, Nl, unknown> : IColumnBuilder<K, `index`, IJoinPlus<NonNullable<Cc>>, V, Nl, NonNullable<Cc>> => {
        if (Array.isArray(name)) {
          const columns = name.filter((c): c is string => typeof c === `string`)
          return LmdbSchema.makeBuilder(kind, false, columns.join(`+`), isOptional, shape, enumValues, defaults, isSearchable, columns) as [Cc] extends [undefined]
            ? IColumnBuilder<K, I extends `unique` ? `unique` : `index`, N2 extends string ? (N2 extends `` ? undefined : N2) : undefined, V, Nl, unknown>
            : IColumnBuilder<K, `index`, IJoinPlus<NonNullable<Cc>>, V, Nl, NonNullable<Cc>>
        }
        return LmdbSchema.makeBuilder(kind, isUnique, typeof name === `string` ? name : ``, isOptional, shape, enumValues, defaults, isSearchable, undefined) as [Cc] extends [undefined]
          ? IColumnBuilder<K, I extends `unique` ? `unique` : `index`, N2 extends string ? (N2 extends `` ? undefined : N2) : undefined, V, Nl, unknown>
          : IColumnBuilder<K, `index`, IJoinPlus<NonNullable<Cc>>, V, Nl, NonNullable<Cc>>
      },
      search: (): IColumnBuilder<K, I, N, V, Nl> => LmdbSchema.makeBuilder(kind, isUnique, indexName, isOptional, shape, enumValues, defaults, true, compositeColumns) as IColumnBuilder<K, I, N, V, Nl>,
      optional: (): IColumnBuilder<K, I, N, V, true> => LmdbSchema.makeBuilder(kind, isUnique, indexName, true as true, shape, enumValues, defaults, isSearchable, compositeColumns) as IColumnBuilder<K, I, N, V, true>,
      default: (value: unknown): IColumnBuilder<K, I, N, V, true> => {
        LmdbSchema._validateDefaultValue(kind, value, enumValues)
        return LmdbSchema.makeBuilder(kind, isUnique, indexName, true as true, shape, enumValues, {value, has: true}, isSearchable, compositeColumns) as IColumnBuilder<K, I, N, V, true>
      },
      $defaultFn: (fn: () => unknown): IColumnBuilder<K, I, N, V, true> => LmdbSchema.makeBuilder(kind, isUnique, indexName, true as true, shape, enumValues, {value: undefined, has: true, fn}, isSearchable, compositeColumns) as IColumnBuilder<K, I, N, V, true>
    } as IColumnBuilder<K, I, N, V, Nl>
  }

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
   * @throws {@link LmdbError} On any of the rules above.
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
    if (schemaClass.version !== undefined && (typeof schemaClass.version !== `number` || !Number.isInteger(schemaClass.version))) {
      throw new LmdbError(`Schema '${db}' (class '${className}'): static version must be an integer.`)
    }
    const key = schemaClass.key
    if (key === undefined) {
      throw new LmdbError(`Schema '${db}' (class '${className}'): missing required static 'key'. Declare it, e.g. static key = t.number().`)
    }
    if (key.isUnique || key.indexName !== undefined || key.compositeColumns !== undefined) {
      throw new LmdbError(`Schema '${db}': the 'key' column must not be unique or indexed — the key is the primary key and is not part of the derived indexes.`)
    }
    const value = schemaClass.value
    const isScalar = LmdbSchema.isColumnBuilder(value)
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
      LmdbSchema._assertNoNestedIndex(value, db)
      if (value.isSearchable === true) {
        throw new LmdbError(`Schema '${db}': .search() requires a row-shaped static value — scalar values carry no searchable columns. Declare static value as a map, e.g. static value = {bio: t.string().search()}.`)
      }
      if (value.compositeColumns !== undefined) {
        throw new LmdbError(`Schema '${db}': composite index [${value.compositeColumns.join(`+`)}] requires a row-shaped static value — scalar values (including dupSort subs) carry no columns to compose.`)
      }
      return
    }
    const seen = new Set<string>()
    const columns = value as Record<string, IAnyColumnBuilder>
    for (const [columnName, column] of Object.entries(value)) {
      LmdbSchema._assertNoNestedIndex(column, db)
      if (column.isSearchable === true && column.kind !== `string`) {
        throw new LmdbError(`Schema '${db}': .search() is only supported on string columns — column '${columnName}' is '${column.kind}'.`)
      }
      if (column.compositeColumns !== undefined) {
        const components = column.compositeColumns
        if (components.length < 2) {
          throw new LmdbError(`Schema '${db}': composite index on '${columnName}' requires at least 2 columns — received [${components.join(`,`)}].`)
        }
        for (const component of components) {
          if (!(component in columns)) {
            throw new LmdbError(`Schema '${db}': composite index [${components.join(`+`)}] lists unknown column '${component}'.`)
          }
        }
      }
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
  static deriveIndexes(columns: IAnyColumnBuilder | Record<string, IAnyColumnBuilder>): Array<{name: string; def: IIndexDef<unknown, ILmdbKey>; dbName?: string}> {
    const indexes: Array<{name: string; def: IIndexDef<unknown, ILmdbKey>; dbName?: string}> = []
    if (LmdbSchema.isColumnBuilder(columns)) return indexes // scalar values carry no derived indexes
    for (const [columnName, column] of Object.entries(columns)) {
      // Composite markers resolve independently of the legacy `key` skip —
      // dropping a component would corrupt the positional layout.
      if (column.compositeColumns !== undefined) {
        const components = [...column.compositeColumns]
        indexes.push({
          name: column.indexName || components.join(`+`),
          def: {unique: false, extractor: (value: unknown) => LmdbSchema.compositeTuple(value, components), composite: components},
          dbName: undefined
        })
        continue
      }
      if (columnName === `key`) continue
      if (column.isUnique || column.indexName !== undefined) {
        indexes.push({name: column.indexName || columnName, def: {unique: column.isUnique}, dbName: undefined})
      }
    }
    return indexes
  }

  /**
   * Derive searchable column names from a schema's columns.
   *
   * @remarks
   * Every top-level value column carrying `.search()` becomes one posting
   * table (`{db}:search:{column}`). Called by {@link LmdbEnv.register}
   * after {@link LmdbSchema.validate}; validation already guarantees
   * string-kind row-shaped columns, so this never throws.
   *
   * @param columns - The schema's `static value` map.
   * @returns Searchable column names in declaration order.
   *
   * @public
   */
  static deriveSearch(columns: IAnyColumnBuilder | Record<string, IAnyColumnBuilder>): Array<string> {
    if (LmdbSchema.isColumnBuilder(columns)) return [] // scalar values carry no searchable columns
    const names: Array<string> = []
    for (const [columnName, column] of Object.entries(columns)) {
      if (columnName === `key`) continue
      if (column.isSearchable === true) names.push(columnName)
    }
    return names
  }

  /**
   * Derive positional record columns from a schema's value map.
   *
   * @remarks
   * Every key in declaration order — unlike {@link LmdbSchema.deriveIndexes}
   * nothing is skipped, since dropping a column would corrupt the positional
   * layout. Scalar values carry no columns (no codec).
   *
   * @param columns - The schema's `static value` map.
   * @returns Column names in declaration order, or `[]` for scalars.
   *
   * @public
   */
  static deriveRecordColumns(columns: IAnyColumnBuilder | Record<string, IAnyColumnBuilder>): Array<string> {
    if (LmdbSchema.isColumnBuilder(columns)) return []
    return Object.keys(columns)
  }
}
