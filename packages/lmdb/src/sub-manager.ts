
import {LmdbError, LmdbDuplicateDbNameError, LmdbMapFullError, LmdbSchemaAlreadyRegisteredError, LmdbSchemaNotRegisteredError} from "./errors"
import {LmdbSchema, } from "./schema"
import {LmdbEnvSub} from "./sub"
import type {ICodec, IIndexDef, ILmdbKey, LmdbSubState} from "./types"
import type {LmdbEnv} from "./env"

type LmdbSchemaConstructor = typeof LmdbSchema

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
  /** @internal Sub states keyed by sub-DB name. */
  private readonly _subStates = new Map<string, LmdbSubState>()

  /** @internal Schema class -> state lookup alias. */
  private readonly _stateBySchema = new Map<LmdbSchemaConstructor, LmdbSubState>()

  /** @internal Schema class -> cached typed handle (1 schema = 1 handle). */
  private readonly _subCache = new Map<LmdbSchemaConstructor, LmdbEnvSub<typeof LmdbSchema>>()

  constructor(private readonly env: LmdbEnv) {}

  /**
   * Register a schema class as a sub-DB collection.
   *
   * @param schemaClass - The {@link LmdbSchema} subclass.
   * @returns A typed {@link LmdbEnvSub} handle — cached, so repeated calls
   * for the same schema return the same instance.
   * @throws {LmdbSchemaAlreadyRegisteredError} when the same class registers twice.
   * @throws {LmdbDuplicateDbNameError} when another sub uses the same `db`.
   */
  register<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S> {
    if (this._stateBySchema.has(schemaClass as unknown as LmdbSchemaConstructor)) {
      throw new LmdbSchemaAlreadyRegisteredError(schemaClass.name)
    }
    LmdbSchema.validate(schemaClass) // throws LmdbError on invalid schema
    if (this._subStates.has(schemaClass.db)) {
      throw new LmdbDuplicateDbNameError(schemaClass.db)
    }
    const opts: {codec?: ICodec<unknown>; ttlMs?: number; dupSort?: boolean; useVersions?: boolean; encoding?: string} = {}
    if (typeof schemaClass.hookBeforeWrite === `function`) {
      opts.codec = {
        hookBeforeWrite: schemaClass.hookBeforeWrite as (value: unknown) => unknown,
        hookBeforeRead: schemaClass.hookBeforeRead as (raw: unknown) => unknown
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
        throw new LmdbDuplicateDbNameError(indexDbName)
      }
    }
    this._attachIndexesTo(state, defs)
    this._stateBySchema.set(schemaClass as unknown as LmdbSchemaConstructor, state)
    const sub = new LmdbEnvSub(this.env, schemaClass, state)
    this._subCache.set(schemaClass as unknown as LmdbSchemaConstructor, sub as LmdbEnvSub<typeof LmdbSchema>)
    return sub
  }

  /**
   * Get the cached handle for an already-registered schema class.
   *
   * @param schemaClass - The {@link LmdbSchema} subclass.
   * @returns The cached {@link LmdbEnvSub} handle.
   * @throws {LmdbSchemaNotRegisteredError} when the schema is not registered.
   */
  sub<S extends typeof LmdbSchema>(schemaClass: S): LmdbEnvSub<S> {
    const cached = this._subCache.get(schemaClass as unknown as LmdbSchemaConstructor)
    if (!cached) throw new LmdbSchemaNotRegisteredError(schemaClass.name)
    return cached as LmdbEnvSub<S>
  }

  /** Whether a schema class has been registered. */
  isRegistered(schemaClass: typeof LmdbSchema): boolean {
    return this._stateBySchema.has(schemaClass as unknown as LmdbSchemaConstructor)
  }

  /** Attach embedded-index descriptors to an already-registered sub (tests with custom extractors). */
  attachIndexes(dbName: string, defs: Array<{name: string; def: IIndexDef<unknown, ILmdbKey>; dbName: string}>): void {
    const state = this._subStates.get(dbName)
    if (!state) throw new LmdbError(`No sub registered for '${dbName}'`)
    this._attachIndexesTo(state, defs)
  }

  private _createSubState(dbName: string, opts?: {dupSort?: boolean; useVersions?: boolean; encoding?: string; codec?: ICodec<unknown>; ttlMs?: number}): LmdbSubState {
    const existing = this._subStates.get(dbName)
    if (existing) return existing
    // B2 guardrail — refuse to open a new sub-DB when the map is nearly full
    // (free ratio below 10%) to fail early instead of hitting MDB_MAP_FULL.
    const usage = this.env.getMapSizeUsed()
    if (usage.ratio < 0.1) {
      throw new LmdbMapFullError(usage.ratio)
    }
    const dupSort = opts?.dupSort
    const encoding = opts?.encoding
    const useVersions = opts?.useVersions
    const dbOverrides: Record<string, unknown> =
      dupSort !== undefined || encoding !== undefined || useVersions !== undefined
        ? {
            ...(dupSort !== undefined ? {dupSort} : {}),
            ...(encoding !== undefined ? {encoding} : {}),
            ...(useVersions !== undefined ? {useVersions} : {})
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

  private _maxDbsWarned = false

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

  private _attachIndexesTo(state: LmdbSubState, defs: Array<{name: string; def: IIndexDef<unknown, ILmdbKey>; dbName: string}>): void {
    for (const {name, def, dbName} of defs) {
      const indexState = this._createSubState(dbName, {dupSort: !def.unique, useVersions: false})
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
      state.indexes.push({name, extractor, unique: def.unique ?? false, state: indexState, autoResolved})
      state.indexByName.set(name, state.indexes[state.indexes.length - 1]!)
    }
  }
}
