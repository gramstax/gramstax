import {asBinary, type GetOptions, type Key, type RangeOptions} from "lmdb"
import type {LmdbEnv} from "./env"
import {LmdbEmptyPrefixError, LmdbEnvClosedError, LmdbEnvNotOpenError, LmdbError, LmdbKeyNotFoundError, LmdbLikePatternError, LmdbMaterializationError, LmdbReadOnlyError, LmdbTransactionDoneError, LmdbTransactionError, LmdbUniqueConstraintError} from "./errors"
import type {KeyOf, LmdbSchema, SchemaIndexesOf, ValueOf} from "./schema"
import {LmdbTransaction} from "./transaction"
import type {IIndexQuery, IIndexResult, ILmdbKey, IndexDescriptor, IRangeOptions, LmdbSubState} from "./types"
import {MAX_MATERIALIZE} from "./types"

function sameIndexValue(a: ILmdbKey | undefined | null, b: ILmdbKey): boolean {
  if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) return a.equals(b)
  return a === b
}

function globMatch(key: string, pattern: string): boolean {
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
   * @param owner - The env that registered this sub.
   * @param schema - The registered schema class.
   * @param state - Pre-built sub-DB state (owned by the env's sub manager).
   */
  constructor(
    private readonly _owner: LmdbEnv,
    private readonly schema: S,
    private readonly _state: LmdbSubState
  ) {}

  /**
   * The sub-DB name (the schema's `static db`).
   *
   * @returns The registered sub-DB name.
   */
  get dbName(): string {
    return this.schema.db
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

  private _assertOpen(): void {
    if (this.owner.state === `closed`) throw new LmdbEnvClosedError()
    if (this.owner.state !== `open`) throw new LmdbEnvNotOpenError()
  }

  private _rejectClosed(): Promise<never> | null {
    try {
      this._assertOpen()
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  private _rejectBadTx(tx: LmdbTransaction | undefined): Promise<never> | null {
    if (!tx) return null
    if (tx.done) {
      return Promise.reject(new LmdbTransactionDoneError())
    }
    let txnId: number
    try {
      txnId = this.owner.getWriteTxnId()
    } catch {
      txnId = 0
    }
    if (!txnId) {
      return Promise.reject(new LmdbTransactionError(`A transaction was passed to a write operation but no write transaction is active. Wrap the write in env.transaction() and pass the same tx.`))
    }
    return null
  }

  private _readOpts(tx?: LmdbTransaction): GetOptions | undefined {
    if (tx?.raw) {
      return {transaction: tx.raw}
    }
    return undefined
  }

  private _rangeOpts(options: IRangeOptions | undefined, tx?: LmdbTransaction): RangeOptions | undefined {
    return tx?.raw ? {...options, transaction: tx.raw} : options
  }

  private _readValue(state: LmdbSubState, raw: unknown): unknown {
    return state.hookBeforeRead(raw)
  }

  private _probeKeyType(state: LmdbSubState): `string` | `buffer` | `number` | `empty` {
    if (state.keyType) return state.keyType
    for (const k of state.env.getKeys({limit: 1})) {
      state.keyType = Buffer.isBuffer(k) ? `buffer` : typeof k === `string` ? `string` : `number`
      return state.keyType
    }
    state.keyType = `empty`
    return state.keyType
  }

  private _stringBoundsValid(state: LmdbSubState, prefix: ILmdbKey): boolean {
    const type = this._probeKeyType(state)
    if (type === `empty`) return true
    if (typeof prefix === `string`) return type === `string`
    if (Buffer.isBuffer(prefix)) return type === `buffer`
    return false
  }

  private _isEmptyPrefix(prefix: ILmdbKey): boolean {
    return (typeof prefix === `string` && prefix.length === 0) || (Buffer.isBuffer(prefix) && prefix.length === 0)
  }

  private _keysAreStrings(state: LmdbSubState): boolean {
    const type = this._probeKeyType(state)
    return type === `string` || type === `empty`
  }

  private _extractPrefixLikePattern(pattern: string): string | null {
    if (!pattern.endsWith(`*`)) return null
    if (pattern.indexOf(`?`) !== -1) return null
    if (pattern.indexOf(`*`) !== pattern.length - 1) return null
    return pattern.slice(0, -1)
  }

  private _prefixEnd(prefix: ILmdbKey): ILmdbKey | undefined {
    if (typeof prefix === `string`) {
      return `${prefix}￿` as ILmdbKey
    }
    if (Buffer.isBuffer(prefix)) {
      return Buffer.concat([prefix, Buffer.from([0xff])]) as unknown as ILmdbKey
    }
    return undefined
  }

  private _inferRangeFromPrefix(pattern: string): {start: ILmdbKey; end: ILmdbKey} | null {
    if (pattern.length === 0) return null
    let anchor = ``
    for (const ch of pattern) {
      if (ch === `*` || ch === `?`) break
      anchor += ch
    }
    if (anchor.length === 0) return null
    const end = this._prefixEnd(anchor as ILmdbKey)
    if (end === undefined) return null
    return {start: anchor as ILmdbKey, end}
  }

  private _assertDupSort(state: LmdbSubState, op: string): void {
    if (!state.opts.dupSort) {
      throw new LmdbError(`Sub '${state.dbName}' is not dupSort. Open it with dupSort: true in the constructor opts to use ${op}.`)
    }
  }

  private _assertMaterialize(state: LmdbSubState, op: string, options?: IRangeOptions): void {
    const max = MAX_MATERIALIZE
    const limit = options?.limit
    if (limit !== undefined) {
      if (limit > max) {
        throw new LmdbMaterializationError(op, max, limit)
      }
      return
    }
    if (this._count(state) > max) {
      throw new LmdbMaterializationError(op, max)
    }
  }

  private _assertMaterializeCount(op: string, count: number): void {
    const max = MAX_MATERIALIZE
    if (count > max) {
      throw new LmdbMaterializationError(op, max)
    }
  }

  private _rejectMaterialize(state: LmdbSubState, op: string, options?: IRangeOptions): Promise<never> | null {
    try {
      this._assertMaterialize(state, op, options)
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  private _rejectMaterializeCount(op: string, count: number): Promise<never> | null {
    try {
      this._assertMaterializeCount(op, count)
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  private _rejectIfNotDupSort(state: LmdbSubState, op: string): Promise<never> | null {
    try {
      this._assertDupSort(state, op)
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  private _findIndex(state: LmdbSubState, name: string): IndexDescriptor {
    const idx = state.indexByName.get(name)
    if (!idx) throw new LmdbError(`Unknown index '${name}' on sub ${state.dbName}. Declared indexes: ${state.indexes.map((e) => e.name).join(`, `) || `none`}`)
    return idx
  }

  private _computeIndexValues(state: LmdbSubState, value: unknown): Array<ILmdbKey | undefined | null> {
    return state.indexes.map((idx) => idx.extractor(value))
  }

  private _peek(state: LmdbSubState, key: ILmdbKey): unknown | undefined {
    this._assertOpen()
    const raw = state.env.get(key)
    if (raw === undefined) return undefined
    const decoded = state.codec ? this._readValue(state, raw) : raw
    if (state.isTtl) {
      const envelope = decoded as {v: unknown; exp?: number} | undefined
      return envelope?.v
    }
    return decoded
  }

  private _get(state: LmdbSubState, key: ILmdbKey, _tx?: LmdbTransaction): unknown | undefined {
    this._assertOpen()
    const opts = this._readOpts(_tx)
    const raw = opts ? state.env.get(key, opts) : state.env.get(key)
    if (raw === undefined) return undefined
    const decoded = state.codec ? this._readValue(state, raw) : raw
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

  private _getStrict(state: LmdbSubState, key: ILmdbKey, _tx?: LmdbTransaction): unknown {
    const value = this._get(state, key, _tx)
    if (value === undefined) {
      throw new LmdbKeyNotFoundError(state.dbName, key)
    }
    return value
  }

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

  private _delete(state: LmdbSubState, key: ILmdbKey, tx?: LmdbTransaction): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`delete`))
    const txErr = this._rejectBadTx(tx)
    if (txErr) return txErr
    if (state.indexes.length > 0) {
      return this._indexedTx(state, () => {
        const existing = this._peek(state, key)
        if (existing === undefined && !state.env.doesExist(key)) return false
        this._deleteIndexedSync(state, key, existing)
        return true
      })
    }
    if (!state.env.doesExist(key)) return Promise.resolve(false)
    return state.env.remove(key).then(() => true)
  }

  private _clear(state: LmdbSubState, tx?: LmdbTransaction): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`clear`))
    const txErr = this._rejectBadTx(tx)
    if (txErr) return txErr
    if (state.indexes.length > 0) {
      return Promise.all(state.indexes.map((idx) => this._clear(idx.state))).then(() => state.env.clearAsync())
    }
    return state.env.clearAsync()
  }

  private _drop(state: LmdbSubState): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`drop`))
    return state.env.drop()
  }

  private _prefetch(state: LmdbSubState, keys: ILmdbKey[]): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    return state.env.prefetch(keys).then(() => undefined as undefined)
  }

  private _getMany(state: LmdbSubState, keys: ILmdbKey[]): Promise<Array<unknown | undefined>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const raws = state.env.getMany(keys) as Promise<Array<unknown>>
    if (!state.codec) return raws as Promise<Array<unknown | undefined>>
    return raws.then((arr) => arr.map((raw) => (raw === undefined ? undefined : state.hookBeforeRead(raw))))
  }

  private _count(state: LmdbSubState, _tx?: LmdbTransaction): number {
    this._assertOpen()
    const opts = this._readOpts(_tx)
    return (opts ? state.env.getCount(opts) : state.env.getCount()) as number
  }

  private _keys(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): Promise<ILmdbKey[]> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `keys`, options)
    if (guard) return guard
    return Promise.resolve(state.env.getKeys(this._rangeOpts(options, tx)).asArray) as Promise<ILmdbKey[]>
  }

  private _values(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): Promise<unknown[]> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `values`, options)
    if (guard) return guard
    const range = state.env.getRange(this._rangeOpts(options, tx))
    if (!state.codec) return range.map((e) => e.value as unknown).asArray as Promise<unknown[]>
    return range.map((e) => state.hookBeforeRead(e.value)).asArray as Promise<unknown[]>
  }

  private _entries(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): Promise<Array<[ILmdbKey, unknown]>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `entries`, options)
    if (guard) return guard
    const range = state.env.getRange(this._rangeOpts(options, tx))
    if (!state.codec) return range.map((e) => [e.key as ILmdbKey, e.value as unknown] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
    return range.map((e) => [e.key as ILmdbKey, state.hookBeforeRead(e.value)] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
  }

  private async *_iterate(state: LmdbSubState, options?: IRangeOptions, tx?: LmdbTransaction): AsyncIterableIterator<[ILmdbKey, unknown]> {
    this._assertOpen()
    const iter = state.env.getRange(this._rangeOpts(options, tx)) as Iterable<{key: ILmdbKey; value: unknown}>
    for (const entry of iter) {
      yield [entry.key, state.codec ? this._readValue(state, entry.value) : entry.value]
    }
  }

  private _like(state: LmdbSubState, pattern: string, options?: IRangeOptions, tx?: LmdbTransaction): Promise<Array<[ILmdbKey, unknown]>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `like`, options)
    if (guard) return guard
    const wildcardCount = (pattern.match(/[*?]/g) || []).length
    if (wildcardCount > LmdbLikePatternError.MAX_WILDCARDS) {
      return Promise.reject(new LmdbLikePatternError(wildcardCount))
    }
    const stringsOnly = this._keysAreStrings(state)
    const prefix = stringsOnly ? this._extractPrefixLikePattern(pattern) : null
    const rangeOpts: IRangeOptions = {...options, ...(tx?.raw ? {transaction: tx.raw} : {})}
    if (prefix !== null) {
      const endKey = this._prefixEnd(prefix as ILmdbKey)
      if (endKey !== undefined) {
        rangeOpts.start = prefix as ILmdbKey
        rangeOpts.end = endKey
        const range = state.env.getRange(rangeOpts)
        if (!state.codec) return range.map((e) => [e.key as ILmdbKey, e.value as unknown] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
        return range.map((e) => [e.key as ILmdbKey, state.hookBeforeRead(e.value)] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
      }
    }
    const inferred = stringsOnly ? this._inferRangeFromPrefix(pattern) : null
    if (inferred) {
      rangeOpts.start = (options?.start as ILmdbKey) ?? inferred.start
      if (options?.end === undefined) {
        rangeOpts.end = inferred.end
      }
    }
    const range = state.env.getRange(rangeOpts).filter(({key}: {key: Key}) => globMatch(String(key), pattern))
    if (!state.codec) return range.map((e) => [e.key as ILmdbKey, e.value as unknown] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
    return range.map((e) => [e.key as ILmdbKey, state.hookBeforeRead(e.value)] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
  }

  private _findByPrefix(state: LmdbSubState, prefix: ILmdbKey, options?: IRangeOptions, tx?: LmdbTransaction): Promise<Array<[ILmdbKey, unknown]>> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const guard = this._rejectMaterialize(state, `findByPrefix`, options)
    if (guard) return guard
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(state, prefix)) {
      const range = state.env.getRange({...options, start: prefix, end: endKey, ...(tx?.raw ? {transaction: tx.raw} : {})})
      if (!state.codec) return range.map((e) => [e.key as ILmdbKey, e.value as unknown] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
      return range.map((e) => [e.key as ILmdbKey, state.hookBeforeRead(e.value)] as [ILmdbKey, unknown]).asArray as Promise<Array<[ILmdbKey, unknown]>>
    }
    return Promise.resolve(state.env.getKeys(this._rangeOpts(options, tx)).asArray)
      .then((keys) => (keys as ILmdbKey[]).filter((k) => String(k).startsWith(String(prefix))))
      .then((matchedKeys) =>
        state.env.getMany(matchedKeys).then((raws) => {
          const rawArr = raws as Array<unknown>
          if (!state.codec) return rawArr.map((raw, i) => [matchedKeys[i] as ILmdbKey, raw as unknown] as [ILmdbKey, unknown])
          return rawArr.map((raw, i) => [matchedKeys[i] as ILmdbKey, state.hookBeforeRead(raw)] as [ILmdbKey, unknown])
        })
      )
  }

  private _countByPrefix(state: LmdbSubState, prefix: ILmdbKey): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(state, prefix)) {
      return Promise.resolve(state.env.getKeysCount({start: prefix, end: endKey}))
    }
    return Promise.resolve(state.env.getKeys().asArray).then((keys) => {
      let count = 0
      for (const k of keys as ILmdbKey[]) {
        if (String(k).startsWith(String(prefix))) count++
      }
      return count
    })
  }

  private _deleteByPrefix(state: LmdbSubState, prefix: ILmdbKey): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`deleteByPrefix`))
    if (this._isEmptyPrefix(prefix)) {
      return Promise.reject(new LmdbEmptyPrefixError())
    }
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(state, prefix)) {
      const guard = this._rejectMaterializeCount(`deleteByPrefix`, state.env.getKeysCount({start: prefix, end: endKey}))
      if (guard) return guard
    } else {
      const guard = this._rejectMaterializeCount(`deleteByPrefix`, this._count(state))
      if (guard) return guard
    }
    const keysPromise: Promise<ILmdbKey[]> =
      endKey !== undefined && this._stringBoundsValid(state, prefix)
        ? (Promise.resolve(state.env.getKeys({start: prefix, end: endKey}).asArray) as Promise<ILmdbKey[]>)
        : Promise.resolve(state.env.getKeys().asArray).then((keys) => {
            const matched: ILmdbKey[] = []
            const prefixStr = String(prefix)
            for (const k of keys as ILmdbKey[]) {
              if (String(k).startsWith(prefixStr)) matched.push(k)
            }
            return matched
          })
    return keysPromise.then((keys) =>
      this.owner.transaction(() => {
        let removed = 0
        for (const k of keys) {
          if (state.indexes.length > 0) {
            const existing = this._peek(state, k)
            if (existing !== undefined) {
              this._deleteIndexedSync(state, k, existing)
              removed++
              continue
            }
          }
          if (state.env.removeSync(k)) removed++
        }
        return removed
      })
    )
  }

  private _first(state: LmdbSubState, tx?: LmdbTransaction): Promise<[ILmdbKey, unknown] | undefined> {
    const closed = this._rejectClosed()
    if (closed) return closed
    return Promise.resolve(state.env.getRange(this._rangeOpts({limit: 1}, tx) as RangeOptions).asArray).then((arr) => {
      const entry = (arr as Array<{key: ILmdbKey; value: unknown}>)[0]
      return entry ? ([entry.key as ILmdbKey, state.codec ? state.hookBeforeRead(entry.value) : entry.value] as [ILmdbKey, unknown]) : undefined
    })
  }

  private _last(state: LmdbSubState, tx?: LmdbTransaction): Promise<[ILmdbKey, unknown] | undefined> {
    const closed = this._rejectClosed()
    if (closed) return closed
    return Promise.resolve(state.env.getRange(this._rangeOpts({reverse: true, limit: 1}, tx) as RangeOptions).asArray).then((arr) => {
      const entry = (arr as Array<{key: ILmdbKey; value: unknown}>)[0]
      return entry ? ([entry.key as ILmdbKey, state.codec ? state.hookBeforeRead(entry.value) : entry.value] as [ILmdbKey, unknown]) : undefined
    })
  }

  private _putIfNotExists(state: LmdbSubState, key: ILmdbKey, value: unknown): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`putIfNotExists`))
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    if (state.indexes.length > 0) {
      return this._indexedTx(state, () => {
        if (state.env.doesExist(key)) return false
        this._writeIndexedSync(state, key, value, encoded)
        return true
      })
    }
    return state.env.ifNoExists(key, () => {
      void state.env.put(key, encoded)
    })
  }

  private _increment(state: LmdbSubState, key: ILmdbKey, delta = 1): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`increment`))
    if (state.indexes.length > 0) return Promise.reject(new LmdbError(`increment is not supported on subs with embedded indexes (${state.dbName}) — the indexed value would go stale. Use a separate non-indexed sub for counters.`))
    if (typeof delta !== `number` || !Number.isFinite(delta)) {
      return Promise.reject(new TypeError(`delta must be a finite number`))
    }
    return this.owner.transaction(() => {
      const current = this._get(state, key) as unknown as number | undefined
      if (current !== undefined && typeof current !== `number`) {
        throw new TypeError(`Cannot increment non-numeric value for key '${String(key)}'`)
      }
      const next = (current ?? 0) + delta
      this._put(state, key, next as unknown as unknown)
      return next
    })
  }

  private _decrement(state: LmdbSubState, key: ILmdbKey, amount = 1): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (typeof amount !== `number` || !Number.isFinite(amount)) {
      return Promise.reject(new TypeError(`amount must be a finite number`))
    }
    return this._increment(state, key, -amount)
  }

  private _addValue(state: LmdbSubState, key: ILmdbKey, value: unknown): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const dup = this._rejectIfNotDupSort(state, `addValue`)
    if (dup) return dup
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`addValue`))
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    return state.env.put(key, encoded) as unknown as Promise<void>
  }

  private _getValues(state: LmdbSubState, key: ILmdbKey, tx?: LmdbTransaction): Promise<unknown[]> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const dup = this._rejectIfNotDupSort(state, `getValues`)
    if (dup) return dup
    const raws = state.env.getValues(key, tx?.raw ? {transaction: tx.raw} : undefined).asArray as Promise<unknown[]>
    if (!state.codec) return raws
    return raws.then((arr) => arr.map((raw) => state.hookBeforeRead(raw)))
  }

  private _getValuesCount(state: LmdbSubState, key: ILmdbKey, tx?: LmdbTransaction): number {
    this._assertOpen()
    this._assertDupSort(state, `getValuesCount`)
    return state.env.getValuesCount(key, tx?.raw ? {transaction: tx.raw} : undefined)
  }

  private _removeValue(state: LmdbSubState, key: ILmdbKey, value: unknown): Promise<boolean> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const dup = this._rejectIfNotDupSort(state, `removeValue`)
    if (dup) return dup
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`removeValue`))
    // Native dupSort remove targets the exact stored value, but always reports
    // `true` even when the value is absent — compare the O(1) native count
    // before and after instead of materialising + stringify-ing the value list.
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    const before = this._getValuesCount(state, key)
    return (state.env as unknown as {remove(key: Key, value: unknown): Promise<boolean>}).remove(key, encoded).then(() => {
      return this._getValuesCount(state, key) < before
    })
  }

  private _putBinary(state: LmdbSubState, key: ILmdbKey, value: Buffer | Uint8Array): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`putBinary`))
    if (state.indexes.length > 0) return Promise.reject(new LmdbError(`putBinary is not supported on subs with embedded indexes (${state.dbName}) — binary writes bypass the index extractor.`))
    return state.env.put(key, asBinary(value as unknown as Buffer)) as unknown as Promise<void>
  }

  private _getBinary(state: LmdbSubState, key: ILmdbKey): Buffer | undefined {
    this._assertOpen()
    return state.env.getBinary(key)
  }

  private _getBinaryFast(state: LmdbSubState, key: ILmdbKey): Buffer | undefined {
    this._assertOpen()
    return state.env.getBinaryFast(key)
  }

  private async _putMany(state: LmdbSubState, entries: Array<[ILmdbKey, unknown]>, chunkSize = 500): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`putMany`))
    if (entries.length === 0) return
    if (state.indexes.length > 0) {
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize)
        await this._indexedTx(state, () => {
          for (const [k, v] of chunk) {
            this._writeIndexedSync(state, k, v, state.codec ? state.codec.hookBeforeWrite(v) : v)
          }
        })
      }
      return
    }
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize)
      await this.owner.transaction(() => {
        for (const [k, v] of chunk) {
          const encoded = state.codec ? state.codec.hookBeforeWrite(v) : (v as unknown)
          void state.env.put(k as unknown as Key, encoded as unknown)
        }
      })
    }
  }

  private async _exportJSONL(state: LmdbSubState): Promise<string> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const entries = await this._entries(state)
    return entries.map(([k, v]) => JSON.stringify([k, v])).join(`\n`)
  }

  private async _importJSONL(state: LmdbSubState, jsonl: string): Promise<number> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`importJSONL`))
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
    await this._putMany(state, entries)
    return entries.length
  }

  private _put(state: LmdbSubState, key: ILmdbKey, value: unknown, txOrVersion?: LmdbTransaction | number, ttlOverride?: number | {ttlMs: number} | undefined): Promise<void> {
    const closed = this._rejectClosed()
    if (closed) return closed
    if (this.owner.readOnly) return Promise.reject(new LmdbReadOnlyError(`put`))
    const tx = typeof txOrVersion === `number` ? undefined : txOrVersion
    const version = typeof txOrVersion === `number` ? txOrVersion : undefined
    const txErr = this._rejectBadTx(tx)
    if (txErr) return txErr
    if (state.isTtl) {
      let ttlMs: number | undefined
      if (typeof ttlOverride === `number`) ttlMs = ttlOverride
      else if (ttlOverride && typeof (ttlOverride as {ttlMs?: unknown}).ttlMs === `number`) ttlMs = (ttlOverride as {ttlMs: number}).ttlMs
      if (ttlMs === undefined && typeof state.ttlMs === `number` && state.ttlMs > 0) ttlMs = state.ttlMs
      const exp = typeof ttlMs === `number` && ttlMs > 0 ? Date.now() + ttlMs : undefined
      const envelope = exp !== undefined ? {v: value, exp} : {v: value}
      const stored = state.codec ? state.codec.hookBeforeWrite(envelope as unknown) : (envelope as unknown)
      if (state.indexes.length > 0) {
        return this._indexedTx(state, () => {
          this._writeIndexedSync(state, key, value, stored)
        }) as unknown as Promise<void>
      }
      return state.env.put(key, stored) as unknown as Promise<void>
    }
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    if (state.indexes.length > 0) {
      if (version !== undefined) {
        return this._indexedTx(state, () => this._writeIndexedInner(state, key, value, encoded, `async`, version)) as unknown as Promise<void>
      }
      return this._writeIndexed(state, key, value, encoded)
    }
    if (version !== undefined) {
      return state.env.put(key, encoded, version) as unknown as Promise<void>
    }
    return state.env.put(key, encoded) as unknown as Promise<void>
  }

  private _getEntry(state: LmdbSubState, key: ILmdbKey): {version: number; value: unknown} | undefined {
    this._assertOpen()
    return state.env.getEntry(key) as {version: number; value: unknown} | undefined
  }

  private _putSync(state: LmdbSubState, key: ILmdbKey, value: unknown): void {
    this._assertOpen()
    const encoded = state.codec ? state.codec.hookBeforeWrite(value) : value
    if (state.indexes.length > 0) {
      this._writeIndexedSync(state, key, value, encoded)
      return
    }
    state.env.putSync(key as never, encoded as never)
  }

  private _removeSync(state: LmdbSubState, key: ILmdbKey, value?: unknown): boolean {
    this._assertOpen()
    if (state.indexes.length > 0) {
      const existing = this._peek(state, key)
      if (existing === undefined && !state.env.doesExist(key)) return false
      this._deleteIndexedSync(state, key, existing)
      return true
    }
    if (value !== undefined) return state.env.removeSync(key as never, value as never)
    return state.env.removeSync(key as never)
  }

  private _getKeys(state: LmdbSubState, options?: IRangeOptions): Iterable<ILmdbKey> {
    this._assertOpen()
    return state.env.getKeys(options) as Iterable<ILmdbKey>
  }

  private _writeIndexedInner(state: LmdbSubState, key: ILmdbKey, value: unknown, stored: unknown, mode: `sync` | `async`, version?: number): void {
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
          throw new LmdbUniqueConstraintError(idx.name, key, newVal)
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
    if (mode === `sync`) {
      if (version !== undefined) {
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

  private _writeIndexedSync(state: LmdbSubState, key: ILmdbKey, value: unknown, stored: unknown): void {
    this._writeIndexedInner(state, key, value, stored, `sync`)
  }

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
    state.env.removeSync(key as never)
  }

  private _writeIndexed(state: LmdbSubState, key: ILmdbKey, value: unknown, stored: unknown): Promise<void> {
    return this._indexedTx(state, () => {
      this._writeIndexedSync(state, key, value, stored)
    }) as unknown as Promise<void>
  }

  private _indexedTx<T>(_state: LmdbSubState, fn: () => T): Promise<T> {
    return this.owner.transaction(fn).catch((err: unknown) => {
      if (err instanceof LmdbTransactionError && err.cause instanceof LmdbUniqueConstraintError) throw err.cause
      throw err
    })
  }

  private async _findByIndex(state: LmdbSubState, query: Record<string, ILmdbKey>, tx?: LmdbTransaction): Promise<unknown> {
    const closed = this._rejectClosed()
    if (closed) return closed as Promise<unknown>
    const entries = Object.entries(query) as Array<[string, ILmdbKey]>
    if (entries.length === 0) {
      throw new LmdbError(`findByIndex requires at least one index key`)
    }
    // Single pass: validate, resolve each index, run O(1) unique point lookups
    // and partition non-unique keys in ONE loop (no separate map/every/filter).
    let uniquePk: ILmdbKey | undefined
    let uniqueMiss = false
    let hasNonUnique = false
    const nonUniques: Array<{idx: IndexDescriptor; value: ILmdbKey}> = []
    for (const [name, value] of entries) {
      if (value === null || value === undefined) {
        throw new LmdbError(`findByIndex query key '${name}' has null/undefined value — an indexed value cannot be null/undefined`)
      }
      const idx = this._findIndex(state, name)
      if (idx.unique) {
        const pk = this._get(idx.state, value, tx) as ILmdbKey | undefined
        if (pk === undefined || (uniquePk !== undefined && !sameIndexValue(pk, uniquePk))) {
          uniqueMiss = true
        } else {
          uniquePk = pk
        }
      } else {
        hasNonUnique = true
        nonUniques.push({idx, value})
      }
    }
    const empty = hasNonUnique ? [] : undefined
    if (uniqueMiss) return empty

    // Single-pk path: a unique index constrained the answer to one row.
    if (uniquePk !== undefined) {
      const v = this._get(state, uniquePk, tx)
      if (v === undefined) return empty
      for (const {idx, value} of nonUniques) {
        if (!sameIndexValue(idx.extractor(v), value)) return empty
      }
      return hasNonUnique ? [v] : v
    }

    // Non-unique path: pick the MOST SELECTIVE index (fewest pks, O(1) native
    // count) as driver, then fetch + verify candidates in one combined loop.
    let driver: {idx: IndexDescriptor; value: ILmdbKey} | undefined
    let driverCount = Infinity
    for (const {idx, value} of nonUniques) {
      const count = this._getValuesCount(idx.state, value, tx)
      if (count > 0 && count < driverCount) {
        driver = {idx, value}
        driverCount = count
      }
    }
    if (driver === undefined) return []

    const pks = (await this._getValues(driver.idx.state, driver.value, tx)) as ILmdbKey[]
    const filtered: unknown[] = []
    for (const pk of pks) {
      const v = this._get(state, pk, tx)
      if (v === undefined) continue
      let keep = true
      for (const {idx, value} of nonUniques) {
        if (idx === driver.idx) continue
        if (!sameIndexValue(idx.extractor(v), value)) {
          keep = false
          break
        }
      }
      if (keep) filtered.push(v)
    }
    return filtered
  }

  private async _purgeExpired(state: LmdbSubState): Promise<number> {
    this._assertOpen()
    if (!state.isTtl) return 0
    // Lazy scan: collect only expired envelopes instead of materialising every entry.
    const now = Date.now()
    const expired: Array<[ILmdbKey, {v: unknown; exp?: number}]> = []
    for await (const [k, value] of this._iterate(state)) {
      const envelope = value as {v: unknown; exp?: number} | undefined
      if (envelope && envelope.exp !== undefined && now > envelope.exp) {
        expired.push([k, envelope])
      }
    }
    if (expired.length === 0) return 0
    if (state.indexes.length > 0) {
      const CHUNK = 500
      let removed = 0
      for (let i = 0; i < expired.length; i += CHUNK) {
        const chunk = expired.slice(i, i + CHUNK)
        await this._indexedTx(state, () => {
          for (const [k, envelope] of chunk) {
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
    const results = await Promise.all(expired.map(([k]) => this._delete(state, k)))
    return results.filter(Boolean).length
  }

  private _reindex(state: LmdbSubState, name?: string): Promise<{built: number; skipped: Array<{key: ILmdbKey; index: string; value: unknown}>}> {
    const closed = this._rejectClosed()
    if (closed) return closed
    const targets = name === undefined ? state.indexes : [this._findIndex(state, name)]
    const skipped: Array<{key: ILmdbKey; index: string; value: unknown}> = []
    let built = 0
    return Promise.all(targets.map((t) => this._clear(t.state))).then(() => {
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
    return this._get(this._state, key as ILmdbKey, tx) as ValueOf<S> | undefined
  }

  /**
   * Read a value by key, throwing when absent.
   *
   * @param key - The primary key.
   * @param tx - Optional active {@link LmdbTransaction} to read from.
   * @returns The row value.
   * @throws {LmdbKeyNotFoundError} When the key is absent.
   */
  getStrict(key: KeyOf<S>, tx?: LmdbTransaction): ValueOf<S> {
    return this._getStrict(this._state, key as ILmdbKey, tx) as ValueOf<S>
  }

  /**
   * Check whether a key exists.
   *
   * @param key - The primary key.
   * @param tx - Optional active {@link LmdbTransaction} to check against.
   * @returns `true` when the key exists. Synchronous.
   */
  has(key: KeyOf<S>, tx?: LmdbTransaction): boolean {
    return this._has(this._state, key as ILmdbKey, tx)
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
    return this._put(this._state, key as ILmdbKey, value as unknown, isTx ? ttlOrTx : undefined, isTx ? undefined : ttlOrTx)
  }

  /**
   * Delete a key.
   *
   * @param key - The primary key.
   * @param tx - Optional active {@link LmdbTransaction} to delete within.
   * @returns Resolves to `true` when the key existed and was removed.
   */
  delete(key: KeyOf<S>, tx?: LmdbTransaction): Promise<boolean> {
    return this._delete(this._state, key as ILmdbKey, tx)
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
    this._putSync(this._state, key as ILmdbKey, value as unknown)
  }

  /**
   * Synchronous delete — use inside a transaction callback.
   *
   * @param key - The primary key.
   * @returns `true` when the key existed and was removed.
   */
  removeSync(key: KeyOf<S>): boolean {
    return this._removeSync(this._state, key as ILmdbKey)
  }

  /**
   * Write many entries.
   *
   * @param entries - `[key, value]` pairs to write.
   * @param chunkSize - Entries per transaction chunk (default `500`).
   * @returns Resolves when all chunks are committed.
   */
  putMany(entries: [KeyOf<S>, ValueOf<S>][], chunkSize?: number): Promise<void> {
    return this._putMany(this._state, entries as Array<[ILmdbKey, unknown]>, chunkSize)
  }

  /**
   * Read many keys.
   *
   * @param keys - The primary keys to read.
   * @returns Values aligned with `keys` — `undefined` for absent keys.
   */
  getMany(keys: KeyOf<S>[]): Promise<(ValueOf<S> | undefined)[]> {
    return this._getMany(this._state, keys as ILmdbKey[]) as Promise<(ValueOf<S> | undefined)[]>
  }

  /**
   * Page-fault keys into the read cache.
   *
   * @param keys - The primary keys to prefetch.
   * @returns Resolves when the pages are loaded.
   */
  prefetch(keys: KeyOf<S>[]): Promise<void> {
    return this._prefetch(this._state, keys as ILmdbKey[])
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
    return this._findByPrefix(this._state, prefix as ILmdbKey, options, tx) as Promise<[KeyOf<S>, ValueOf<S>][]>
  }

  /**
   * Count entries under a prefix.
   *
   * @param prefix - The prefix to count.
   * @returns The number of matching entries.
   */
  countByPrefix(prefix: KeyOf<S>): Promise<number> {
    return this._countByPrefix(this._state, prefix as ILmdbKey)
  }

  /**
   * Delete entries under a prefix.
   *
   * @param prefix - The prefix to delete.
   * @returns The number of deleted entries.
   * @throws {LmdbEmptyPrefixError} When `prefix` is empty — use {@link clear} instead.
   */
  deleteByPrefix(prefix: KeyOf<S>): Promise<number> {
    return this._deleteByPrefix(this._state, prefix as ILmdbKey)
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
    return this._putIfNotExists(this._state, key as ILmdbKey, value as unknown)
  }

  /**
   * Atomic increment.
   *
   * @param key - The primary key.
   * @param delta - Increment amount (default `1`).
   * @returns The new value; absent keys start at `0`.
   */
  increment(key: KeyOf<S>, delta = 1): Promise<number> {
    return this._increment(this._state, key as ILmdbKey, delta)
  }

  /**
   * Atomic decrement.
   *
   * @param key - The primary key.
   * @param amount - Decrement amount (default `1`).
   * @returns The new value; absent keys start at `0`.
   */
  decrement(key: KeyOf<S>, amount = 1): Promise<number> {
    return this._decrement(this._state, key as ILmdbKey, amount)
  }

  // ── dupSort ────────────────────────────────────────────────────

  /**
   * Append a duplicate value under a key.
   *
   * @param key - The primary key.
   * @param value - The duplicate value to append (requires a `dupSort` sub).
   * @returns Resolves when the value is appended.
   */
  addValue(key: KeyOf<S>, value: ValueOf<S>): Promise<void> {
    return this._addValue(this._state, key as ILmdbKey, value as unknown)
  }

  /**
   * All duplicate values under a key.
   *
   * @param key - The primary key.
   * @returns The ordered duplicate values.
   */
  getValues(key: KeyOf<S>): Promise<ValueOf<S>[]> {
    return this._getValues(this._state, key as ILmdbKey) as Promise<ValueOf<S>[]>
  }

  /**
   * Count of duplicate values under a key.
   *
   * @param key - The primary key.
   * @returns The number of duplicates. Synchronous.
   */
  getValuesCount(key: KeyOf<S>): number {
    return this._getValuesCount(this._state, key as ILmdbKey)
  }

  /**
   * Remove one duplicate value under a key.
   *
   * @param key - The primary key.
   * @param value - The duplicate value to remove.
   * @returns Resolves to `true` when the value was removed.
   */
  removeValue(key: KeyOf<S>, value: ValueOf<S>): Promise<boolean> {
    return this._removeValue(this._state, key as ILmdbKey, value as unknown)
  }

  // ── Binary ─────────────────────────────────────────────────────

  /**
   * Write raw bytes, bypassing the value encoder.
   *
   * @param key - The primary key.
   * @param value - The raw bytes to store.
   * @returns Resolves when the bytes are written.
   */
  putBinary(key: KeyOf<S>, value: Buffer | Uint8Array): Promise<void> {
    return this._putBinary(this._state, key as ILmdbKey, value)
  }

  /**
   * Read raw bytes.
   *
   * @param key - The primary key.
   * @returns The stored bytes, or `undefined` when absent.
   */
  getBinary(key: KeyOf<S>): Buffer | undefined {
    return this._getBinary(this._state, key as ILmdbKey)
  }

  /**
   * Read raw bytes synchronously.
   *
   * @param key - The primary key.
   * @returns The stored bytes, or `undefined` when absent. No async wrapper.
   */
  getBinaryFast(key: KeyOf<S>): Buffer | undefined {
    return this._getBinaryFast(this._state, key as ILmdbKey)
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
   * @returns The number of imported entries.
   */
  importJSONL(jsonl: string): Promise<number> {
    return this._importJSONL(this._state, jsonl)
  }

  // ── Embedded indexes ───────────────────────────────────────────

  /**
   * Object-query index read.
   *
   * @param query - Map of declared index names to values; every key is ANDed.
   * @param tx - Optional active {@link LmdbTransaction} to read within — keeps every point read of the query on the same snapshot.
   * @returns The row when all queried keys are unique, `T[]` when any is non-unique, `undefined`/`[]` on no match.
   */
  findByIndex<Q extends IIndexQuery<ValueOf<S>, SchemaIndexesOf<S[`value`]>>>(query: Q, tx?: LmdbTransaction): Promise<IIndexResult<ValueOf<S>, SchemaIndexesOf<S[`value`]>, Q>> {
    return this._findByIndex(this._state, query as Record<string, ILmdbKey>, tx) as Promise<IIndexResult<ValueOf<S>, SchemaIndexesOf<S[`value`]>, Q>>
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
    return this._getEntry(this._state, key as ILmdbKey) as {version: number; value: ValueOf<S>} | undefined
  }

  // ── Types ──────────────────────────────────────────────────────

  /**
   * The schema class this handle binds.
   *
   * @returns The registered schema class.
   */
  get schemaClass(): S {
    return this.schema
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
