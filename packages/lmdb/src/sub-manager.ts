import {RecordCodec} from "./codec"
import type {LmdbEnv} from "./env"
import {LmdbError} from "./errors"
import {LmdbSchema} from "./schema"
import {LmdbEnvSub} from "./sub"
import type {IIndexDef} from "./types/indexes"
import type {ILmdbKey} from "./types/key"
import type {LmdbSubState} from "./types/sub-state"
import type {IResolvedIndexDef, ISchemaConstructor, ISubStateOptions} from "./types/sub-manager"

/**
 * Registry + state factory for schema-registered sub-DBs.
 *
 * @remarks
 * Owns every {@link LmdbSubState} and the schema-class lookup maps, and
 * caches one {@link LmdbEnvSub} handle per schema (1 schema = 1 state =
 * 1 handle). Registration validates the schema, materializes the sub-DB
 * state, attaches embedded indexes, and returns the typed handle.
 *
 * @internal
 */
export class LmdbEnvSubManager {
  /**
   * Sub states keyed by sub-DB name.
   *
   * @internal
   */
  private readonly _subStates = new Map<string, LmdbSubState>()

  /**
   * Schema class to state lookup.
   *
   * @internal
   */
  private readonly _stateBySchema = new Map<ISchemaConstructor, LmdbSubState>()

  /**
   * Schema class to cached typed handle (1 schema = 1 handle).
   *
   * @internal
   */
  private readonly _subCache = new Map<ISchemaConstructor, LmdbEnvSub<typeof LmdbSchema>>()

  /**
   * Create a registry bound to an env.
   *
   * @param env - Owning env (provides transactions, map sizing, read-only flag).
   *
   * @internal
   */
  constructor(private readonly env: LmdbEnv) {}

  /**
   * Register a schema class as a sub-DB collection.
   *
   * @param schemaClass - The {@link LmdbSchema} subclass.
   * @returns A typed {@link LmdbEnvSub} handle — cached, so repeated calls
   * for the same schema return the same instance.
   * @throws {LmdbError} when the same class registers twice.
   * @throws {LmdbError} when another sub uses the same `db`.
   *
   * @internal
   */
  register<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S> {
    if (this._stateBySchema.has(schemaClass as unknown as ISchemaConstructor)) {
      throw new LmdbError(`LmdbSchema class '${schemaClass.name}' is already registered.`)
    }
    LmdbSchema.validate(schemaClass) // throws LmdbError on invalid schema
    if (this._subStates.has(schemaClass.db)) {
      throw new LmdbError(`A sub with dbName '${schemaClass.db}' is already registered. Use a different dbName.`)
    }
    const opts: ISubStateOptions = {}
    if (typeof schemaClass.hookBeforeWrite === `function`) {
      opts.codec = {
        hookBeforeWrite: schemaClass.hookBeforeWrite as (value: unknown) => unknown,
        hookBeforeRead: schemaClass.hookBeforeRead as (raw: unknown) => unknown
      }
    } else if (schemaClass.ttl === undefined) {
      // Record codec: positional array storage for row schemas, bridged
      // through the hook slot (zero read/write path changes). Skipped for
      // TTL subs — the expiry envelope would need duck-typing — and for
      // scalar values, which carry no columns to position.
      const recordColumns = LmdbSchema.deriveRecordColumns(schemaClass.value)
      if (recordColumns.length > 0) {
        opts.codec = new RecordCodec(recordColumns)
      }
    }
    if (schemaClass.ttl !== undefined) opts.ttlMs = schemaClass.ttl
    if (schemaClass.dupSort === true) opts.dupSort = true
    if (schemaClass.useVersions === true) opts.useVersions = true
    if (schemaClass.encoding !== undefined) opts.encoding = schemaClass.encoding
    const state = this._createSubState(schemaClass.db, opts)
    // Resolve each derived index's sub-DB name (schema indexes carry none).
    const defs = LmdbSchema.deriveIndexes(schemaClass.value).map((e) => ({
      name: e.name,
      def: e.def as IIndexDef<unknown, ILmdbKey>,
      dbName: e.dbName ?? `${schemaClass.db}:idx:${e.name}`
    }))
    // Collision guardrail: an index sub-DB name must not collide with any
    // already-registered sub (or another schema's index) — otherwise
    // attachIndexes would silently share a sub-DB handle between two owners.
    for (const {dbName: indexDbName} of defs) {
      if (this._subStates.has(indexDbName)) {
        throw new LmdbError(`A sub with dbName '${indexDbName}' is already registered. Use a different dbName.`)
      }
    }
    this._attachIndexesTo(state, defs)
    // Provision one posting table per searched column (schema search columns
    // carry none of the index derivation, so they resolve here).
    const searchColumns = LmdbSchema.deriveSearch(schemaClass.value)
    const searchDbNames = searchColumns.map((column) => `${schemaClass.db}:search:${column}`)
    // Same collision guardrail as embedded indexes — a posting table must
    // not share a sub-DB handle with another owner.
    for (const searchDbName of searchDbNames) {
      if (this._subStates.has(searchDbName)) {
        throw new LmdbError(`A sub with dbName '${searchDbName}' is already registered. Use a different dbName.`)
      }
    }
    for (let i = 0; i < searchColumns.length; i++) {
      const searchState = this._createSubState(searchDbNames[i]!, {dupSort: true, useVersions: false})
      state.searchTables.push({column: searchColumns[i]!, state: searchState})
    }
    this._stateBySchema.set(schemaClass as unknown as ISchemaConstructor, state)
    const sub = new LmdbEnvSub(this.env, schemaClass, state)
    this._subCache.set(schemaClass as unknown as ISchemaConstructor, sub as LmdbEnvSub<typeof LmdbSchema>)
    return sub
  }

  /**
   * Get the cached handle for an already-registered schema class.
   *
   * @param schemaClass - The {@link LmdbSchema} subclass.
   * @returns The cached {@link LmdbEnvSub} handle.
   * @throws {LmdbError} when the schema is not registered.
   *
   * @internal
   */
  sub<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S> {
    const cached = this._subCache.get(schemaClass as unknown as ISchemaConstructor)
    if (!cached) throw new LmdbError(`LmdbSchema class '${schemaClass.name}' is not registered. Call env.register(SchemaClass) first.`)
    return cached as LmdbEnvSub<S>
  }

  /**
   * Whether a schema class has been registered.
   *
   * @param schemaClass - The {@link LmdbSchema} subclass.
   * @returns `true` when registered, `false` otherwise.
   *
   * @internal
   */
  isRegistered(schemaClass: typeof LmdbSchema): boolean {
    return this._stateBySchema.has(schemaClass as unknown as ISchemaConstructor)
  }

  /**
   * Attach embedded-index descriptors to an already-registered sub.
   *
   * @remarks
   * Used by tests that need custom extractors schemas cannot express. The
   * sub-DB must already be registered.
   *
   * @param dbName - Target sub-DB name.
   * @param defs - Index descriptors with resolved sub-DB names.
   *
   * @internal
   */
  attachIndexes(dbName: string, defs: Array<IResolvedIndexDef>): void {
    const state = this._subStates.get(dbName)
    if (!state) throw new LmdbError(`No sub registered for '${dbName}'`)
    this._attachIndexesTo(state, defs)
  }

  /**
   * Get or create the sub-DB state for a name.
   *
   * @remarks
   * Idempotent: an existing state is reused. Refuses to open a new sub-DB
   * when the map is nearly full (free ratio below 10%) to fail early
   * instead of hitting `MDB_MAP_FULL`, and warns once when sub-DB slots
   * run low.
   *
   * @param dbName - Sub-DB name.
   * @param opts - Construction options (dupSort, versions, encodings, codec, TTL).
   * @returns The sub-DB state, cached by name.
   *
   * @internal
   */
  private _createSubState(dbName: string, opts?: ISubStateOptions): LmdbSubState {
    const existing = this._subStates.get(dbName)
    if (existing) return existing
    // B2 guardrail — refuse to open a new sub-DB when the map is nearly full
    // (free ratio below 10%) to fail early instead of hitting MDB_MAP_FULL.
    const usage = this.env.getMapSizeUsed()
    if (usage.ratio < 0.1) {
      throw new LmdbError(`MDB_MAP_FULL risk — free ratio ${usage.ratio.toFixed(3)} is below 10%. Increase mapSize or prune data.`)
    }
    const dupSort = opts?.dupSort
    const encoding = opts?.encoding
    const useVersions = opts?.useVersions
    const keyEncoding = opts?.keyEncoding
    const dbOverrides: Record<string, unknown> =
      dupSort !== undefined || encoding !== undefined || useVersions !== undefined || keyEncoding !== undefined
        ? {
            ...(dupSort !== undefined ? {dupSort} : {}),
            ...(encoding !== undefined ? {encoding} : {}),
            ...(useVersions !== undefined ? {useVersions} : {}),
            ...(keyEncoding !== undefined ? {keyEncoding} : {})
          }
        : {}
    const subDb = Object.keys(dbOverrides).length ? this.env.getDb(dbName, dbOverrides as never) : this.env.getDb(dbName)
    const combined = Object.create(subDb) as LmdbSubState[`env`]
    combined.transaction = this.env.transaction.bind(this.env) as LmdbSubState[`env`][`transaction`]
    combined.readTransaction = this.env.readTransaction.bind(this.env) as LmdbSubState[`env`][`readTransaction`]
    Object.defineProperty(combined, `readOnly`, {value: this.env.readOnly})
    const state: LmdbSubState = {
      dbName,
      env: combined,
      ...(opts?.codec !== undefined ? {codec: opts.codec} : {}),
      hookBeforeRead: opts?.codec ? (raw: unknown) => opts.codec!.hookBeforeRead(raw) : (raw: unknown) => raw,
      indexes: [],
      indexByName: new Map(),
      searchTables: [],
      opts: {
        dupSort: opts?.dupSort ?? false,
        useVersions: opts?.useVersions ?? false,
        ...(opts?.encoding !== undefined ? {encoding: opts.encoding} : {}),
        ...(opts?.codec !== undefined ? {codec: opts.codec} : {})
      },
      isTtl: opts?.ttlMs !== undefined,
      ...(opts?.ttlMs !== undefined ? {ttlMs: opts.ttlMs} : {})
    }
    this._subStates.set(dbName, state)
    this._warnMaxDbs()
    return state
  }

  /**
   * Whether the maxDbs pressure warning already fired (warn once).
   *
   * @internal
   */
  private _maxDbsWarned = false

  /**
   * Warn once when sub-DB slots run low.
   *
   * @remarks
   * Production-scale configs only (tests use tiny `maxDbs`): warns when
   * fewer than 32 slots remain. Every schema, index, queue, and TTL helper
   * consumes slots, and breaching `maxDbs` throws mid-registration.
   *
   * @internal
   */
  private _warnMaxDbs(): void {
    // Production-scale configs only (tests use tiny maxDbs): warn once when
    // fewer than 32 sub-DB slots remain. Every schema, index, queue, and TTL
    // helper consumes slots, and breaching maxDbs throws mid-registration.
    if (this._maxDbsWarned) return
    const max = this.env.maxDbs
    if (max < 32) return
    const remaining = max - this._subStates.size
    if (remaining <= 32) {
      this._maxDbsWarned = true
      console.warn(`[@gramstax/lmdb] ${this._subStates.size}/${max} sub-DBs used — raise maxDbs before deploy (each schema + each .unique()/.index() consumes slots).`)
    }
  }

  /**
   * Attach derived index tables to a sub state.
   *
   * @remarks
   * Composite tables pin ordered-binary key/value encoding so tuple keys
   * seek natively regardless of the env's `keyEncoding`.
   *
   * @param state - Target sub-DB state.
   * @param defs - Index descriptors with resolved sub-DB names.
   *
   * @internal
   */
  private _attachIndexesTo(state: LmdbSubState, defs: Array<IResolvedIndexDef>): void {
    for (const {name, def, dbName} of defs) {
      // Composite tables pin ordered-binary key/value encoding so tuple keys
      // seek natively regardless of the env's keyEncoding (new tables only —
      // single-column tables keep their inherited encodings for stability).
      const indexState = def.composite !== undefined ? this._createSubState(dbName, {dupSort: !def.unique, useVersions: false, encoding: `ordered-binary`, keyEncoding: `ordered-binary`}) : this._createSubState(dbName, {dupSort: !def.unique, useVersions: false})
      let extractor: (value: unknown) => ILmdbKey | undefined | null
      let autoResolved = false
      if (def.extractor) {
        extractor = def.extractor
      } else {
        autoResolved = true
        const parts = name.split(`.`)
        extractor = (value: unknown): ILmdbKey | undefined | null => {
          let current: unknown = value
          for (const part of parts) {
            if (current === null || typeof current !== `object`) {
              throw new LmdbError(`Index '${name}': auto-resolved field path '${name}' does not exist on a non-object value of type '${typeof value}'`)
            }
            if (!(part in (current as Record<string, unknown>))) {
              throw new LmdbError(`Index '${name}': auto-resolved field '${name}' not found on value (type '${typeof value}')`)
            }
            current = (current as Record<string, unknown>)[part]
          }
          if (current === undefined || current === null) return null
          return current as ILmdbKey
        }
      }
      state.indexes.push({name, extractor, unique: def.unique ?? false, state: indexState, autoResolved, composite: def.composite})
      state.indexByName.set(name, state.indexes[state.indexes.length - 1]!)
    }
  }
}
