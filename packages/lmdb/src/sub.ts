import {asBinary, compareKeys, type GetOptions, type PutOptions, type RangeOptions} from "lmdb"
import {Cdc} from "./cdc"
import type {LmdbEnv} from "./env"
import {LmdbError} from "./errors"
import {type ISchemaIndexesOf, type KeyOf, LmdbSchema, type ValueOf} from "./schema"
import {LmdbSearch} from "./search"
import type {ISyncOptions, ISyncResult} from "./sync"
import {LmdbSyncStream} from "./sync"
import {LmdbTransaction} from "./transaction"
import type {IIndexQuery, IIndexResult, IndexDescriptor} from "./types/indexes"
import type {ILmdbKey} from "./types/key"
import type {IRangeOptions} from "./types/range"
import type {ISearchTable} from "./types/search"
import type {ICompositeRangeQuery, IParsedCompositeQuery} from "./types/sub"
import type {LmdbSubState} from "./types/sub-state"

/**
 * Maximum wildcards allowed in a `like()` pattern.
 *
 * @remarks
 * Beyond this the compiled regex risks ReDoS (catastrophic backtracking).
 */
const MAX_LIKE_WILDCARDS = 10

/**
 * Hard cap on how many entries a materializing range query may return.
 *
 * @remarks
 * `keys()`/`values()`/`entries()`/`like()`/`findByPrefix()`/
 * `deleteByPrefix()` reject with `LmdbError` past this cap — use `iterate()`
 * (lazy, never guarded) for larger result sets.
 *
 * @public
 */
export const MAX_MATERIALIZE = 100_000

/**
 * Pure key-comparison helpers shared by index and range paths.
 */
class Helper {
  /**
   * Compare two keys by value (buffers and tuples element-wise).
   *
   * @param a - Left key (absent compares only equal to absent).
   * @param b - Right key.
   * @returns Whether the values are equal.
   */
  static sameIndexValue(a: ILmdbKey | undefined | null, b: ILmdbKey): boolean {
    if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) return a.equals(b)
    // Composite tuple keys compare element-wise (reference equality would
    // never match freshly extracted tuples against query tuples).
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (!Helper.sameIndexValue(a[i], b[i]!)) return false
      }
      return true
    }
    return a === b
  }

  /**
   * Whether a tuple key starts with a prefix tuple (element-wise).
   *
   * @param key - Candidate tuple key.
   * @param prefix - Prefix tuple.
   * @returns Whether `key` starts with `prefix`.
   */
  static tuplePrefixMatch(key: ILmdbKey, prefix: Array<ILmdbKey>): boolean {
    if (!Array.isArray(key) || key.length < prefix.length) return false
    for (let i = 0; i < prefix.length; i++) {
      if (!Helper.sameIndexValue(key[i], prefix[i]!)) return false
    }
    return true
  }

  /**
   * Glob-match a string key against a `*`/`?` pattern (linear time).
   *
   * @param key - The key to test.
   * @param pattern - Glob pattern.
   * @returns Whether the key matches.
   */
  static globMatch(key: string, pattern: string): boolean {
    let k = 0
    let p = 0
    let star = -1
    let mark = 0
    while (k < key.length) {
      if (p < pattern.length && (pattern[p] === `?` || pattern[p] === key[k])) {
        k++
        p++
      } else if (p < pattern.length && pattern[p] === `*`) {
        star = p
        mark = k
        p++
      } else if (star !== -1) {
        p = star + 1
        k = ++mark
      } else {
        return false
      }
    }
    while (p < pattern.length && pattern[p] === `*`) p++
    return p === pattern.length
  }
}

/**
 * Typed sub-collection handle — returned by {@link LmdbEnv.register} and
 * bound to a schema class.
 *
 * @remarks
 * The handle is self-contained: it holds its own {@link LmdbSubState}
 * (sub-DB handle + codec + embedded-index descriptors) so every operation
 * runs directly on the sub-DB without a per-call schema lookup on the env.
 * One schema class = one state = one handle (the env caches handles), so
 * `env.register(UserSchema) === env.sub(UserSchema)`.
 *
 * Cross-collection work goes through {@link LmdbEnvSub.owner} — the owning
 * env — for transactions (`sub.owner.transaction(...)`) and access to other
 * registered subs (`sub.owner.sub(OtherSchema)`).
 *
 * @typeParam S - Schema class describing this sub-DB (its `static db` is the
 * sub-DB name, its value shape is the row type, its key shape the key type).
 *
 * @public
 */
export class LmdbEnvSub<S extends typeof LmdbSchema> {
  /**
   * Whether this sub needs write-path guards (enum validation, defaults).
   */
  private readonly _needsGuards: boolean

  /**
   * Create a handle bound to a pre-built sub-DB state.
   *
   * @param _owner - The env that registered this sub.
   * @param _schema - The registered schema class.
   * @param _state - Pre-built sub-DB state (owned by the env's sub manager).
   */
  constructor(
    private readonly _owner: LmdbEnv,
    private readonly _schema: S,
    private readonly _state: LmdbSubState
  ) {
    this._needsGuards = LmdbEnvSub._schemaNeedsGuards(_schema)
  }

  /**
   * Whether a schema needs write-path guards.
   *
   * @param schema - The schema class to inspect.
   * @returns Whether any key/value column carries enum values or defaults.
   */
  private static _schemaNeedsGuards(schema: typeof LmdbSchema): boolean {
    if (schema.key?.enumValues !== undefined) return true
    const columns = schema.value
    if (LmdbSchema.isColumnBuilder(columns)) return columns.enumValues !== undefined || !!columns.hasDefault
    if (typeof columns !== `object` || columns === null) return false
    return Object.values(columns).some((column) => column.enumValues !== undefined || !!column.hasDefault)
  }

  /**
   * The sub-DB name (the schema's `static db`).
   *
   * @returns The registered sub-DB name.
   */
  get dbName(): string {
    return this._schema.db
  }

  /**
   * The owning env — for transactions and cross-sub access.
   *
   * @returns The {@link LmdbEnv} this handle was created from.
   */
  get owner(): LmdbEnv {
    return this._owner
  }

  // ── Internal guards / helpers ──────────────────────────────────

  /**
   * Guard: require the env to be open before an operation.
   */
  private _assertOpen(): void {
    const state = this.owner.state
    if (state === `closed`) throw new LmdbError(`LmdbEnv has been closed and cannot be reused. Create a new instance.`)
    if (state !== `open`) throw new LmdbError(`LmdbEnv is not open. The env must be in 'open' state before performing operations.`)
  }

  /**
   * Run the open guard, converting a throw into a rejected promise.
   *
   * @returns `null` when open, otherwise the rejection for async paths.
   */
  private _rejectClosed(): Promise<never> | null {
    try {
      this._assertOpen()
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  /**
   * Validate a caller-passed transaction for a write operation.
   *
   * @param tx - Transaction passed by the caller, if any.
   * @returns `null` when absent or usable; otherwise the rejection (done
   * transaction, or no active write transaction on the env).
   */
  private _rejectBadTx(tx: LmdbTransaction | undefined): Promise<never> | null {
    if (!tx) return null
    if (tx.done) {
      return Promise.reject(new LmdbError(`Transaction has already been committed or aborted and cannot be reused.`))
    }
    let txnId: number
    try {
      txnId = this.owner.getWriteTxnId()
    } catch {
      txnId = 0
    }
    if (!txnId) {
      return Promise.reject(new LmdbError(`A transaction was passed to a write operation but no write transaction is active. Wrap the write in env.transaction() and pass the same tx.`))
    }
    return null
  }

  /**
   * Build native get options pinning a read transaction.
   *
   * @param tx - Read transaction to pin, if any.
   * @returns `{transaction}` for snapshot reads, otherwise `undefined`.
   */
  private _readOpts(tx?: LmdbTransaction): GetOptions | undefined {
    if (tx?.raw) {
      return {transaction: tx.raw}
    }
    return undefined
  }

  /**
   * Merge a read transaction into range options.
   *
   * @param options - Caller range options, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns The merged options, or the original options when no transaction.
   */
  private _rangeOpts(options: IRangeOptions | undefined, tx?: LmdbTransaction): RangeOptions | undefined {
    return tx?.raw ? {...options, transaction: tx.raw} : options
  }

  /**
   * Validate a key/value against the schema's enum columns.
   *
   * @remarks
   * No-op when the schema needs no guards. Checks the key builder, a scalar
   * value builder, or every enum-marked field of a row value.
   *
   * @param key - The key to validate.
   * @param value - The value to validate.
   * @throws {LmdbError} On an out-of-enum key or field.
   */
  private _assertEnum(key: ILmdbKey, value: unknown): void {
    if (!this._needsGuards) return
    const keyBuilder = this._schema.key
    if (keyBuilder?.enumValues !== undefined && !keyBuilder.enumValues.includes(key)) {
      throw new LmdbError(`Sub '${this.dbName}': invalid value '${String(key)}' for enum column 'key' — allowed: ${keyBuilder.enumValues.map((v) => String(v)).join(`, `)}.`)
    }
    const columns = this._schema.value
    if (LmdbSchema.isColumnBuilder(columns)) {
      if (columns.enumValues !== undefined && !columns.enumValues.includes(value)) {
        throw new LmdbError(`Sub '${this.dbName}': invalid value '${String(value)}' for enum column 'value' — allowed: ${columns.enumValues.map((v) => String(v)).join(`, `)}.`)
      }
      return
    }
    if (typeof value !== `object` || value === null) return
    const row = value as Record<string, unknown>
    for (const [columnName, column] of Object.entries(columns)) {
      if (column.enumValues === undefined) continue
      const field = row[columnName]
      if (field === undefined) continue
      if (!column.enumValues.includes(field)) {
        throw new LmdbError(`Sub '${this.dbName}': invalid value '${String(field)}' for enum column '${columnName}' — allowed: ${column.enumValues.map((v) => String(v)).join(`, `)}.`)
      }
    }
  }

  /**
   * Fill absent fields from column defaults (copy-on-write).
   *
   * @remarks
   * No-op when the schema needs no guards. Scalar `undefined` values and
   * missing row fields resolve through `defaultFn`/`defaultValue`; the input
   * row is never mutated.
   *
   * @param value - The value about to be written.
   * @returns The value with defaults filled.
   */
  private _fillDefaults(value: unknown): unknown {
    if (!this._needsGuards) return value
    const columns = this._schema.value
    if (LmdbSchema.isColumnBuilder(columns)) {
      if (value === undefined && columns.hasDefault) {
        return columns.defaultFn ? columns.defaultFn() : columns.defaultValue
      }
      return value
    }
    if (typeof value !== `object` || value === null) return value
    const row = value as Record<string, unknown>
    let out: Record<string, unknown> | null = null
    for (const [columnName, column] of Object.entries(columns)) {
      if (!column.hasDefault || row[columnName] !== undefined) continue
      if (!out) out = {...row}
      out[columnName] = column.defaultFn ? column.defaultFn() : column.defaultValue
    }
    return out ?? value
  }

  /**
   * Probe and cache the sub's key kind from its first key.
   *
   * @param state - Sub-DB state (carries the cached kind).
   * @returns `string`, `buffer`, `number`, or `empty` for a keyless sub.
   */
  private _probeKeyType(state: LmdbSubState): `string` | `buffer` | `number` | `empty` {
    if (state.keyType) return state.keyType
    for (const k of state.env.getKeys({limit: 1})) {
      state.keyType = Buffer.isBuffer(k) ? `buffer` : typeof k === `string` ? `string` : `number`
      return state.keyType
    }
    state.keyType = `empty`
    return state.keyType
  }

  /**
   * Whether a prefix matches the sub's key kind (empty subs accept all).
   *
   * @param state - Sub-DB state.
   * @param prefix - The prefix to check.
   * @returns Whether prefix scans are kind-valid.
   */
  private _stringBoundsValid(state: LmdbSubState, prefix: ILmdbKey): boolean {
    const type = this._probeKeyType(state)
    if (type === `empty`) return true
    if (typeof prefix === `string`) return type === `string`
    if (Buffer.isBuffer(prefix)) return type === `buffer`
    return false
  }

  /**
   * Whether a prefix is an empty string or empty buffer.
   *
   * @param prefix - The prefix to check.
   * @returns Whether the prefix is empty (destructive ops reject these).
   */
  private _isEmptyPrefix(prefix: ILmdbKey): boolean {
    return (typeof prefix === `string` && prefix.length === 0) || (Buffer.isBuffer(prefix) && prefix.length === 0)
  }

  /**
   * Whether the sub's keys are strings (empty subs count as string-kind).
   *
   * @param state - Sub-DB state.
   * @returns Whether string prefix scans apply.
   */
  private _keysAreStrings(state: LmdbSubState): boolean {
    const type = this._probeKeyType(state)
    return type === `string` || type === `empty`
  }

  /**
   * Extract the literal prefix from a trailing-`*` glob (`admin:*` → `admin:`).
   *
   * @param pattern - The glob pattern.
   * @returns The literal prefix, or `null` when the pattern needs a full scan.
   */
  private _extractPrefixLikePattern(pattern: string): string | null {
    if (!pattern.endsWith(`*`)) return null
    if (pattern.indexOf(`?`) !== -1) return null
    if (pattern.indexOf(`*`) !== pattern.length - 1) return null
    return pattern.slice(0, -1)
  }

  /**
   * Exclusive upper bound for a prefix range scan.
   *
   * @remarks
   * Strings append the `\uffff` sentinel; buffers append a `0xff` byte.
   * Other key kinds have no computable bound.
   *
   * @param prefix - The prefix.
   * @returns The exclusive end key, or `undefined` when uncomputable.
   */
  private _prefixEnd(prefix: ILmdbKey): ILmdbKey | undefined {
    if (typeof prefix === `string`) {
      return `${prefix}￿`
    }
    if (Buffer.isBuffer(prefix)) {
      return Buffer.concat([prefix, Buffer.from([0xff])])
    }
    return undefined
  }

  /**
   * Infer `[start, end)` bounds from a glob's literal anchor.
   *
   * @param pattern - The glob pattern.
   * @returns Bounds from the leading literal run, or `null` when the pattern
   * starts with a wildcard or has no computable end.
   */
  private _inferRangeFromPrefix(pattern: string): {start: ILmdbKey; end: ILmdbKey} | null {
    if (pattern.length === 0) return null
    let anchor = ``
    for (const ch of pattern) {
      if (ch === `*` || ch === `?`) break
      anchor += ch
    }
    if (anchor.length === 0) return null
    const end = this._prefixEnd(anchor)
    if (end === undefined) return null
    return {start: anchor, end}
  }

  /**
   * Require a dupSort sub for a dupSort-only operation.
   *
   * @param state - Sub-DB state.
   * @param op - Operation name for the error message.
   * @throws {LmdbError} When the sub is not dupSort.
   */
  private _assertDupSort(state: LmdbSubState, op: string): void {
    if (!state.opts.dupSort) {
      throw new LmdbError(`Sub '${state.dbName}' is not dupSort. Open it with dupSort: true in the constructor opts to use ${op}.`)
    }
  }

  /**
   * Enforce the materialization cap before a result-set read.
   *
   * @remarks
   * An explicit over-cap `{limit}` always rejects. Otherwise only the
   * effective range (`start`+`end`, or inferred prefix bounds) is counted
   * via keys-only counting — selective patterns on oversized subs pass
   * instead of false-rejecting.
   *
   * @param state - Sub-DB state.
   * @param op - Operation name for the error message.
   * @param options - Caller range options (limit/offset/bounds).
   * @param bounds - Explicit scan bounds, when the caller computed them.
   * @throws {LmdbError} When the result would exceed the cap.
   */
  private _assertMaterialize(state: LmdbSubState, op: string, options?: IRangeOptions, bounds?: {start: ILmdbKey; end: ILmdbKey}): void {
    const max = MAX_MATERIALIZE
    const limit = options?.limit
    if (limit !== undefined) {
      if (limit > max) {
        throw new LmdbError(`${op} limit ${limit} exceeds the materialization cap of ${max} — use {limit} or iterate() to bound the result.`)
      }
      return
    }
    // Bounded ranges count only the range (exact when the scan covers exactly
    // [start, end)) instead of walking the whole sub-DB with getCount().
    const start = bounds?.start ?? options?.start
    const end = bounds?.end ?? options?.end
    if (start !== undefined && end !== undefined) {
      if (state.env.getKeysCount({start, end}) > max) {
        throw new LmdbError(`${op} would materialize more than ${max} entries into memory — use {limit} or iterate() to bound the result.`)
      }
      return
    }
    if (this._count(state) > max) {
      throw new LmdbError(`${op} would materialize more than ${max} entries into memory — use {limit} or iterate() to bound the result.`)
    }
  }

  /**
   * Enforce the materialization cap against an explicit count.
   *
   * @param op - Operation name for the error message.
   * @param count - Result count to check.
   * @throws {LmdbError} When `count` exceeds the cap.
   */
  private _assertMaterializeCount(op: string, count: number): void {
    const max = MAX_MATERIALIZE
    if (count > max) {
      throw new LmdbError(`${op} would materialize more than ${max} entries into memory — use {limit} or iterate() to bound the result.`)
    }
  }

  /**
   * Run the materialization guard, converting a throw into a rejection.
   *
   * @param state - Sub-DB state.
   * @param op - Operation name for the error message.
   * @param options - Caller range options (limit/offset/bounds).
   * @param bounds - Explicit scan bounds, when the caller computed them.
   * @returns `null` when within cap, otherwise the rejection for async paths.
   */
  private _rejectMaterialize(state: LmdbSubState, op: string, options?: IRangeOptions, bounds?: {start: ILmdbKey; end: ILmdbKey}): Promise<never> | null {
    try {
      this._assertMaterialize(state, op, options, bounds)
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  /**
   * Run the count guard, converting a throw into a rejection.
   *
   * @param op - Operation name for the error message.
   * @param count - Result count to check.
   * @returns `null` when within cap, otherwise the rejection for async paths.
   */
  private _rejectMaterializeCount(op: string, count: number): Promise<never> | null {
    try {
      this._assertMaterializeCount(op, count)
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  /**
   * Run the dupSort guard, converting a throw into a rejection.
   *
   * @param state - Sub-DB state.
   * @param op - Operation name for the error message.
   * @returns `null` when dupSort, otherwise the rejection for async paths.
   */
  private _rejectIfNotDupSort(state: LmdbSubState, op: string): Promise<never> | null {
    try {
      this._assertDupSort(state, op)
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  /**
   * Look up an index descriptor by name.
   *
   * @param state - Sub-DB state.
   * @param name - Declared index name.
   * @returns The index descriptor.
   * @throws {LmdbError} On an undeclared index name.
   */
  private _findIndex(state: LmdbSubState, name: string): IndexDescriptor {
    const idx = state.indexByName.get(name)
    if (!idx) throw new LmdbError(`Unknown index '${name}' on sub ${state.dbName}. Declared indexes: ${state.indexes.map((e) => e.name).join(`, `) || `none`}`)
    return idx
  }

  /**
   * Extract one index value per declared index from a row.
   *
   * @param state - Sub-DB state.
   * @param value - The row value.
   * @returns Extracted values aligned with `state.indexes` (`undefined`/`null`
   * entries skip the index).
   */
  private _computeIndexValues(state: LmdbSubState, value: unknown): Array<ILmdbKey | undefined | null> {
    return state.indexes.map((idx) => idx.extractor(value))
  }

  /**
   * Unpinned point read with codec/TTL unwrap and no expiry sweep.
   *
   * @remarks
   * Used by write paths to capture the pre-image (e.g. for index cleanup)
   * without pinning a snapshot or evicting expired entries.
   *
   * @param state - Sub-DB state.
   * @param key - The key to read.
   * @returns The decoded value, or `undefined` when absent.
   */
  private _peek(state: LmdbSubState, key: ILmdbKey): unknown | undefined {
    this._assertOpen()
    const raw = state.env.get(key)
    if (raw === undefined) return undefined
    const decoded = state.codec ? state.hookBeforeRead(raw) : raw
    if (state.isTtl) {
      const envelope = decoded as {v: unknown; exp?: number} | undefined
      return envelope?.v
    }
    return decoded
  }

  /**
   * Point read with snapshot pinning, codec decode, and TTL expiry eviction.
   *
   * @param state - Sub-DB state.
   * @param key - The key to read.
   * @param _tx - Read transaction to pin, if any.
   * @returns The decoded value, or `undefined` when absent or TTL-expired
   * (expired entries are evicted).
   */
  private _get(state: LmdbSubState, key: ILmdbKey, _tx?: LmdbTransaction): unknown | undefined {
    this._assertOpen()
    const opts = this._readOpts(_tx)
    const raw = opts ? state.env.get(key, opts) : state.env.get(key)
    if (raw === undefined) return undefined
    const decoded = state.codec ? state.hookBeforeRead(raw) : raw
    if (state.isTtl) {
      const envelope = decoded as {v: unknown; exp?: number} | undefined
      if (!envelope) return undefined
      if (envelope.exp !== undefined && Date.now() > envelope.exp) {
        void this._delete(state, key)
        return undefined
      }
      return envelope.v
    }
    return decoded
  }

  /**
   * Point read that throws on absence.
   *
   * @param state - Sub-DB state.
   * @param key - The key to read.
   * @param _tx - Read transaction to pin, if any.
   * @returns The decoded value.
   * @throws {LmdbError} When the key is absent.
   */
  private _getStrict(state: LmdbSubState, key: ILmdbKey, _tx?: LmdbTransaction): unknown {
    const value = this._get(state, key, _tx)
    if (value === undefined) {
      throw new LmdbError(`Key '${String(key)}' not found in sub '${state.dbName}'.`)
    }
    return value
  }

  /**
   * Existence probe with TTL expiry handling.
   *
   * @param state - Sub-DB state.
   * @param key - The key to check.
   * @param _tx - Read transaction to pin, if any.
   * @returns Whether a live entry exists (expired TTL entries count as missing).
   */
  private _has(state: LmdbSubState, key: ILmdbKey, _tx?: LmdbTransaction): boolean {
    this._assertOpen()
    if (!state.isTtl) {
      const opts = this._readOpts(_tx)
      return Boolean(opts ? state.env.doesExist(key, undefined, opts) : state.env.doesExist(key))
    }
    const envelope = state.env.get(key) as {v: unknown; exp?: number} | undefined
    if (!envelope) return false
    if (envelope.exp !== undefined && Date.now() > envelope.exp) {
      void this._delete(state, key)
      return false
    }
    return true
  }

  /**
   * Delete a key, maintaining indexes/search tables when present.
   *
   * @param state - Sub-DB state.
   * @param key - The key to delete.
   * @param tx - Write transaction to join, if any.
   * @returns Whether anything was removed.
   */
  private _delete(state: LmdbSubState, key: ILmdbKey, tx?: LmdbTransaction): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`delete`))
    const txErr = this._rejectBadTx(tx)
    if (txErr) return txErr
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      return this._indexedTx(state, () => {
        const existing = this._peek(state, key)
        if (existing === undefined && !state.env.doesExist(key)) return false
        this._deleteIndexedSync(state, key, existing)
        return true
      })
    }
    if (!state.env.doesExist(key)) return Promise.resolve(false)
    this._stageCdcDelete(state, key, `async`)
    return state.env.remove(key).then(() => true)
  }

  /**
   * Delete all entries including index and search tables.
   *
   * @param state - Sub-DB state.
   * @param tx - Write transaction to join, if any.
   * @returns Completion of the clear.
   */
  private _clear(state: LmdbSubState, tx?: LmdbTransaction): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`clear`))
    const txErr = this._rejectBadTx(tx)
    if (txErr) return txErr
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      const secondaries = [...state.indexes.map((idx) => idx.state), ...state.searchTables.map((table) => table.state)]
      this._stageCdcClear(state)
      return Promise.all(secondaries.map((secondary) => this._clear(secondary))).then(() => state.env.clearAsync())
    }
    this._stageCdcClear(state)
    return state.env.clearAsync()
  }

  /**
   * Drop the sub-DB itself.
   *
   * @param state - Sub-DB state.
   * @returns Completion of the drop.
   */
  private _drop(state: LmdbSubState): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`drop`))
    return state.env.drop()
  }

  /**
   * Page-fault keys into memory ahead of reads.
   *
   * @param state - Sub-DB state.
   * @param keys - Keys to prefetch.
   * @returns Completion of the prefetch.
   */
  private _prefetch(state: LmdbSubState, keys: ILmdbKey[]): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    return state.env.prefetch(keys).then(() => undefined as undefined)
  }

  /**
   * Batch point reads with codec decode, aligned with the input keys.
   *
   * @param state - Sub-DB state.
   * @param keys - Keys to read.
   * @returns Values in key order (`undefined` slots for misses).
   */
  private _getMany(state: LmdbSubState, keys: ILmdbKey[]): Promise<Array<unknown | undefined>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (keys.length === 0) return Promise.resolve([])
    const raws = state.env.getMany(keys) as Promise<Array<unknown>>
    if (!state.codec) return raws as Promise<Array<unknown | undefined>>
    return raws.then((arr) => arr.map((raw) => (raw === undefined ? undefined : state.hookBeforeRead(raw))))
  }

  /**
   * O(1) entry count (snapshot-pinned reads walk instead).
   *
   * @param state - Sub-DB state.
   * @param _tx - Read transaction to pin, if any.
   * @returns The entry count.
   */
  private _count(state: LmdbSubState, _tx?: LmdbTransaction): number {
    this._assertOpen()
    const opts = this._readOpts(_tx)
    // Snapshot-pinned reads keep the cursor-walk path; otherwise the O(1)
    // mdb_stat entry count via getStats() (getCount() walks the whole range).
    if (opts) return state.env.getCount(opts) as number
    return (state.env.getStats() as unknown as {entryCount: number}).entryCount
  }

  /**
   * Materializing key scan with closed-env and materialization guards.
   *
   * @param state - Sub-DB state.
   * @param options - Range options, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns The scanned keys.
   */
  private _keys(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): Promise<ILmdbKey[]> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `keys`, options)
    if (guard) return guard
    return Promise.resolve(state.env.getKeys(this._rangeOpts(options, tx)).asArray) as Promise<ILmdbKey[]>
  }

  /**
   * Materializing value scan with guards and codec decode.
   *
   * @param state - Sub-DB state.
   * @param options - Range options, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns The scanned values.
   */
  private _values(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): Promise<unknown[]> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `values`, options)
    if (guard) return guard
    const range = state.env.getRange(this._rangeOpts(options, tx))
    if (!state.codec) return range.map((e) => e.value).asArray
    return range.map((e) => state.hookBeforeRead(e.value)).asArray
  }

  /**
   * Materializing entry scan with guards and codec decode.
   *
   * @param state - Sub-DB state.
   * @param options - Range options, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns The scanned `[key, value]` entries.
   */
  private _entries(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): Promise<Array<[ILmdbKey, unknown]>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `entries`, options)
    if (guard) return guard
    const range = state.env.getRange(this._rangeOpts(options, tx))
    if (!state.codec) return range.map((e) => [e.key, e.value]).asArray as Promise<Array<[ILmdbKey, unknown]>>
    return range.map((e) => [e.key, state.hookBeforeRead(e.value)] as [ILmdbKey, unknown]).asArray
  }

  /**
   * Lazy entry stream with codec decode (never guarded).
   *
   * @param state - Sub-DB state.
   * @param options - Range options, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns Entries one at a time, decoded on the fly.
   */
  private async *_iterate(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): AsyncIterableIterator<[ILmdbKey, unknown]> {
    this._assertOpen()
    const iter = state.env.getRange(this._rangeOpts(options, tx))
    for (const entry of iter) {
      yield [entry.key, state.codec ? state.hookBeforeRead(entry.value) : entry.value]
    }
  }

  /**
   * Glob match with prefix optimization and ReDoS guard.
   *
   * @remarks
   * Trailing-`*` patterns on string keys become bounded range scans;
   * anchored patterns infer `[start, end)` bounds; the rest walk keys and
   * match via `Helper.globMatch`, fetching values in one batch so
   * non-matching rows are never decoded.
   *
   * @param state - Sub-DB state.
   * @param pattern - Glob pattern (`*`/`?` wildcards).
   * @param options - Range options, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns Matching `[key, value]` entries.
   * @throws {LmdbError} When wildcards exceed the ReDoS cap.
   */
  private _like(state: LmdbSubState, pattern: string, options?: IRangeOptions, tx?: LmdbTransaction): Promise<Array<[ILmdbKey, unknown]>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    let wildcardCount = 0
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i]
      if (ch === `*` || ch === `?`) wildcardCount++
    }
    if (wildcardCount > MAX_LIKE_WILDCARDS) {
      return Promise.reject(new LmdbError(`Pattern has ${wildcardCount} wildcards — limit is ${MAX_LIKE_WILDCARDS}. Too many wildcards risk ReDoS (catastrophic backtracking).`))
    }
    const stringsOnly = this._keysAreStrings(state)
    const prefix = stringsOnly ? this._extractPrefixLikePattern(pattern) : null
    const prefixEnd = prefix !== null ? this._prefixEnd(prefix) : undefined
    const inferred = prefix === null && stringsOnly ? this._inferRangeFromPrefix(pattern) : null
    const bounds = prefix !== null && prefixEnd !== undefined ? {start: prefix, end: prefixEnd} : (inferred ?? undefined)
    const guard = this._rejectMaterialize(state, `like`, options, bounds)
    if (guard) return guard
    const rangeOpts: IRangeOptions = {...options, ...(tx?.raw ? {transaction: tx.raw} : {})}
    if (prefix !== null) {
      if (prefixEnd !== undefined) {
        rangeOpts.start = prefix
        rangeOpts.end = prefixEnd
        const range = state.env.getRange(rangeOpts)
        if (!state.codec) return range.map((e) => [e.key, e.value]).asArray as Promise<Array<[ILmdbKey, unknown]>>
        return range.map((e) => [e.key, state.hookBeforeRead(e.value)]).asArray as Promise<Array<[ILmdbKey, unknown]>>
      }
    }
    if (inferred) {
      rangeOpts.start = options?.start ?? inferred.start
      if (options?.end === undefined) {
        rangeOpts.end = inferred.end
      }
    }
    // Keys-only walk: collect matches first, then fetch values in one batch so
    // non-matching rows are never decoded.
    const matchedKeys: ILmdbKey[] = []
    for (const k of state.env.getKeys(rangeOpts)) {
      if (Helper.globMatch(String(k), pattern)) matchedKeys.push(k)
    }
    if (matchedKeys.length === 0) return Promise.resolve([])
    return state.env.getMany(matchedKeys).then((raws) => {
      const rawArr = raws as Array<unknown>
      if (!state.codec) return rawArr.map((raw, i) => [matchedKeys[i], raw] as [ILmdbKey, unknown])
      return rawArr.map((raw, i) => [matchedKeys[i], state.hookBeforeRead(raw)] as [ILmdbKey, unknown])
    })
  }

  /**
   * Prefix scan with bounded-range fast path.
   *
   * @remarks
   * String/buffer prefixes with a computable end become `[prefix, end)`
   * scans; other key kinds fall back to a full key walk with `startsWith`
   * filtering, fetching values in one batch.
   *
   * @param state - Sub-DB state.
   * @param prefix - The prefix.
   * @param options - Range options, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns Matching `[key, value]` entries.
   */
  private _findByPrefix(state: LmdbSubState, prefix: ILmdbKey, options?: IRangeOptions, tx?: LmdbTransaction): Promise<Array<[ILmdbKey, unknown]>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(state, prefix)) {
      const guard = this._rejectMaterialize(state, `findByPrefix`, options, {start: prefix, end: endKey})
      if (guard) return guard
      const range = state.env.getRange({...options, start: prefix, end: endKey, ...(tx?.raw ? {transaction: tx.raw} : {})})
      if (!state.codec) return range.map((e) => [e.key, e.value]).asArray as Promise<Array<[ILmdbKey, unknown]>>
      return range.map((e) => [e.key, state.hookBeforeRead(e.value)]).asArray as Promise<Array<[ILmdbKey, unknown]>>
    }
    const guard = this._rejectMaterialize(state, `findByPrefix`, options)
    if (guard) return guard
    const prefixStr = String(prefix)
    const matchedKeys: ILmdbKey[] = []
    for (const k of state.env.getKeys(this._rangeOpts(options, tx))) {
      if (String(k).startsWith(prefixStr)) matchedKeys.push(k)
    }
    if (matchedKeys.length === 0) return Promise.resolve([])
    return state.env.getMany(matchedKeys).then((raws) => {
      const rawArr = raws as Array<unknown>
      if (!state.codec) return rawArr.map((raw, i) => [matchedKeys[i], raw] as [ILmdbKey, unknown])
      return rawArr.map((raw, i) => [matchedKeys[i], state.hookBeforeRead(raw)] as [ILmdbKey, unknown])
    })
  }

  /**
   * Count keys under a prefix (bounded count fast path).
   *
   * @param state - Sub-DB state.
   * @param prefix - The prefix.
   * @returns The matching key count.
   */
  private _countByPrefix(state: LmdbSubState, prefix: ILmdbKey): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(state, prefix)) {
      return Promise.resolve(state.env.getKeysCount({start: prefix, end: endKey}))
    }
    let count = 0
    const prefixStr = String(prefix)
    for (const k of state.env.getKeys()) {
      if (String(k).startsWith(prefixStr)) count++
    }
    return Promise.resolve(count)
  }

  /**
   * Collect prefix-matching keys via a full key walk.
   *
   * @param state - Sub-DB state.
   * @param prefix - The prefix.
   * @returns Matching keys (unbounded — callers guard first).
   */
  private _collectPrefixKeys(state: LmdbSubState, prefix: ILmdbKey): ILmdbKey[] {
    const matched: ILmdbKey[] = []
    const prefixStr = String(prefix)
    for (const k of state.env.getKeys()) {
      if (String(k).startsWith(prefixStr)) matched.push(k)
    }
    return matched
  }

  /**
   * Delete every key under a prefix in one transaction.
   *
   * @remarks
   * Indexed subs delete via the indexed path (index rows cleaned);
   * plain subs remove keys directly. CDC delete events are staged per key.
   *
   * @param state - Sub-DB state.
   * @param prefix - The prefix (empty prefixes reject — use `clear()`).
   * @returns The number of removed entries.
   * @throws {LmdbError} On empty prefixes or over-cap ranges.
   */
  private _deleteByPrefix(state: LmdbSubState, prefix: ILmdbKey): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`deleteByPrefix`))
    if (this._isEmptyPrefix(prefix)) {
      return Promise.reject(new LmdbError(`Prefix must not be empty. Use clear() to delete every entry.`))
    }
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(state, prefix)) {
      const guard = this._rejectMaterializeCount(`deleteByPrefix`, state.env.getKeysCount({start: prefix, end: endKey}))
      if (guard) return guard
    } else {
      const guard = this._rejectMaterializeCount(`deleteByPrefix`, this._count(state))
      if (guard) return guard
    }
    const keysPromise: Promise<ILmdbKey[]> = endKey !== undefined && this._stringBoundsValid(state, prefix) ? (Promise.resolve(state.env.getKeys({start: prefix, end: endKey}).asArray) as Promise<ILmdbKey[]>) : Promise.resolve(this._collectPrefixKeys(state, prefix))
    return keysPromise.then((keys) =>
      this.owner.transactionFast(() => {
        const indexed = state.indexes.length > 0 || state.searchTables.length > 0
        let removed = 0
        for (const k of keys) {
          if (indexed) {
            const existing = this._peek(state, k)
            if (existing !== undefined) {
              this._deleteIndexedSync(state, k, existing)
              removed++
              continue
            }
          }
          if (state.env.removeSync(k)) {
            this._stageCdcDelete(state, k, `sync`)
            removed++
          }
        }
        return removed
      })
    )
  }

  /**
   * First entry in native order with codec decode.
   *
   * @param state - Sub-DB state.
   * @param tx - Read transaction to pin, if any.
   * @returns The first `[key, value]`, or `undefined` when empty.
   */
  private _first(state: LmdbSubState, tx?: LmdbTransaction): Promise<[ILmdbKey, unknown] | undefined> {
    const closed = this._rejectClosed()
    if (closed) return closed
    return Promise.resolve(state.env.getRange(this._rangeOpts({limit: 1}, tx)).asArray).then((arr) => {
      const entry = (arr as Array<{key: ILmdbKey; value: unknown}>)[0]
      return entry ? ([entry.key, state.codec ? state.hookBeforeRead(entry.value) : entry.value] as [ILmdbKey, unknown]) : undefined
    })
  }

  /**
   * Last entry in native order with codec decode.
   *
   * @param state - Sub-DB state.
   * @param tx - Read transaction to pin, if any.
   * @returns The last `[key, value]`, or `undefined` when empty.
   */
  private _last(state: LmdbSubState, tx?: LmdbTransaction): Promise<[ILmdbKey, unknown] | undefined> {
    const closed = this._rejectClosed()
    if (closed) return closed
    return Promise.resolve(state.env.getRange(this._rangeOpts({reverse: true, limit: 1}, tx)).asArray).then((arr) => {
      const entry = arr[0]
      return entry ? ([entry.key, state.codec ? state.hookBeforeRead(entry.value) : entry.value] as [ILmdbKey, unknown]) : undefined
    })
  }

  /**
   * Conditional insert — writes only when the key is absent.
   *
   * @remarks
   * Indexed subs check existence inside the write transaction; plain subs
   * use the native atomic `ifNoExists`.
   *
   * @param state - Sub-DB state.
   * @param key - The key to insert.
   * @param value - The value to store.
   * @returns Whether the write happened.
   */
  private _putIfNotExists(state: LmdbSubState, key: ILmdbKey, value: unknown): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`putIfNotExists`))
    try {
      value = this._fillDefaults(value)
      this._assertEnum(key, value)
    } catch (err) {
      return Promise.reject(err)
    }
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      return this._indexedTx(state, () => {
        if (state.env.doesExist(key)) return false
        this._writeIndexedSync(state, key, value, encoded)
        return true
      })
    }
    return state.env.ifNoExists(key, () => {
      this._stageCdcPut(state, key, value, `async`)
      void state.env.put(key, encoded)
    })
  }

  /**
   * Atomic numeric increment (read-then-write in one transaction).
   *
   * @remarks
   * Rejects on indexed/search subs (the index would go stale), on
   * non-finite deltas, and on non-numeric current values. Missing keys
   * start from `0`.
   *
   * @param state - Sub-DB state.
   * @param key - The counter key.
   * @param delta - Amount to add (default `1`).
   * @returns The new counter value.
   * @throws {LmdbError} On indexed subs.
   * @throws {TypeError} On non-finite deltas or non-numeric currents.
   */
  private _increment(state: LmdbSubState, key: ILmdbKey, delta = 1): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`increment`))
    if (state.indexes.length > 0 || state.searchTables.length > 0) return Promise.reject(new LmdbError(`increment is not supported on subs with embedded indexes or search tables (${state.dbName}) — the indexed value would go stale. Use a separate non-indexed sub for counters.`))
    if (typeof delta !== `number` || !Number.isFinite(delta)) {
      return Promise.reject(new TypeError(`delta must be a finite number`))
    }
    return this.owner.transaction(() => {
      const current = this._get(state, key)
      if (current !== undefined && typeof current !== `number`) {
        throw new TypeError(`Cannot increment non-numeric value for key '${String(key)}'`)
      }
      const next = (current ?? 0) + delta
      this._put(state, key, next)
      return next
    })
  }

  /**
   * Atomic decrement implemented as a negative increment.
   *
   * @param state - Sub-DB state.
   * @param key - The counter key.
   * @param amount - Amount to subtract (default `1`).
   * @returns The new counter value.
   */
  private _decrement(state: LmdbSubState, key: ILmdbKey, amount = 1): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (typeof amount !== `number` || !Number.isFinite(amount)) {
      return Promise.reject(new TypeError(`amount must be a finite number`))
    }
    return this._increment(state, key, -amount)
  }

  /**
   * Append a value under a dupSort key.
   *
   * @param state - Sub-DB state.
   * @param key - The key.
   * @param value - The duplicate value to append.
   * @returns Boolean.
   */
  private _addValue(state: LmdbSubState, key: ILmdbKey, value: unknown): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const dup = this._rejectIfNotDupSort(state, `addValue`)
    if (dup) return dup
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`addValue`))
    try {
      value = this._fillDefaults(value)
      this._assertEnum(key, value)
    } catch (err) {
      return Promise.reject(err)
    }
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    this._stageCdcPut(state, key, value, `async`)
    return state.env.put(key, encoded)
  }

  /**
   * Read dupSort values under a key with pagination and codec decode.
   *
   * @param state - Sub-DB state.
   * @param key - The key.
   * @param tx - Read transaction to pin, if any.
   * @param range - Optional `{limit, offset}` paging.
   * @returns The decoded duplicate values.
   */
  private _getValues(state: LmdbSubState, key: ILmdbKey, tx?: LmdbTransaction, range?: {limit?: number; offset?: number}): Promise<unknown[]> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const dup = this._rejectIfNotDupSort(state, `getValues`)
    if (dup) return dup
    const opts = {...(tx?.raw ? {transaction: tx.raw} : {}), ...(range?.limit !== undefined ? {limit: range.limit} : {}), ...(range?.offset !== undefined ? {offset: range.offset} : {})}
    const raws = state.env.getValues(key, opts).asArray as Promise<unknown[]>
    if (!state.codec) return raws
    return raws.then((arr) => arr.map((raw) => state.hookBeforeRead(raw)))
  }

  /**
   * Count dupSort values under a key via the native count.
   *
   * @param state - Sub-DB state.
   * @param key - The key.
   * @param tx - Read transaction to pin, if any.
   * @returns The duplicate count.
   */
  private _getValuesCount(state: LmdbSubState, key: ILmdbKey, tx?: LmdbTransaction): number {
    this._assertOpen()
    this._assertDupSort(state, `getValuesCount`)
    return state.env.getValuesCount(key, tx?.raw ? {transaction: tx.raw} : undefined)
  }

  /**
   * Remove one dupSort value by exact match.
   *
   * @remarks
   * The native remove always reports success, so real removal is detected
   * by comparing the O(1) native count before and after.
   *
   * @param state - Sub-DB state.
   * @param key - The key.
   * @param value - The duplicate value to remove.
   * @returns Whether a value was actually removed.
   */
  private _removeValue(state: LmdbSubState, key: ILmdbKey, value: unknown): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const dup = this._rejectIfNotDupSort(state, `removeValue`)
    if (dup) return dup
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`removeValue`))
    // Native dupSort remove targets the exact stored value, but always reports
    // `true` even when the value is absent — compare the O(1) native count
    // before and after instead of materialising + stringify-ing the value list.
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    const before = this._getValuesCount(state, key)
    if (before === 0) return Promise.resolve(false)
    this._stageCdcDelete(state, key, `async`, value)
    return state.env.remove(key, encoded).then(() => {
      return this._getValuesCount(state, key) < before
    })
  }

  /**
   * Raw binary write bypassing codec and indexes.
   *
   * @param state - Sub-DB state.
   * @param key - The key.
   * @param value - Binary payload.
   * @returns Boolean Completion of the write.
   * @throws {LmdbError} On subs with indexes/search tables (binary writes
   * would leave them stale).
   */
  private _putBinary(state: LmdbSubState, key: ILmdbKey, value: Buffer | Uint8Array): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`putBinary`))
    if (state.indexes.length > 0 || state.searchTables.length > 0) return Promise.reject(new LmdbError(`putBinary is not supported on subs with embedded indexes or search tables (${state.dbName}) — binary writes bypass the index extractor.`))
    this._stageCdcPut(state, key, value, `async`)
    return state.env.put(key, asBinary(value))
  }

  /**
   * Raw binary read.
   *
   * @param state - Sub-DB state.
   * @param key - The key to read.
   * @returns The stored bytes, or `undefined` when absent.
   */
  private _getBinary(state: LmdbSubState, key: ILmdbKey): Buffer | undefined {
    this._assertOpen()
    return state.env.getBinary(key)
  }

  /**
   * Raw binary read via the native fast path.
   *
   * @param state - Sub-DB state.
   * @param key - The key to read.
   * @returns The stored bytes, or `undefined` when absent.
   */
  private _getBinaryFast(state: LmdbSubState, key: ILmdbKey): Buffer | undefined {
    this._assertOpen()
    return state.env.getBinaryFast(key)
  }

  /**
   * Chunked bulk import with guards, sorted-append fast path, and progress.
   *
   * @remarks
   * Guards/defaults/enums run upfront. With `{sorted: true}` the order is
   * validated with lmdb's own comparator before anything is written (first
   * inversion aborts), and primary puts ride `MDB_APPEND` while index/search
   * maintenance keeps normal point writes. TTL subs store expiry envelopes.
   *
   * @param state - Sub-DB state.
   * @param entries - Rows to write.
   * @param chunkSize - Rows per transaction (default `500`).
   * @param options - `{sorted?, onProgress?}`.
   * @returns Completion of the import.
   * @throws {LmdbError} On the first out-of-order key when sorted.
   */
  private async _putMany(state: LmdbSubState, entries: Array<[ILmdbKey, unknown]>, chunkSize = 500, options?: {sorted?: boolean; onProgress?: (done: number, total: number) => void}): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`putMany`))
    if (entries.length === 0) return
    if (this._needsGuards) {
      try {
        entries = entries.map(([key, value]) => [key, this._fillDefaults(value)] as [ILmdbKey, unknown])
        for (const [key, value] of entries) this._assertEnum(key, value)
      } catch (err) {
        return Promise.reject(err)
      }
    }
    const sorted = options?.sorted === true
    const onProgress = options?.onProgress
    const total = entries.length
    let done = 0
    // Upfront order validation with lmdb's own comparator, so the check
    // agrees with storage order on every key type — the first inversion
    // aborts before anything is written (unwrapped error, unlike chunk
    // failures). DupSort primaries allow equal keys (APPENDDUP); everything
    // else must ascend strictly.
    if (sorted) {
      let prev: ILmdbKey | undefined
      let hasPrev = false
      for (const [key] of entries) {
        if (hasPrev) {
          const cmp = compareKeys(key, prev!)
          const ordered = state.opts.dupSort ? cmp >= 0 : cmp > 0
          if (!ordered) throw new LmdbError(`Sub '${state.dbName}': bulk import with {sorted: true} hit out-of-order key '${String(key)}' after '${String(prev)}' — input must be sorted ascending.`)
        }
        prev = key
        hasPrev = true
      }
    }
    const codec = state.codec
    const encode = codec ? (v: unknown): unknown => codec.hookBeforeWrite(v) : (v: unknown): unknown => v
    // Mirror _put: TTL subs always store the expiry envelope (hook runs on it).
    const defaultTtlMs = state.isTtl && typeof state.ttlMs === `number` && state.ttlMs > 0 ? state.ttlMs : undefined
    const toStored = (v: unknown): unknown => {
      if (!state.isTtl) return v
      const exp = defaultTtlMs !== undefined ? Date.now() + defaultTtlMs : undefined
      return exp !== undefined ? {v, exp} : {v}
    }
    // Append options for the primary put (MDB_APPEND skips the B-tree search
    // per put). Index/search maintenance keeps normal point writes — only the
    // primary put appends.
    const appendOpts: PutOptions | undefined = sorted ? (state.opts.dupSort ? {appendDup: true} : {append: true}) : undefined
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      for (let i = 0; i < entries.length; i += chunkSize) {
        const end = Math.min(i + chunkSize, entries.length)
        await this._indexedTx(state, () => {
          for (let j = i; j < end; j++) {
            const e = entries[j]!
            this._writeIndexedSync(state, e[0], e[1], encode(toStored(e[1])), appendOpts)
          }
        })
        done = end
        onProgress?.(done, total)
      }
      return
    }
    for (let i = 0; i < entries.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, entries.length)
      await this.owner.transactionFast(() => {
        for (let j = i; j < end; j++) {
          const e = entries[j]!
          this._stageCdcPut(state, e[0], e[1], `sync`)
          if (appendOpts !== undefined) state.env.putSync(e[0], encode(toStored(e[1])), appendOpts)
          else void state.env.put(e[0], encode(toStored(e[1])))
        }
      })
      done = end
      onProgress?.(done, total)
    }
  }

  /**
   * Dump all entries as newline-delimited JSON (`[key, value]` per line).
   *
   * @param state - Sub-DB state.
   * @returns The JSONL document.
   */
  private async _exportJSONL(state: LmdbSubState): Promise<string> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const entries = await this._entries(state)
    return entries.map(([k, v]) => JSON.stringify([k, v])).join(`\n`)
  }

  /**
   * Parse JSONL and bulk-import it via chunked puts.
   *
   * @param state - Sub-DB state.
   * @param jsonl - Newline-delimited `[key, value]` pairs (blank lines skipped).
   * @param options - `{sorted?, onProgress?}` forwarded to the bulk writer.
   * @returns The number of imported rows.
   */
  private async _importJSONL(state: LmdbSubState, jsonl: string, options?: {sorted?: boolean; onProgress?: (done: number, total: number) => void}): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`importJSONL`))
    const trimmed = jsonl.trim()
    if (!trimmed) return 0
    // Single pass: split once, skip blank lines, parse inline (no map/filter/map chain).
    const entries: Array<[ILmdbKey, unknown]> = []
    for (const line of trimmed.split(`\n`)) {
      const clean = line.trim()
      if (clean.length === 0) continue
      entries.push(JSON.parse(clean) as [ILmdbKey, unknown])
    }
    if (entries.length === 0) return 0
    await this._putMany(state, entries, 500, options)
    return entries.length
  }

  /**
   * Validated write with TTL envelopes and indexed/plain paths.
   *
   * @remarks
   * Fills defaults, validates enums, then routes: TTL subs wrap the row in
   * an expiry envelope; indexed/search subs write through the indexed
   * transaction; plain subs put directly.
   *
   * @param state - Sub-DB state.
   * @param key - The key to write.
   * @param value - The row to store.
   * @param txOrVersion - Write transaction to join, or a version number.
   * @param ttlOverride - Per-put TTL (`number` ms or `{ttlMs}`).
   * @returns Completion of the write.
   */
  private _put(state: LmdbSubState, key: ILmdbKey, value: unknown, txOrVersion?: LmdbTransaction | number, ttlOverride?: number | {ttlMs: number} | undefined): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbError(`put`))
    const tx = typeof txOrVersion === `number` ? undefined : txOrVersion
    const version = typeof txOrVersion === `number` ? txOrVersion : undefined
    const txErr = this._rejectBadTx(tx)
    if (txErr) return txErr
    try {
      value = this._fillDefaults(value)
      this._assertEnum(key, value)
    } catch (err) {
      return Promise.reject(err)
    }
    if (state.isTtl) {
      let ttlMs: number | undefined
      if (typeof ttlOverride === `number`) ttlMs = ttlOverride
      else if (ttlOverride && typeof (ttlOverride as {ttlMs?: unknown}).ttlMs === `number`) ttlMs = (ttlOverride as {ttlMs: number}).ttlMs
      if (ttlMs === undefined && typeof state.ttlMs === `number` && state.ttlMs > 0) ttlMs = state.ttlMs
      const exp = typeof ttlMs === `number` && ttlMs > 0 ? Date.now() + ttlMs : undefined
      const envelope = exp !== undefined ? {v: value, exp} : {v: value}
      const stored = state.codec ? state.codec.hookBeforeWrite(envelope) : envelope
      if (state.indexes.length > 0 || state.searchTables.length > 0) {
        return this._indexedTx(state, () => {
          this._writeIndexedSync(state, key, value, stored)
        })
      }
      this._stageCdcPut(state, key, value, `async`)
      return state.env.put(key, stored).then(() => undefined)
    }
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      if (version !== undefined) {
        return this._indexedTx(state, () => this._writeIndexedInner(state, key, value, encoded, `async`, version))
      }
      return this._writeIndexed(state, key, value, encoded)
    }
    if (version !== undefined) {
      this._stageCdcPut(state, key, value, `async`)
      return state.env.put(key, encoded, version).then(() => undefined)
    }
    this._stageCdcPut(state, key, value, `async`)
    return state.env.put(key, encoded).then(() => undefined)
  }

  /**
   * Entry read (value + version) with codec decode.
   *
   * @param state - Sub-DB state.
   * @param key - The key to read.
   * @returns The entry with decoded value, or `undefined` when absent.
   */
  private _getEntry(state: LmdbSubState, key: ILmdbKey): {version: number; value: unknown} | undefined {
    this._assertOpen()
    const entry = state.env.getEntry(key) as {version: number; value: unknown} | undefined
    // Every read path decodes through the hook slot — getEntry is no
    // exception (its public type promises the row form, not the stored form).
    if (entry === undefined || !state.codec) return entry
    return {...entry, value: state.hookBeforeRead(entry.value)}
  }

  /**
   * Synchronous validated write with indexed/plain paths.
   *
   * @remarks
   * Drains CDC immediately when ambient (inside a transaction the outermost
   * wrapper drains instead).
   *
   * @param state - Sub-DB state.
   * @param key - The key to write.
   * @param value - The row to store.
   */
  private _putSync(state: LmdbSubState, key: ILmdbKey, value: unknown): void {
    this._assertOpen()
    value = this._fillDefaults(value)
    this._assertEnum(key, value)
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      this._writeIndexedSync(state, key, value, encoded)
      return
    }
    state.env.putSync(key as never, encoded as never)
    this._stageCdcPut(state, key, value, `sync`)
    this._drainCdcIfAmbient()
  }

  /**
   * Synchronous delete with index maintenance and ambient CDC drain.
   *
   * @param state - Sub-DB state.
   * @param key - The key to delete.
   * @param value - Exact value for dupSort removes, if known.
   * @returns Whether anything was removed.
   */
  private _removeSync(state: LmdbSubState, key: ILmdbKey, value?: unknown): boolean {
    this._assertOpen()
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      const existing = this._peek(state, key)
      if (existing === undefined && !state.env.doesExist(key)) return false
      this._deleteIndexedSync(state, key, existing)
      this._drainCdcIfAmbient()
      return true
    }
    const removed = value !== undefined ? state.env.removeSync(key as never, value as never) : state.env.removeSync(key as never)
    if (!removed) return false
    this._stageCdcDelete(state, key, `sync`, value)
    this._drainCdcIfAmbient()
    return true
  }

  /**
   * Lazy key iterable (never guarded — streams instead of materializing).
   *
   * @param state - Sub-DB state.
   * @param options - Range options, if any.
   * @returns The key iterable.
   */
  private _getKeys(state: LmdbSubState, options?: IRangeOptions): Iterable<ILmdbKey> {
    this._assertOpen()
    return state.env.getKeys(options) as Iterable<ILmdbKey>
  }

  /**
   * Core indexed write: unique checks, old-row cleanup, then the primary put.
   *
   * @remarks
   * Unique conflicts throw the raw index message (self-updates allowed).
   * Stale index rows are freed, search postings maintained, and the put
   * event staged — then the primary put runs in `sync` (direct) or `async`
   * (queued) mode, honoring version and sorted-append options.
   *
   * @param state - Sub-DB state.
   * @param key - The primary key.
   * @param value - The decoded row (for extractors and CDC).
   * @param stored - The encoded row for the primary put.
   * @param mode - `sync` for direct puts, `async` for queued puts.
   * @param version - Version stamp, if any.
   * @param appendOpts - Sorted-append options for bulk imports, if any.
   * @throws {LmdbError} On unique-index conflicts with another key.
   */
  private _writeIndexedInner(state: LmdbSubState, key: ILmdbKey, value: unknown, stored: unknown, mode: `sync` | `async`, version?: number, appendOpts?: PutOptions): void {
    const existing = this._peek(state, key)
    const oldValues = existing === undefined ? new Array(state.indexes.length).fill(undefined) : this._computeIndexValues(state, existing)
    const newValues = this._computeIndexValues(state, value)
    for (let i = 0; i < state.indexes.length; i++) {
      const idx = state.indexes[i]!
      const newVal = newValues[i]
      if (newVal === undefined || newVal === null) continue
      if (idx.unique) {
        const owner = this._get(idx.state, newVal)
        if (owner !== undefined && owner !== key) {
          throw new LmdbError(`Unique index '${idx.name}' violated: index value '${String(newVal)}' is already owned by a different primary key (write was for key '${String(key)}').`)
        }
      }
    }
    for (let i = 0; i < state.indexes.length; i++) {
      const idx = state.indexes[i]!
      const oldVal = oldValues[i]
      const newVal = newValues[i]
      if (oldVal === newVal) continue
      if (oldVal !== undefined && oldVal !== null) {
        if (idx.unique) {
          const owner = this._get(idx.state, oldVal)
          if (owner === key) {
            if (mode === `sync`) idx.state.env.removeSync(oldVal as never)
            else void idx.state.env.remove(oldVal as never)
          }
        } else if (mode === `sync`) {
          idx.state.env.removeSync(oldVal as never, key as never)
        } else {
          void idx.state.env.remove(oldVal as never, key as never)
        }
      }
      if (newVal !== undefined && newVal !== null) {
        if (mode === `sync`) idx.state.env.putSync(newVal as never, key as never)
        else void idx.state.env.put(newVal as never, key as never)
      }
    }
    this._maintainSearch(state, key, existing, value, mode)
    this._stageCdcPut(state, key, value, mode)
    if (mode === `sync`) {
      // Sorted bulk imports append the primary put (no B-tree search);
      // versioned single writes keep the version form (no combined overload).
      if (appendOpts !== undefined && version === undefined) {
        state.env.putSync(key as never, stored, appendOpts)
      } else if (version !== undefined) {
        state.env.putSync(key as never, stored, version)
      } else {
        state.env.putSync(key as never, stored)
      }
    } else if (version !== undefined) {
      void state.env.put(key as never, stored, version)
    } else {
      void state.env.put(key as never, stored)
    }
  }

  /**
   * Synchronous indexed write without version or append options.
   *
   * @param state - Sub-DB state.
   * @param key - The primary key.
   * @param value - The decoded row (for extractors and CDC).
   * @param stored - The encoded row for the primary put.
   * @param appendOpts - Sorted-append options for bulk imports, if any.
   */
  private _writeIndexedSync(state: LmdbSubState, key: ILmdbKey, value: unknown, stored: unknown, appendOpts?: PutOptions): void {
    this._writeIndexedInner(state, key, value, stored, `sync`, undefined, appendOpts)
  }

  /**
   * Synchronous indexed delete: index rows, search terms, CDC, then primary.
   *
   * @param state - Sub-DB state.
   * @param key - The primary key.
   * @param existing - Pre-image for extractor cleanup (`undefined` when unknown).
   */
  private _deleteIndexedSync(state: LmdbSubState, key: ILmdbKey, existing: unknown | undefined): void {
    const oldValues = existing === undefined ? new Array(state.indexes.length).fill(undefined) : this._computeIndexValues(state, existing)
    for (let i = 0; i < state.indexes.length; i++) {
      const idx = state.indexes[i]!
      const oldVal = oldValues[i]
      if (oldVal === undefined || oldVal === null) continue
      if (idx.unique) {
        const owner = this._get(idx.state, oldVal)
        if (owner === key) idx.state.env.removeSync(oldVal as never)
      } else {
        idx.state.env.removeSync(oldVal as never, key as never)
      }
    }
    this._maintainSearch(state, key, existing, undefined, `sync`)
    this._stageCdcDelete(state, key, `sync`)
    state.env.removeSync(key as never)
  }

  /**
   * Stage a put event into the CDC outbox.
   *
   * @remarks
   * Skipped for `__`-prefixed internal subs and until capture arms (first
   * subscribe/tail/ack/prune) — earlier writes stay invisible.
   *
   * @param state - Sub-DB state.
   * @param key - The written key.
   * @param value - The decoded row.
   * @param mode - `sync` for direct appends, `async` for queued appends.
   */
  private _stageCdcPut(state: LmdbSubState, key: ILmdbKey, value: unknown, mode: `sync` | `async`): void {
    if (state.dbName.startsWith(`__`)) return // internal subs (queue meta, cdc log, migrations) stay out of the outbox
    const entry = Cdc.for(this.owner)
    if (!entry.hub.active) return // capture arms on first subscribe/tail/ack/prune — earlier writes stay invisible
    entry.store.append(state.dbName, {type: `put`, key, value}, mode)
  }

  /**
   * Stage a delete event into the CDC outbox.
   *
   * @remarks
   * Same skip rules as puts. The value rides along for dupSort exact
   * removes; plain deletes carry `undefined`.
   *
   * @param state - Sub-DB state.
   * @param key - The deleted key.
   * @param mode - `sync` for direct appends, `async` for queued appends.
   * @param value - The removed value, when carried.
   */
  private _stageCdcDelete(state: LmdbSubState, key: ILmdbKey, mode: `sync` | `async`, value: unknown = undefined): void {
    if (state.dbName.startsWith(`__`)) return // internal subs (queue meta, cdc log, migrations) stay out of the outbox
    const entry = Cdc.for(this.owner)
    if (!entry.hub.active) return // capture arms on first subscribe/tail/ack/prune — earlier writes stay invisible
    entry.store.append(state.dbName, {type: `delete`, key, value}, mode)
  }

  /**
   * Stage one clear event into the CDC outbox.
   *
   * @remarks
   * Same skip rules as puts; a single event covers the whole clear.
   *
   * @param state - Sub-DB state.
   */
  private _stageCdcClear(state: LmdbSubState): void {
    if (state.dbName.startsWith(`__`)) return // internal subs (queue meta, cdc log, migrations) stay out of the outbox
    const entry = Cdc.for(this.owner)
    if (!entry.hub.active) return // capture arms on first subscribe/tail/ack/prune — earlier writes stay invisible
    entry.store.append(state.dbName, {type: `clear`, key: undefined, value: undefined}, `sync`)
  }

  /**
   * Drain staged CDC events now when outside a write transaction.
   *
   * @remarks
   * `getWriteTxnId` throws outside a write txn — ambient sync ops commit on
   * the spot, so publish now; inside a transaction the outermost wrapper
   * drains instead.
   */
  private _drainCdcIfAmbient(): void {
    // getWriteTxnId throws outside a write txn. Ambient sync ops commit on
    // the spot, so publish now; inside a txn the outermost wrapper drains.
    try {
      this.owner.getWriteTxnId()
    } catch {
      Cdc.for(this.owner).hub.drain()
    }
  }

  /**
   * Tokenize one searched column of a row value.
   *
   * @param value - The row value.
   * @param column - The searched column name.
   * @returns The term set (empty for non-object rows).
   */
  private _searchTermsOf(value: unknown, column: string): Set<string> {
    if (value === null || typeof value !== `object`) return new Set<string>()
    // Narrow record access mirrors the auto-resolved index extractor idiom in
    // sub-manager.ts — the only cast in this helper, kept to one site.
    return new Set(LmdbSearch.tokenizeField((value as Record<string, unknown>)[column]))
  }

  /**
   * Insert term→key postings into a search table.
   *
   * @param table - Target search table.
   * @param key - The primary key posting.
   * @param terms - Terms to post.
   * @param mode - `sync` for direct puts, `async` for queued puts.
   */
  private _putSearchTerms(table: ISearchTable, key: ILmdbKey, terms: Set<string>, mode: `sync` | `async`): void {
    for (const term of terms) {
      if (mode === `sync`) table.state.env.putSync(term as never, key as never)
      else void table.state.env.put(term as never, key as never)
    }
  }

  /**
   * Remove term→key postings from a search table.
   *
   * @param table - Target search table.
   * @param key - The primary key posting.
   * @param terms - Terms to unpost.
   * @param mode - `sync` for direct removes, `async` for queued removes.
   */
  private _removeSearchTerms(table: ISearchTable, key: ILmdbKey, terms: Set<string>, mode: `sync` | `async`): void {
    for (const term of terms) {
      if (mode === `sync`) table.state.env.removeSync(term as never, key as never)
      else void table.state.env.remove(term as never, key as never)
    }
  }

  /**
   * Diff old/new terms per searched column and update postings.
   *
   * @param state - Sub-DB state.
   * @param key - The primary key.
   * @param oldValue - Pre-image (`undefined` on insert).
   * @param newValue - Post-image (`undefined` on delete).
   * @param mode - `sync` for direct writes, `async` for queued writes.
   */
  private _maintainSearch(state: LmdbSubState, key: ILmdbKey, oldValue: unknown | undefined, newValue: unknown | undefined, mode: `sync` | `async`): void {
    for (const table of state.searchTables) {
      const oldTerms = oldValue === undefined ? new Set<string>() : this._searchTermsOf(oldValue, table.column)
      const newTerms = newValue === undefined ? new Set<string>() : this._searchTermsOf(newValue, table.column)
      const removed = new Set<string>()
      const added = new Set<string>()
      for (const term of oldTerms) {
        if (!newTerms.has(term)) removed.add(term)
      }
      for (const term of newTerms) {
        if (!oldTerms.has(term)) added.add(term)
      }
      this._removeSearchTerms(table, key, removed, mode)
      this._putSearchTerms(table, key, added, mode)
    }
  }

  /**
   * Async indexed write through the unwrapping transaction.
   *
   * @param state - Sub-DB state.
   * @param key - The primary key.
   * @param value - The decoded row (for extractors and CDC).
   * @param stored - The encoded row for the primary put.
   * @returns Completion of the write.
   */
  private _writeIndexed(state: LmdbSubState, key: ILmdbKey, value: unknown, stored: unknown): Promise<void> {
    return this._indexedTx(state, () => {
      this._writeIndexedSync(state, key, value, stored)
    })
  }

  /**
   * Run an indexed write inside a transaction, unwrapping unique violations.
   *
   * @remarks
   * Unique conflicts surface with the raw index message instead of wrapped
   * as `Transaction failed` — callers match on the message prefix.
   *
   * @param _state - Sub-DB state (transaction runs on the owning env).
   * @param fn - The indexed write to run.
   * @returns The callback's result.
   */
  private _indexedTx<T>(_state: LmdbSubState, fn: () => T): Promise<T> {
    return this.owner.transaction(fn).catch((err: unknown) => {
      // Unique violations surface with the raw index message, not wrapped as
      // `Transaction failed` — the only `instanceof` discrimination left is
      // the message prefix, since all failures share the LmdbError class.
      if (err instanceof LmdbError) {
        const cause = (err as unknown as {cause?: unknown}).cause
        if (cause instanceof LmdbError && cause.message.startsWith(`Unique index `)) throw cause
      }
      throw err
    })
  }

  /**
   * Object-query read across indexes (unique point, composite, or driver path).
   *
   * @remarks
   * Unique-only queries resolve one row via point lookups; a single
   * non-point composite takes the native cursor path; otherwise the most
   * selective non-unique index drives a fetch-and-verify scan. Return shape
   * follows key uniqueness: unique-only → single row, any non-unique key →
   * array.
   *
   * @param state - Sub-DB state.
   * @param query - Index name to value map (non-empty).
   * @param tx - Read transaction to pin, if any.
   * @param options - Optional `{limit}` cap.
   * @returns The matched row(s), or `undefined`/`[]` on no match.
   * @throws {LmdbError} On empty queries or multiple composite keys.
   */
  private async _findByIndex(state: LmdbSubState, query: Record<string, ILmdbKey>, tx?: LmdbTransaction, options?: {limit?: number}): Promise<unknown> {
    const closed = this._rejectClosed()
    if (closed) return closed as Promise<unknown>
    const entries = Object.entries(query) as Array<[string, ILmdbKey]>
    if (entries.length === 0) {
      throw new LmdbError(`findByIndex requires at least one index key`)
    }
    const {uniquePk, uniqueMiss, hasNonUnique, nonUniques} = this._resolveUniquePk(state, entries, tx)
    const empty = hasNonUnique ? [] : undefined
    if (uniqueMiss) return empty
    const limit = typeof options?.limit === `number` && Number.isFinite(options.limit) ? options.limit : undefined
    if (limit !== undefined && limit <= 0) return empty

    // Composite path: at most one composite key per query (v1 boundary —
    // intersect multiple composites client-side). Point tuples ride the
    // standard driver machinery below; prefix/range seeks take the native
    // cursor path with no full scan.
    const compositeEntries = nonUniques.filter((entry) => entry.composite !== undefined)
    if (compositeEntries.length > 1) {
      throw new LmdbError(`findByIndex accepts at most one composite key per query — received ${compositeEntries.length}. Query each composite separately and intersect.`)
    }
    const compositeEntry = compositeEntries[0]
    if (compositeEntry?.composite !== undefined && compositeEntry.composite.kind !== `point`) {
      return this._filterCompositeRange(state, compositeEntry.idx, compositeEntry.composite, nonUniques, uniquePk, limit, tx)
    }

    // Single-pk path: a unique index constrained the answer to one row.
    if (uniquePk !== undefined) {
      const v = this._get(state, uniquePk, tx)
      if (v === undefined) return empty
      for (const {idx, value} of nonUniques) {
        if (!Helper.sameIndexValue(idx.extractor(v), value)) return empty
      }
      return hasNonUnique ? [v] : v
    }

    const driver = this._scanNonUnique(nonUniques, tx)
    if (driver === undefined) return []
    return this._filterAndLimit(state, driver, nonUniques, limit, tx)
  }

  /**
   * Parse a composite query value into point, prefix, or range form.
   *
   * @param idx - The composite index descriptor (carries arity).
   * @param name - Query key for error messages.
   * @param value - Tuple (full for point, short for prefix) or `{start, end}` bounds.
   * @returns The parsed query.
   * @throws {LmdbError} On empty/over-arity tuples or malformed bounds.
   */
  private _parseCompositeQuery(idx: IndexDescriptor, name: string, value: unknown): IParsedCompositeQuery {
    const arity = idx.composite!.length
    const prefix = `findByIndex composite key '${name}'`
    if (Array.isArray(value)) {
      if (value.length === 0) throw new LmdbError(`${prefix}: tuple must not be empty — pass 1..${arity} elements for point/prefix seeks`)
      if (value.length > arity) throw new LmdbError(`${prefix}: tuple has ${value.length} elements but the composite has arity ${arity}`)
      return {kind: value.length === arity ? `point` : `prefix`, tuple: value as Array<ILmdbKey>}
    }
    if (value !== null && typeof value === `object`) {
      const bounds = value as {start?: unknown; end?: unknown}
      const check = (label: `start` | `end`, bound: unknown): Array<ILmdbKey> | undefined => {
        if (bound === undefined) return undefined
        if (!Array.isArray(bound) || bound.length === 0 || bound.length > arity) throw new LmdbError(`${prefix}: ${label} must be a tuple of 1..${arity} elements`)
        return bound as Array<ILmdbKey>
      }
      const start = check(`start`, bounds.start)
      const end = check(`end`, bounds.end)
      if (start === undefined && end === undefined) throw new LmdbError(`${prefix}: range needs {start} and/or {end} tuples`)
      return {kind: `range`, start, end}
    }
    throw new LmdbError(`${prefix}: expected a tuple of 1..${arity} elements or a {start, end} range`)
  }

  /**
   * Single-pass partition of query keys into unique and non-unique buckets.
   *
   * @remarks
   * Validates each key, resolves its index, runs O(1) unique point lookups
   * (contradictions across unique keys mark a miss), and collects
   * non-unique keys with parsed composites.
   *
   * @param state - Sub-DB state.
   * @param entries - Query `[name, value]` pairs.
   * @param tx - Read transaction to pin, if any.
   * @returns The partition: constrained pk, miss flag, and non-unique list.
   * @throws {LmdbError} On `null`/`undefined` values or unknown indexes.
   */
  private _resolveUniquePk(state: LmdbSubState, entries: Array<[string, ILmdbKey]>, tx?: LmdbTransaction): {uniquePk: ILmdbKey | undefined; uniqueMiss: boolean; hasNonUnique: boolean; nonUniques: Array<{idx: IndexDescriptor; value: ILmdbKey; composite?: IParsedCompositeQuery}>} {
    // Single pass: validate, resolve each index, run O(1) unique point lookups
    // and partition non-unique keys in ONE loop (no separate map/every/filter).
    let uniquePk: ILmdbKey | undefined
    let uniqueMiss = false
    let hasNonUnique = false
    const nonUniques: Array<{idx: IndexDescriptor; value: ILmdbKey; composite?: IParsedCompositeQuery}> = []
    for (const [name, value] of entries) {
      if (value === null || value === undefined) {
        throw new LmdbError(`findByIndex query key '${name}' has null/undefined value — an indexed value cannot be null/undefined`)
      }
      const idx = this._findIndex(state, name)
      if (idx.unique) {
        const pk = this._get(idx.state, value, tx) as ILmdbKey | undefined
        if (pk === undefined || (uniquePk !== undefined && !Helper.sameIndexValue(pk, uniquePk))) {
          uniqueMiss = true
        } else {
          uniquePk = pk
        }
      } else {
        hasNonUnique = true
        const parsed = idx.composite !== undefined ? this._parseCompositeQuery(idx, name, value) : undefined
        nonUniques.push(parsed === undefined ? {idx, value} : {idx, value, composite: parsed})
      }
    }
    return {uniquePk, uniqueMiss, hasNonUnique, nonUniques}
  }

  /**
   * Pick the most selective non-unique index as the scan driver.
   *
   * @remarks
   * A single key needs no count walk — it drives as-is. Otherwise the index
   * with the fewest native pks wins (O(1) counts each).
   *
   * @param nonUniques - Non-unique query keys.
   * @param tx - Read transaction to pin, if any.
   * @returns The driver key, or `undefined` when every key is empty.
   */
  private _scanNonUnique(nonUniques: Array<{idx: IndexDescriptor; value: ILmdbKey}>, tx?: LmdbTransaction): {idx: IndexDescriptor; value: ILmdbKey} | undefined {
    // Non-unique path: pick the MOST SELECTIVE index (fewest pks, O(1) native
    // count) as driver, then fetch + verify candidates in one combined loop.
    // A single non-unique key needs no count walk — it is the driver as-is.
    let driver: {idx: IndexDescriptor; value: ILmdbKey} | undefined
    if (nonUniques.length === 1) {
      driver = nonUniques[0]
    } else {
      let driverCount = Infinity
      for (const {idx, value} of nonUniques) {
        const count = this._getValuesCount(idx.state, value, tx)
        if (count > 0 && count < driverCount) {
          driver = {idx, value}
          driverCount = count
        }
      }
    }
    return driver
  }

  /**
   * Fetch the driver's candidates, verify the remaining keys, apply the limit.
   *
   * @remarks
   * Snapshot-pinned reads fetch point by point; unpinned reads batch via one
   * native `getMany` with identical decode/TTL/filter semantics.
   *
   * @param state - Sub-DB state.
   * @param driver - The driving index key.
   * @param nonUniques - All non-unique query keys (driver skipped in verify).
   * @param limit - Maximum rows to return, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns The matched rows.
   */
  private async _filterAndLimit(state: LmdbSubState, driver: {idx: IndexDescriptor; value: ILmdbKey}, nonUniques: Array<{idx: IndexDescriptor; value: ILmdbKey}>, limit: number | undefined, tx?: LmdbTransaction): Promise<unknown[]> {
    const filtered: unknown[] = []
    if (limit === undefined) {
      const pks = (await this._getValues(driver.idx.state, driver.value, tx)) as ILmdbKey[]
      if (tx?.raw) {
        for (const pk of pks) {
          const v = this._get(state, pk, tx)
          if (v === undefined) continue
          let keep = true
          for (const {idx, value} of nonUniques) {
            if (idx === driver.idx) continue
            if (!Helper.sameIndexValue(idx.extractor(v), value)) {
              keep = false
              break
            }
          }
          if (keep) filtered.push(v)
        }
        return filtered
      }
      // No snapshot pin: one native batch (prefetch + sync gets) instead of N
      // sequential point reads, with _get-identical decode/TTL/filter semantics.
      const raws = (await state.env.getMany(pks)) as Array<unknown>
      for (let i = 0; i < pks.length; i++) {
        const raw = raws[i]
        if (raw === undefined) continue
        const decoded = state.codec ? state.hookBeforeRead(raw) : raw
        let v: unknown
        if (state.isTtl) {
          const envelope = decoded as {v: unknown; exp?: number} | undefined
          if (!envelope) continue
          if (envelope.exp !== undefined && Date.now() > envelope.exp) {
            void this._delete(state, pks[i]!)
            continue
          }
          v = envelope.v
        } else {
          v = decoded
        }
        let keep = true
        for (const {idx, value} of nonUniques) {
          if (idx === driver.idx) continue
          if (!Helper.sameIndexValue(idx.extractor(v), value)) {
            keep = false
            break
          }
        }
        if (keep) filtered.push(v)
      }
      return filtered
    }
    // Bounded path: page the driver in limit/offset chunks until `limit` rows
    // survive filtering (or the driver is exhausted) — memory stays flat.
    let offset = 0
    for (;;) {
      const need = limit - filtered.length
      if (need <= 0) break
      const chunk = (await this._getValues(driver.idx.state, driver.value, tx, {limit: need, offset})) as ILmdbKey[]
      if (chunk.length === 0) break
      offset += chunk.length
      if (tx?.raw) {
        for (const pk of chunk) {
          const v = this._get(state, pk, tx)
          if (v === undefined) continue
          if (filtered.length >= limit) break
          let keep = true
          for (const {idx, value} of nonUniques) {
            if (idx === driver.idx) continue
            if (!Helper.sameIndexValue(idx.extractor(v), value)) {
              keep = false
              break
            }
          }
          if (keep) filtered.push(v)
        }
      } else {
        const raws = (await state.env.getMany(chunk)) as Array<unknown>
        for (let i = 0; i < chunk.length; i++) {
          const raw = raws[i]
          if (raw === undefined) continue
          const decoded = state.codec ? state.hookBeforeRead(raw) : raw
          let v: unknown
          if (state.isTtl) {
            const envelope = decoded as {v: unknown; exp?: number} | undefined
            if (!envelope) continue
            if (envelope.exp !== undefined && Date.now() > envelope.exp) {
              void this._delete(state, chunk[i]!)
              continue
            }
            v = envelope.v
          } else {
            v = decoded
          }
          if (filtered.length >= limit) break
          let keep = true
          for (const {idx, value} of nonUniques) {
            if (idx === driver.idx) continue
            if (!Helper.sameIndexValue(idx.extractor(v), value)) {
              keep = false
              break
            }
          }
          if (keep) filtered.push(v)
        }
      }
      if (chunk.length < need) break
    }
    return filtered
  }

  /**
   * Scan composite keys natively (prefix walk or bounded range, no full scan).
   *
   * @remarks
   * Prefix seeks stop at the first non-matching key (prefix keys are
   * contiguous); explicit bounds ride the native range cursor.
   *
   * @param idx - The composite index descriptor.
   * @param parsed - Parsed prefix/range query.
   * @param tx - Read transaction to pin, if any.
   * @returns Matching primary keys.
   */
  private async _scanCompositeKeys(idx: IndexDescriptor, parsed: ICompositeRangeQuery, tx?: LmdbTransaction): Promise<ILmdbKey[]> {
    // Prefix seeks walk natively from the prefix and stop at the first
    // non-matching key (prefix keys are contiguous in lexicographic order);
    // explicit bounds ride the native range cursor. Either way no full scan.
    const bounds: {start?: ILmdbKey; end?: ILmdbKey} = parsed.kind === `prefix` ? {start: parsed.tuple} : {...(parsed.start !== undefined ? {start: parsed.start} : {}), ...(parsed.end !== undefined ? {end: parsed.end} : {})}
    const rangeOpts = {...bounds, ...(tx?.raw ? {transaction: tx.raw} : {})}
    const out: ILmdbKey[] = []
    for (const key of idx.state.env.getKeys(rangeOpts)) {
      const tuple = key
      if (parsed.kind === `prefix` && !Helper.tuplePrefixMatch(tuple, parsed.tuple)) break
      out.push(...((await this._getValues(idx.state, tuple, tx)) as ILmdbKey[]))
    }
    return out
  }

  /**
   * Resolve a composite range query: scan keys, then verify the rest.
   *
   * @param state - Sub-DB state.
   * @param compIdx - The composite index descriptor.
   * @param parsed - Parsed prefix/range query.
   * @param nonUniques - All non-unique query keys (composite excluded from verify).
   * @param uniquePk - Constrained pk from unique keys, if any.
   * @param limit - Maximum rows to return, if any.
   * @param tx - Read transaction to pin, if any.
   * @returns The matched rows.
   */
  private async _filterCompositeRange(
    state: LmdbSubState,
    compIdx: IndexDescriptor,
    parsed: ICompositeRangeQuery,
    nonUniques: Array<{idx: IndexDescriptor; value: ILmdbKey; composite?: IParsedCompositeQuery}>,
    uniquePk: ILmdbKey | undefined,
    limit: number | undefined,
    tx?: LmdbTransaction
  ): Promise<unknown[]> {
    const pks = await this._scanCompositeKeys(compIdx, parsed, tx)
    const others = nonUniques.filter((entry) => entry.idx !== compIdx)
    const matched: unknown[] = []
    for (const pk of pks) {
      if (uniquePk !== undefined && !Helper.sameIndexValue(pk, uniquePk)) continue
      const v = this._get(state, pk, tx)
      if (v === undefined) continue
      let keep = true
      for (const {idx, value} of others) {
        if (!Helper.sameIndexValue(idx.extractor(v), value)) {
          keep = false
          break
        }
      }
      if (keep) {
        matched.push(v)
        if (limit !== undefined && matched.length >= limit) break
      }
    }
    return matched
  }

  /**
   * Full-text search with AND semantics and per-column-hit ranking.
   *
   * @remarks
   * Terms AND across all searched columns; a hit in N columns scores N.
   * The stable sort keeps first-seen order on score ties (deterministic).
   *
   * @param state - Sub-DB state.
   * @param query - Raw query text.
   * @param options - Optional `{limit}` cap.
   * @returns Ranked primary keys.
   * @throws {LmdbError} On search-less subs or termless queries.
   */
  private async _search(state: LmdbSubState, query: string, options?: {limit?: number}): Promise<ILmdbKey[]> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (state.searchTables.length === 0) {
      throw new LmdbError(`sub '${state.dbName}' has no searchable columns — declare one with t.string().search().`)
    }
    const terms = [...new Set(LmdbSearch.tokenize(query))]
    if (terms.length === 0) {
      throw new LmdbError(`search query must contain at least one term.`)
    }
    const limit = typeof options?.limit === `number` && Number.isFinite(options.limit) ? options.limit : undefined
    if (limit !== undefined && limit <= 0) return []
    // Per-term union across searched columns — a hit in N columns scores N.
    // AND semantics: only keys matching every term survive. The sort is
    // stable, so score ties keep first-seen (native dup) order: deterministic.
    const scored = new Map<string, {pk: ILmdbKey; score: number; hits: number}>()
    for (const term of terms) {
      const seen = new Set<string>()
      for (const table of state.searchTables) {
        const pks = (await this._getValues(table.state, term)) as ILmdbKey[]
        for (const pk of pks) {
          const fp = LmdbSearch.fingerprintPk(pk)
          const entry = scored.get(fp)
          if (entry === undefined) scored.set(fp, {pk, score: 1, hits: 0})
          else entry.score++
          seen.add(fp)
        }
      }
      for (const fp of seen) {
        scored.get(fp)!.hits++
      }
    }
    const matched = [...scored.values()].filter((entry) => entry.hits === terms.length)
    matched.sort((a, b) => b.score - a.score)
    const capped = limit === undefined ? matched : matched.slice(0, limit)
    return capped.map((entry) => entry.pk)
  }

  /**
   * Delete expired TTL entries in 500-row transactions.
   *
   * @remarks
   * Scans raw ranges (no per-row resume cost), then deletes in chunks —
   * indexed subs via the indexed transaction (index rows cleaned from
   * captured envelopes), plain subs in single-txn batches. Non-TTL subs
   * return `0`.
   *
   * @param state - Sub-DB state.
   * @returns The number of removed entries.
   */
  private async _purgeExpired(state: LmdbSubState): Promise<number> {
    this._assertOpen()
    if (!state.isTtl) return 0
    // Raw range walk instead of the _iterate generator (no per-row resume,
    // tuple alloc, or destructure): collect expired keys, plus envelopes for
    // indexed subs only. Deletes still run after the scan completes.
    const now = Date.now()
    const wantValues = state.indexes.length > 0
    const noCodec = !state.codec
    const expiredKeys: ILmdbKey[] = []
    const expiredEnvelopes: Array<{v: unknown; exp?: number}> = []
    for (const e of state.env.getRange() as Iterable<{key: ILmdbKey; value: unknown}>) {
      const envelope = (noCodec ? e.value : state.hookBeforeRead(e.value)) as {v: unknown; exp?: number} | undefined
      if (envelope && envelope.exp !== undefined && now > envelope.exp) {
        expiredKeys.push(e.key)
        if (wantValues) expiredEnvelopes.push(envelope)
      }
    }
    if (expiredKeys.length === 0) return 0
    if (state.indexes.length > 0 || state.searchTables.length > 0) {
      const CHUNK = 500
      let removed = 0
      for (let i = 0; i < expiredKeys.length; i += CHUNK) {
        const end = Math.min(i + CHUNK, expiredKeys.length)
        await this._indexedTx(state, () => {
          for (let j = i; j < end; j++) {
            const k = expiredKeys[j]!
            const envelope = expiredEnvelopes[j]!
            for (const idx of state.indexes) {
              let idxVal: ILmdbKey | undefined | null
              try {
                idxVal = idx.extractor(envelope.v)
              } catch {
                idxVal = undefined
              }
              if (idxVal === undefined || idxVal === null) continue
              if (idx.unique) {
                const owner = this._get(idx.state, idxVal)
                if (owner === k) idx.state.env.removeSync(idxVal as never)
              } else {
                idx.state.env.removeSync(idxVal as never, k as never)
              }
            }
            state.env.removeSync(k as never)
            removed++
          }
        })
      }
      return removed
    }
    // Chunked single-txn batches: the speed of one transaction per key set
    // without an unbounded write txn on massive purges.
    const CHUNK = 500
    let removed = 0
    for (let i = 0; i < expiredKeys.length; i += CHUNK) {
      const end = Math.min(i + CHUNK, expiredKeys.length)
      await this.owner.transaction(() => {
        for (let j = i; j < end; j++) {
          if (state.env.removeSync(expiredKeys[j]!)) removed++
        }
      })
    }
    return removed
  }

  /**
   * Rebuild embedded indexes and search tables from primary data.
   *
   * @remarks
   * A name can address an embedded index, a searched column, or both;
   * unknown names throw via the index lookup. Unique collisions land in
   * `skipped` instead of failing the rebuild. Rebuilds run in 500-row
   * indexed transactions after clearing the targets.
   *
   * @param state - Sub-DB state.
   * @param name - Single index/column to rebuild, or all when omitted.
   * @returns `{built}` rows plus `{skipped}` unique collisions.
   * @throws {LmdbError} On unknown index names.
   */
  private _reindex(state: LmdbSubState, name?: string): Promise<{built: number; skipped: Array<{key: ILmdbKey; index: string; value: unknown}>}> {
    const closed = this._rejectClosed()
    if (closed) return closed
    // A name can address an embedded index, a searched column, or both (a
    // column carrying .index() + .search() shares the name) — rebuild each
    // side it names. Unknown names keep the existing _findIndex throw.
    const embedded = name === undefined ? state.indexes : state.indexes.filter((idx) => idx.name === name)
    const searchTargets = name === undefined ? state.searchTables : state.searchTables.filter((table) => table.column === name)
    if (name !== undefined && embedded.length === 0 && searchTargets.length === 0) {
      this._findIndex(state, name)
    }
    const targets = embedded
    const skipped: Array<{key: ILmdbKey; index: string; value: unknown}> = []
    let built = 0
    return Promise.all([...targets.map((t) => this._clear(t.state)), ...searchTargets.map((s) => this._clear(s.state))]).then(() => {
      const CHUNK = 500
      const entries: Array<[ILmdbKey, unknown]> = []
      const drain = (): Promise<void> => {
        if (entries.length === 0) return Promise.resolve()
        const chunk = entries.splice(0, CHUNK)
        return this._indexedTx(state, () => {
          for (const [k, v] of chunk) {
            const values = targets.map((t) => t.extractor(v))
            for (let i = 0; i < targets.length; i++) {
              const t = targets[i]!
              const val = values[i]
              if (val === undefined || val === null) continue
              if (t.unique) {
                const owner = this._get(t.state, val)
                if (owner !== undefined && owner !== k) {
                  skipped.push({key: k, index: t.name, value: val})
                  continue
                }
              }
              t.state.env.putSync(val as never, k as never)
              built++
            }
            for (const s of searchTargets) {
              const terms = this._searchTermsOf(v, s.column)
              built += terms.size
              this._putSearchTerms(s, k, terms, `sync`)
            }
          }
        })
      }
      return (async () => {
        for await (const [k, v] of this._iterate(state)) {
          entries.push([k, v])
          if (entries.length >= CHUNK) await drain()
        }
        await drain()
        return {built, skipped}
      })()
    })
  }

  // ── Sync reads ─────────────────────────────────────────────────

  /**
   * Read a value by key.
   *
   * @param key - The primary key.
   * @param tx - Optional active {@link LmdbTransaction} to read from (snapshot-pinned in `readTransaction`).
   * @returns The row value, or `undefined` when the key is absent. Synchronous.
   */
  get(key: KeyOf<S>, tx?: LmdbTransaction): ValueOf<S> | undefined {
    return this._get(this._state, key, tx) as ValueOf<S> | undefined
  }

  /**
   * Read a value by key, throwing when absent.
   *
   * @param key - The primary key.
   * @param tx - Optional active {@link LmdbTransaction} to read from.
   * @returns The row value.
   * @throws {LmdbError} When the key is absent.
   */
  getStrict(key: KeyOf<S>, tx?: LmdbTransaction): ValueOf<S> {
    return this._getStrict(this._state, key, tx) as ValueOf<S>
  }

  /**
   * Check whether a key exists.
   *
   * @param key - The primary key.
   * @param tx - Optional active {@link LmdbTransaction} to check against.
   * @returns `true` when the key exists. Synchronous.
   */
  has(key: KeyOf<S>, tx?: LmdbTransaction): boolean {
    return this._has(this._state, key, tx)
  }

  /**
   * Entry count.
   *
   * @param tx - Optional active {@link LmdbTransaction} to count within.
   * @returns The number of entries — O(1), synchronous.
   */
  count(tx?: LmdbTransaction): number {
    return this._count(this._state, tx)
  }

  // ── Writes ─────────────────────────────────────────────────────

  /**
   * Write a value.
   *
   * @param key - The primary key.
   * @param value - The row value to store.
   * @param ttlOrTx - Optional TTL (`number` ms or `{ttlMs}`) or an active {@link LmdbTransaction}.
   * @returns Resolves when the queued put is flushed.
   */
  put(key: KeyOf<S>, value: ValueOf<S>, ttlOrTx?: number | {ttlMs: number} | LmdbTransaction): Promise<void> {
    const isTx = ttlOrTx instanceof LmdbTransaction
    return this._put(this._state, key, value, isTx ? ttlOrTx : undefined, isTx ? undefined : ttlOrTx)
  }

  /**
   * Delete a key.
   *
   * @param key - The primary key.
   * @param tx - Optional active {@link LmdbTransaction} to delete within.
   * @returns Resolves to `true` when the key existed and was removed.
   */
  delete(key: KeyOf<S>, tx?: LmdbTransaction): Promise<boolean> {
    return this._delete(this._state, key, tx)
  }

  /**
   * Clear the sub.
   *
   * @param tx - Optional active {@link LmdbTransaction} to clear within.
   * @returns Resolves when the sub is emptied.
   */
  clear(tx?: LmdbTransaction): Promise<void> {
    return this._clear(this._state, tx)
  }

  /**
   * Drop the sub-DB.
   *
   * @returns Resolves when the sub-DB is dropped.
   */
  drop(): Promise<void> {
    return this._drop(this._state)
  }

  /**
   * Synchronous put — use inside a transaction callback.
   *
   * @param key - The primary key.
   * @param value - The row value to store.
   */
  putSync(key: KeyOf<S>, value: ValueOf<S>): void {
    this._putSync(this._state, key, value)
  }

  /**
   * Synchronous delete — use inside a transaction callback.
   *
   * @param key - The primary key.
   * @returns `true` when the key existed and was removed.
   */
  removeSync(key: KeyOf<S>): boolean {
    return this._removeSync(this._state, key)
  }

  /**
   * Write many entries.
   *
   * @remarks
   * Pass `{sorted: true}` when entries ascend by key (strictly, or
   * non-decreasing for dupSort primaries) to skip the B-tree search per put
   * (MDB_APPEND) — the first inversion aborts with `LmdbError`.
   * `onProgress` fires per committed chunk as `(done, total)`.
   *
   * @param entries - `[key, value]` pairs to write.
   * @param chunkSize - Entries per transaction chunk (default `500`).
   * @param options - `{sorted?, onProgress?}`.
   * @returns Resolves when all chunks are committed.
   * @throws {LmdbError} On the first out-of-order key when sorted.
   */
  putMany(entries: [KeyOf<S>, ValueOf<S>][], chunkSize?: number, options?: {sorted?: boolean; onProgress?: (done: number, total: number) => void}): Promise<void> {
    return this._putMany(this._state, entries as Array<[ILmdbKey, unknown]>, chunkSize, options)
  }

  /**
   * Read many keys.
   *
   * @param keys - The primary keys to read.
   * @returns Values aligned with `keys` — `undefined` for absent keys.
   */
  getMany(keys: KeyOf<S>[]): Promise<(ValueOf<S> | undefined)[]> {
    return this._getMany(this._state, keys) as Promise<(ValueOf<S> | undefined)[]>
  }

  /**
   * Page-fault keys into the read cache.
   *
   * @param keys - The primary keys to prefetch.
   * @returns Resolves when the pages are loaded.
   */
  prefetch(keys: KeyOf<S>[]): Promise<void> {
    return this._prefetch(this._state, keys)
  }

  // ── Range queries ──────────────────────────────────────────────

  /**
   * Materialize all keys.
   *
   * @param options - Range bounds (`start`/`end`), `limit`, `reverse`.
   * @param tx - Optional active {@link LmdbTransaction} to scan within.
   * @returns All keys in the range — guarded by {@link MAX_MATERIALIZE}.
   */
  keys(options?: IRangeOptions, tx?: LmdbTransaction): Promise<KeyOf<S>[]> {
    return this._keys(this._state, options, tx) as Promise<KeyOf<S>[]>
  }

  /**
   * Materialize all values.
   *
   * @param options - Range bounds (`start`/`end`), `limit`, `reverse`.
   * @param tx - Optional active {@link LmdbTransaction} to scan within.
   * @returns All values in the range — guarded by {@link MAX_MATERIALIZE}.
   */
  values(options?: IRangeOptions, tx?: LmdbTransaction): Promise<ValueOf<S>[]> {
    return this._values(this._state, options, tx) as Promise<ValueOf<S>[]>
  }

  /**
   * Materialize all entries.
   *
   * @param options - Range bounds (`start`/`end`), `limit`, `reverse`.
   * @param tx - Optional active {@link LmdbTransaction} to scan within.
   * @returns All `[key, value]` pairs in the range — guarded by {@link MAX_MATERIALIZE}.
   */
  entries(options?: IRangeOptions, tx?: LmdbTransaction): Promise<[KeyOf<S>, ValueOf<S>][]> {
    return this._entries(this._state, options, tx) as Promise<[KeyOf<S>, ValueOf<S>][]>
  }

  /**
   * Lazy async iteration.
   *
   * @param options - Range bounds (`start`/`end`), `limit`, `reverse`.
   * @param tx - Optional active {@link LmdbTransaction} to iterate within.
   * @returns An async generator yielding `[key, value]` — never materialization-guarded.
   */
  iterate(options?: IRangeOptions, tx?: LmdbTransaction): AsyncIterableIterator<[KeyOf<S>, ValueOf<S>]> {
    return this._iterate(this._state, options, tx) as AsyncIterableIterator<[KeyOf<S>, ValueOf<S>]>
  }

  /**
   * Glob-pattern scan.
   *
   * @param pattern - Glob pattern (`*` wildcards); prefix shapes become bounded range scans.
   * @param options - Range bounds and `limit`.
   * @param tx - Optional active {@link LmdbTransaction} to scan within.
   * @returns Matching `[key, value]` pairs.
   */
  like(pattern: string, options?: IRangeOptions, tx?: LmdbTransaction): Promise<[KeyOf<S>, ValueOf<S>][]> {
    return this._like(this._state, pattern, options, tx) as Promise<[KeyOf<S>, ValueOf<S>][]>
  }

  /**
   * Prefix scan.
   *
   * @param prefix - Inclusive lower bound; the exclusive upper bound is derived.
   * @param options - Range bounds and `limit`.
   * @param tx - Optional active {@link LmdbTransaction} to scan within.
   * @returns `[key, value]` pairs whose key starts with `prefix`.
   */
  findByPrefix(prefix: KeyOf<S>, options?: IRangeOptions, tx?: LmdbTransaction): Promise<[KeyOf<S>, ValueOf<S>][]> {
    return this._findByPrefix(this._state, prefix, options, tx) as Promise<[KeyOf<S>, ValueOf<S>][]>
  }

  /**
   * Count entries under a prefix.
   *
   * @param prefix - The prefix to count.
   * @returns The number of matching entries.
   */
  countByPrefix(prefix: KeyOf<S>): Promise<number> {
    return this._countByPrefix(this._state, prefix)
  }

  /**
   * Delete entries under a prefix.
   *
   * @param prefix - The prefix to delete.
   * @returns The number of deleted entries.
   * @throws {LmdbError} When `prefix` is empty — use {@link clear} instead.
   */
  deleteByPrefix(prefix: KeyOf<S>): Promise<number> {
    return this._deleteByPrefix(this._state, prefix)
  }

  /**
   * First entry (lowest key).
   *
   * @param tx - Optional active {@link LmdbTransaction} to read from.
   * @returns The `[key, value]` pair with the lowest key, or `undefined` when empty.
   */
  first(tx?: LmdbTransaction): Promise<[KeyOf<S>, ValueOf<S>] | undefined> {
    return this._first(this._state, tx) as Promise<[KeyOf<S>, ValueOf<S>] | undefined>
  }

  /**
   * Last entry (highest key).
   *
   * @param tx - Optional active {@link LmdbTransaction} to read from.
   * @returns The `[key, value]` pair with the highest key, or `undefined` when empty.
   */
  last(tx?: LmdbTransaction): Promise<[KeyOf<S>, ValueOf<S>] | undefined> {
    return this._last(this._state, tx) as Promise<[KeyOf<S>, ValueOf<S>] | undefined>
  }

  /**
   * Synchronous key iteration — use inside a transaction callback.
   *
   * @param options - Range bounds (`start`/`end`), `limit`, `reverse`.
   * @returns A synchronous iterable of keys (cursor-backed).
   */
  getKeys(options?: IRangeOptions): Iterable<KeyOf<S>> {
    return this._getKeys(this._state, options) as Iterable<KeyOf<S>>
  }

  // ── Conditional / atomic ───────────────────────────────────────

  /**
   * Insert only when the key is absent.
   *
   * @param key - The primary key.
   * @param value - The row value to insert.
   * @returns Resolves to `true` when inserted, `false` when the key already exists.
   */
  putIfNotExists(key: KeyOf<S>, value: ValueOf<S>): Promise<boolean> {
    return this._putIfNotExists(this._state, key, value)
  }

  /**
   * Atomic increment.
   *
   * @param key - The primary key.
   * @param delta - Increment amount (default `1`).
   * @returns The new value; absent keys start at `0`.
   */
  increment(key: KeyOf<S>, delta = 1): Promise<number> {
    return this._increment(this._state, key, delta)
  }

  /**
   * Atomic decrement.
   *
   * @param key - The primary key.
   * @param amount - Decrement amount (default `1`).
   * @returns The new value; absent keys start at `0`.
   */
  decrement(key: KeyOf<S>, amount = 1): Promise<number> {
    return this._decrement(this._state, key, amount)
  }

  // ── dupSort ────────────────────────────────────────────────────

  /**
   * Append a duplicate value under a key.
   *
   * @param key - The primary key.
   * @param value - The duplicate value to append (requires a `dupSort` sub).
   * @returns Resolves boolean.
   */
  addValue(key: KeyOf<S>, value: ValueOf<S>): Promise<boolean> {
    return this._addValue(this._state, key, value)
  }

  /**
   * All duplicate values under a key.
   *
   * @param key - The primary key.
   * @returns The ordered duplicate values.
   */
  getValues(key: KeyOf<S>): Promise<ValueOf<S>[]> {
    return this._getValues(this._state, key) as Promise<ValueOf<S>[]>
  }

  /**
   * Count of duplicate values under a key.
   *
   * @param key - The primary key.
   * @returns The number of duplicates. Synchronous.
   */
  getValuesCount(key: KeyOf<S>): number {
    return this._getValuesCount(this._state, key)
  }

  /**
   * Remove one duplicate value under a key.
   *
   * @param key - The primary key.
   * @param value - The duplicate value to remove.
   * @returns Resolves to `true` when the value was removed.
   */
  removeValue(key: KeyOf<S>, value: ValueOf<S>): Promise<boolean> {
    return this._removeValue(this._state, key, value)
  }

  // ── Binary ─────────────────────────────────────────────────────

  /**
   * Write raw bytes, bypassing the value encoder.
   *
   * @param key - The primary key.
   * @param value - The raw bytes to store.
   * @returns Boolean resolves when the bytes are written.
   */
  putBinary(key: KeyOf<S>, value: Buffer | Uint8Array): Promise<boolean> {
    return this._putBinary(this._state, key, value)
  }

  /**
   * Read raw bytes.
   *
   * @param key - The primary key.
   * @returns The stored bytes, or `undefined` when absent.
   */
  getBinary(key: KeyOf<S>): Buffer | undefined {
    return this._getBinary(this._state, key)
  }

  /**
   * Read raw bytes synchronously.
   *
   * @param key - The primary key.
   * @returns The stored bytes, or `undefined` when absent. No async wrapper.
   */
  getBinaryFast(key: KeyOf<S>): Buffer | undefined {
    return this._getBinaryFast(this._state, key)
  }

  // ── JSONL export/import ────────────────────────────────────────

  /**
   * Export all entries as JSON Lines.
   *
   * @returns A JSONL string of `[key, value]` pairs.
   */
  exportJSONL(): Promise<string> {
    return this._exportJSONL(this._state)
  }

  /**
   * Import JSON Lines.
   *
   * @param jsonl - JSONL string of `[key, value]` pairs.
   * @param options - `{sorted?, onProgress?}` (see {@link LmdbEnvSub.putMany}).
   * @returns The number of imported entries.
   */
  importJSONL(jsonl: string, options?: {sorted?: boolean; onProgress?: (done: number, total: number) => void}): Promise<number> {
    return this._importJSONL(this._state, jsonl, options)
  }

  // ── Embedded indexes ───────────────────────────────────────────

  /**
   * Object-query index read.
   *
   * @param query - Map of declared index names to values; every key is ANDed.
   * @param tx - Optional active {@link LmdbTransaction} to read within — keeps every point read of the query on the same snapshot.
   * @param options - Optional `{limit}` capping the final matched rows (lazy chunk fetch, flat memory; unbounded by default).
   * @returns The row when all queried keys are unique, `T[]` when any is non-unique, `undefined`/`[]` on no match.
   */
  findByIndex<Q extends IIndexQuery<ValueOf<S>, ISchemaIndexesOf<S[`value`]>>>(query: Q, tx?: LmdbTransaction, options?: {limit?: number}): Promise<IIndexResult<ValueOf<S>, ISchemaIndexesOf<S[`value`]>, Q>> {
    return this._findByIndex(this._state, query as Record<string, ILmdbKey>, tx, options) as Promise<IIndexResult<ValueOf<S>, ISchemaIndexesOf<S[`value`]>, Q>>
  }

  /**
   * Full-text search over `t.string().search()` columns.
   *
   * @remarks
   * Tokenizes the query (lowercase + split) and ANDs the terms: only rows
   * containing every term match. A match in N searched columns scores N, so
   * rows matching in more columns rank first; ties keep native key order.
   *
   * @param query - Raw query text (at least one term required).
   * @param options - `{limit}` caps the returned keys with flat memory.
   * @returns Matching primary keys, best first.
   * @throws {LmdbError} On empty queries or subs without searchable columns.
   * @public
   */
  search(query: string, options?: {limit?: number}): Promise<KeyOf<S>[]> {
    return this._search(this._state, query, options) as Promise<KeyOf<S>[]>
  }

  /**
   * Rebuild the schema's embedded indexes from primary data.
   *
   * @param name - Rebuild a single index by name; omit to rebuild all.
   * @returns `{built, skipped}` — `skipped` lists unique-conflict records that could not be indexed.
   */
  reindex(name?: string): Promise<{built: number; skipped: Array<{key: KeyOf<S>; index: string; value: unknown}>}> {
    return this._reindex(this._state, name) as Promise<{built: number; skipped: Array<{key: KeyOf<S>; index: string; value: unknown}>}>
  }

  /**
   * Differentially copy this sub to a destination sub (any env, same schema).
   *
   * @remarks
   * Copies rows past the checkpoint (explicit option or the persisted cursor
   * for `name`, defaulting to the destination db) through a keyset cursor in
   * 500-row chunks; each committed chunk advances the cursor, so kills
   * resume mid-stream. An explicit `checkpoint` runs one-shot without
   * touching the stored cursor. Sync upserts — destination-only rows are
   * never deleted. Quiesce writes on both subs first: the verify step
   * (counts plus hash spot-checks, on by default) throws `LmdbError`
   * on divergence.
   *
   * @param dest - Destination handle (same schema class, must differ).
   * @param options - `{name?, checkpoint?, limit?, verify?}`.
   * @returns `{copied, checkpoint, verified}`.
   * @throws {LmdbError} On self-sync and verify divergence.
   * @public
   */
  syncTo(dest: LmdbEnvSub<S>, options?: ISyncOptions<S>): Promise<ISyncResult<S>> {
    return new LmdbSyncStream(this, dest, options).run()
  }

  // ── TTL ────────────────────────────────────────────────────────

  /**
   * Remove expired entries.
   *
   * @returns The number of purged entries (TTL subs only).
   */
  purgeExpired(): Promise<number> {
    return this._purgeExpired(this._state)
  }

  // ── Entry / versions ───────────────────────────────────────────

  /**
   * Raw entry with version.
   *
   * @param key - The primary key.
   * @returns `{version, value}` for optimistic-locking reads, or `undefined` when absent.
   */
  getEntry(key: KeyOf<S>): {version: number; value: ValueOf<S>} | undefined {
    return this._getEntry(this._state, key) as {version: number; value: ValueOf<S>} | undefined
  }

  // ── Types ──────────────────────────────────────────────────────

  /**
   * The schema class this handle binds.
   *
   * @returns The registered schema class.
   */
  get schemaClass(): S {
    return this._schema
  }

  /**
   * The schema's key type.
   *
   * @returns The key type for annotations (type-level only).
   */
  get keyType(): KeyOf<S> {
    return undefined as unknown as KeyOf<S>
  }

  /**
   * The schema's value type.
   *
   * @returns The row type for annotations (type-level only).
   */
  get valueType(): ValueOf<S> {
    return undefined as unknown as ValueOf<S>
  }

  /**
   * Internal key type used by the env's raw overloads.
   *
   * @returns The key type (type-level only).
   */
  get key(): ILmdbKey {
    return undefined as unknown as ILmdbKey
  }
}
