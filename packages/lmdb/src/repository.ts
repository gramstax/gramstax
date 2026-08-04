/**
 * LmdbRepository base class — typed CRUD over a single LMDB sub-database.
 *
 * @remarks
 * Each {@link LmdbRepository} owns one sub-database (identified by the static
 * `dbName`). The class provides typed `set`/`get`/`delete`/iteration methods
 * via a configurable codec (default: JSON).
 *
 * Subclassing is the preferred way to declare a repository:
 *
 * ```typescript
 * class UserRepository extends LmdbRepository<IVUser, string> {
 *   static dbName = "user";
 * }
 *
 * env.register(UserRepository);
 * const userRepo = env.get(UserRepository);
 * await userRepo.set("u1", { name: "Alice", age: 30 });
 * ```
 *
 * Custom serialization: override static serialize / static deserialize`
 * or assign a full {@link ICodec} to static codec.
 *
 * @packageDocumentation
 * @public
 */

import type {GetOptions, Key, RangeOptions} from "lmdb"
import {resolveCodec} from "./codec"
import type {IEnvForRepo} from "./env"
import {LmdbEmptyPrefixError, LmdbEnvClosedError, LmdbEnvNotOpenError, LmdbKeyNotFoundError, LmdbMissingDbNameError, LmdbReadOnlyError, LmdbTransactionDoneError, LmdbTransactionError} from "./errors"
import type {LmdbTransaction} from "./transaction"
import type {ICodec, ILmdbKey, IRangeOptions} from "./types"

/**
 * Base class for typed repositories over LMDB.
 *
 * @typeParam T - Value type stored in this repository.
 * @typeParam K - Key type used to address values. Defaults to `string`.
 *
 * @public
 */
export abstract class LmdbRepository<T = unknown, K extends ILmdbKey = string> {
  /**
   * Sub-database name. Must be unique within the {@link LmdbEnv}.
   *
   * @remarks
   * Subclasses MUST override this. {@link LmdbEnv.register} throws
   * {@link LmdbMissingDbNameError} if it is not defined.
   *
   * @virtual
   * @public
   */
  static dbName: string

  /**
   * Optional custom codec for this repository.
   *
   * @remarks
   * If set, runs BEFORE LMDB encoding. Use for custom transforms
   * (e.g. `Date → number`). For human-readable JSON, set `encoding` on `LmdbEnv`
   * instead — LMDB does `JSON.stringify` natively without double encoding.
   *
   * @virtual
   * @public
   */
  static codec?: ICodec<unknown>

  /**
   * Optional custom serializer. Use with {@link deserialize}.
   *
   * @virtual
   * @public
   */
  static serialize?(value: unknown): unknown

  /**
   * Optional custom deserializer. Use with {@link serialize}.
   *
   * @virtual
   * @public
   */
  static deserialize?(raw: unknown): unknown

  /**
   * The sub-database handle, augmented with root-env methods.
   *
   * @remarks
   * The repository delegates all data operations (`get`, `put`, `remove`,
   * etc.) to the env — which routes them to the correct LMDB sub-database
   * handle. Root-env capabilities (`transaction`, `getRepository`, `readOnly`)
   * are also accessible here. Note: a repository retains its env (bound
   * references) — keep the repo short-lived alongside the env, and drop both
   * to let the env be garbage-collected after {@link LmdbEnv.close}.
   *
   * @public
   */
  readonly env: IEnvForRepo

  /** @internal */
  protected readonly _codec: ICodec<T> | undefined

  /** @internal Pre-resolved decode closure (plan 007 P4). */
  protected readonly _decode: (raw: unknown) => T

  /** @internal Cache of compiled LIKE regexes — avoids O(N) recompile per call. */
  protected readonly _patternCache = new Map<string, RegExp>()

  /** @internal FIFO cap for {@link _patternCache} (plan 007 L4). */
  private static readonly _PATTERN_CACHE_MAX = 250

  /** @internal Cached key-type probe result — set after the first non-empty probe (plan 007 P1). */
  private _keyType: `string` | `buffer` | `number` | `empty` | undefined

  /**
   * Construct a LmdbRepository bound to an env.
   *
   * @remarks
   * Called by {@link LmdbEnv.register}, not by user code directly.
   *
   * @param rootEnv - The owning root env.
   * @param dbName - The sub-database name. Defaults to the static `dbName`.
   * @internal
   */
  constructor(rootEnv: IEnvForRepo, dbName?: string) {
    const resolved = dbName ?? (this.constructor as typeof LmdbRepository).dbName
    if (!resolved) {
      throw new LmdbMissingDbNameError(this.constructor.name)
    }
    // Build a combined object: data operations go to the sub-DB handle,
    // root-env methods (transaction, getRepository, readOnly) come from rootEnv.
    const subDb = rootEnv.getDb(resolved)
    const combined = Object.create(subDb) as IEnvForRepo
    combined.transaction = rootEnv.transaction.bind(rootEnv) as IEnvForRepo[`transaction`]
    combined.readTransaction = rootEnv.readTransaction.bind(rootEnv) as IEnvForRepo[`readTransaction`]
    combined.getRepository = rootEnv.getRepository.bind(rootEnv) as IEnvForRepo[`getRepository`]
    Object.defineProperty(combined, `readOnly`, {value: rootEnv.readOnly})
    combined.getDb = rootEnv.getDb.bind(rootEnv) as IEnvForRepo[`getDb`]
    combined.assertOpen = rootEnv.assertOpen.bind(rootEnv) as IEnvForRepo[`assertOpen`]
    combined.getWriteTxnId = rootEnv.getWriteTxnId.bind(rootEnv) as IEnvForRepo[`getWriteTxnId`]
    this.env = combined
    this._codec = resolveCodec(this.constructor)
    // Pre-resolved decode closure: the `_codec ? ... : ...` branch is
    // decided once here instead of once per array entry in range queries
    // (plan 007 P4).
    this._decode = this._codec ? (raw: unknown) => this._codec!.deserialize(raw) : (raw: unknown) => raw as T
  }

  /**
   * Guard: require the env to be open before an operation (plan 007 B2/B3).
   *
   * @throws {@link LmdbEnvClosedError} when the env is closed.
   * @throws {@link LmdbEnvNotOpenError} for any other non-open state.
   * @internal
   */
  private _assertOpen(): void {
    this.env.assertOpen()
  }

  /**
   * Guard for async methods: reject with the closed-state error instead of
   * throwing synchronously, so `await repo.set(...)` after close rejects
   * cleanly instead of crashing the caller.
   *
   * @internal
   */
  private _rejectClosed<T>(): Promise<T> | null {
    try {
      this._assertOpen()
      return null
    } catch (err) {
      return Promise.reject(err)
    }
  }

  /**
   * Guard for write ops receiving an explicit transaction: a tx argument is
   * only legal inside an active `env.transaction()` callback (plan 007 B3).
   *
   * @internal
   */
  private _rejectBadTx<T>(tx: LmdbTransaction | undefined): Promise<T> | null {
    if (!tx) return null
    if (tx.done) {
      return Promise.reject(new LmdbTransactionDoneError())
    }
    // Outside an active write transaction, `tx` would be silently ignored —
    // reject loudly so false atomicity guarantees are impossible.
    // getWriteTxnId() throws when no write txn is active; treat that as the
    // same "tx used outside a transaction" condition.
    let txnId: number
    try {
      txnId = this.env.getWriteTxnId()
    } catch {
      txnId = 0
    }
    if (!txnId) {
      return Promise.reject(new LmdbTransactionError(`A transaction was passed to a write operation but no write transaction is active. Wrap the write in env.transaction() and pass the same tx.`))
    }
    return null
  }

  /**
   * Probe the repository's key type once and cache it (plan 007 P1).
   *
   * @remarks
   * String range bounds are only meaningful for string-keyed sub-DBs —
   * ordered-binary encodes numbers/Buffers differently. Empty repos return
   * `empty` (a bounded scan over an empty DB is trivially correct). The
   * result is cached because a repo's key type is fixed by its keyEncoding.
   *
   * @internal
   */
  private _probeKeyType(): `string` | `buffer` | `number` | `empty` {
    if (this._keyType) return this._keyType
    for (const k of this.env.getKeys({limit: 1})) {
      this._keyType = Buffer.isBuffer(k) ? `buffer` : typeof k === `string` ? `string` : `number`
      return this._keyType
    }
    this._keyType = `empty`
    return this._keyType
  }

  /**
   * Whether string prefix bounds are valid for this repo (plan 007 B5).
   *
   * @internal
   */
  private _stringBoundsValid(prefix: K): boolean {
    const type = this._probeKeyType()
    if (type === `empty`) return true
    if (typeof prefix === `string`) return type === `string`
    if (Buffer.isBuffer(prefix)) return type === `buffer`
    return false
  }

  /** @internal True when the prefix is empty (string `''` or zero-length Buffer). */
  private _isEmptyPrefix(prefix: K): boolean {
    return (typeof prefix === `string` && prefix.length === 0) || (Buffer.isBuffer(prefix) && prefix.length === 0)
  }

  /**
   * Build LMDB options object carrying a read transaction if one is supplied.
   *
   * @internal
   */
  private _readOpts(tx?: LmdbTransaction): GetOptions | undefined {
    if (tx?.raw) {
      return {transaction: tx.raw}
    }
    return undefined
  }

  private _rangeOpts(options: IRangeOptions | undefined, tx?: LmdbTransaction): RangeOptions | undefined {
    return tx?.raw ? {...options, transaction: tx.raw} : options
  }

  private _decodeValue(raw: unknown): T {
    return this._decode(raw)
  }

  // ──────────────────────────────────────────────────────────────────
  // Core CRUD
  // ──────────────────────────────────────────────────────────────────

  /**
   * Store a value under a key.
   *
   * @remarks
   * **SQL equivalent**: `INSERT INTO {prefix} (key, value) VALUES (?, ?)`
   * (LMDB overwrites if the key already exists — no `INSERT OR REPLACE` distinction).
   *
   * @param key - Key to write under.
   * @param value - Value to serialize and store.
   * @param tx - Optional write transaction for cross-repo atomic writes.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @public
   */
  set(key: K, value: T, tx?: LmdbTransaction): Promise<void> {
    const closed = this._rejectClosed<void>()
    if (closed) return closed
    if (this.env.readOnly) return Promise.reject(new LmdbReadOnlyError(`set`))
    const txErr = this._rejectBadTx<void>(tx)
    if (txErr) return txErr
    const encoded = this._codec ? this._codec.serialize(value) : value
    return this.env.put(key, encoded) as unknown as Promise<void>
  }

  /**
   * Retrieve a value by key.
   *
   * @remarks
   * **SQL equivalent**: `SELECT value FROM {prefix} WHERE key = ?`
   * (returns `undefined` when no row matches; LMDB has no NULL distinction —
   * a stored `null` value is indistinguishable from a missing key after
   * the codec roundtrip).
   *
   * Delegates to LMDB's synchronous `Database.get()` — no Promise overhead.
   *
   * @param key - Key to look up.
   * @param tx - Optional read transaction for snapshot consistency.
   * @returns The deserialized value, or `undefined` if the key is absent.
   *
   * @public
   */
  get(key: K, _tx?: LmdbTransaction): T | undefined {
    this._assertOpen()
    const opts = this._readOpts(_tx)
    const raw = opts ? this.env.get(key, opts) : this.env.get(key)
    if (raw === undefined) return undefined
    return this._codec ? this._decodeValue(raw) : (raw as T)
  }

  /**
   * Retrieve a value by key, throwing when the key is absent.
   *
   * @remarks
   * **SQL equivalent**: `SELECT value FROM {prefix} WHERE key = ?` with an
   * explicit not-found check — same semantics as {@link get} except a
   * missing key throws {@link LmdbKeyNotFoundError} instead of returning
   * `undefined`. A stored `undefined` value is indistinguishable from a
   * missing key (LMDB has no NULL distinction) and also throws.
   *
   * @param key - Key to look up.
   * @param tx - Optional read transaction for snapshot consistency.
   * @returns The deserialized value.
   *
   * @throws {@link LmdbKeyNotFoundError} if the key is absent.
   *
   * @public
   */
  getStrict(key: K, _tx?: LmdbTransaction): T {
    const value = this.get(key, _tx)
    if (value === undefined) {
      throw new LmdbKeyNotFoundError((this.constructor as typeof LmdbRepository).dbName, key)
    }
    return value
  }

  /**
   * Check whether a key exists.
   *
   * @remarks
   * **SQL equivalent**: `SELECT EXISTS (SELECT 1 FROM {prefix} WHERE key = ?)`
   *
   * Delegates to LMDB's synchronous `doesExist()` — no Promise overhead.
   *
   * @param key - Key to check.
   * @param tx - Optional read transaction for snapshot consistency.
   * @returns `true` if the key exists, `false` otherwise.
   *
   * @public
   */
  has(key: K, _tx?: LmdbTransaction): boolean {
    this._assertOpen()
    const opts = this._readOpts(_tx)
    // doesExist(key, undefined, options) — `undefined` keeps it a plain
    // existence check; a GetOptions object as the 2nd arg would be treated
    // as a dupSort value (encoder-encoded) and throw MDB_INCOMPATIBLE.
    return Boolean(opts ? this.env.doesExist(key, undefined, opts) : this.env.doesExist(key))
  }

  /**
   * Delete a value by key.
   *
   * @remarks
   * **SQL equivalent**: `DELETE FROM {prefix} WHERE key = ?`
   * (returns the affected-row count: `true` = 1 row deleted, `false` = 0 rows).
   *
   * Checks existence first via LMDB's synchronous `doesExist`, then removes
   * if present. Returns `false` when the key is absent.
   *
   * @param key - Key to remove.
   * @param tx - Optional write transaction for cross-repo atomic writes.
   * @returns `true` if the key existed and was removed, `false` otherwise.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @public
   */
  delete(key: K, tx?: LmdbTransaction): Promise<boolean> {
    const closed = this._rejectClosed<boolean>()
    if (closed) return closed
    if (this.env.readOnly) return Promise.reject(new LmdbReadOnlyError(`delete`))
    const txErr = this._rejectBadTx<boolean>(tx)
    if (txErr) return txErr
    // lmdb's async remove() resolves true unconditionally (even for absent
    // keys — probe-verified), so the synchronous doesExist is the only way to
    // report accurate existence. Both calls stay in the same event turn, so
    // the pair batches into the same queued commit; the sync existence check
    // is a few microseconds. (removeSync-in-txn would be atomic but costs a
    // full synchronous commit per delete — ~5ms vs ~1ms — too slow.)
    if (!this.env.doesExist(key)) return Promise.resolve(false)
    return this.env.remove(key).then(() => true)
  }

  /**
   * Delete every entry in this repository.
   *
   * @remarks
   * **SQL equivalent**: `DELETE FROM {prefix}` (no `WHERE` — truncates the
   * sub-database; LMDB reuses the freed pages).
   *
   * @param tx - Optional write transaction.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @public
   */
  clear(tx?: LmdbTransaction): Promise<void> {
    const closed = this._rejectClosed<void>()
    if (closed) return closed
    if (this.env.readOnly) return Promise.reject(new LmdbReadOnlyError(`clear`))
    const txErr = this._rejectBadTx<void>(tx)
    if (txErr) return txErr
    return this.env.clearAsync()
  }

  /**
   * Drop the underlying sub-database, removing every entry and the sub-DB
   * itself. After this call the repository instance is unusable.
   *
   * @remarks
   * **SQL equivalent**: `DROP TABLE {prefix}`
   * (the sub-DB is removed from the env; the env itself stays open).
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @public
   */
  drop(): Promise<void> {
    const closed = this._rejectClosed<void>()
    if (closed) return closed
    if (this.env.readOnly) return Promise.reject(new LmdbReadOnlyError(`drop`))
    return this.env.drop()
  }

  /**
   * Prefetch the given keys into the page cache.
   *
   * @remarks
   * Delegates to LMDB's native `prefetch` which runs on a separate
   * worker thread, page-faulting the entries' pages so that subsequent
   * synchronous `get`s are served from RAM (no hard-page-fault stalls
   * on the main thread). Best used before a known burst of reads.
   *
   * @param keys - Keys whose pages should be pre-faulted.
   *
   * @public
   */
  prefetch(keys: K[]): Promise<void> {
    const closed = this._rejectClosed<void>()
    if (closed) return closed
    // Normalize to undefined: lmdb's native prefetch resolves null, and the
    // documented Promise<void> contract (tested) promises undefined. Prefetch
    // is a pre-burst page-fault helper, not a per-write hot path, so the
    // single normalization promise is acceptable (plan 007 P3 applies to
    // set/delete).
    return this.env.prefetch(keys).then(() => undefined as undefined)
  }

  /**
   * Batch-read multiple values in one call.
   *
   * @remarks
   * **SQL equivalent**: `SELECT key, value FROM {prefix} WHERE key IN (...)`.
   *
   * Delegates to LMDB's native `getMany` which prefetches the keys
   * (parallel page-faulting) then reads them. Faster than N individual
   * `get()` calls for large batches. The returned array aligns
   * positionally with the input `keys` — entries are `undefined` when
   * the key is absent.
   *
   * @param keys - Keys to retrieve.
   * @returns Array of values in the same order as `keys`. Missing keys
   * are `undefined`.
   *
   * @public
   */
  getMany(keys: K[]): Promise<Array<T | undefined>> {
    const closed = this._rejectClosed<Array<T | undefined>>()
    if (closed) return closed
    return (this.env.getMany(keys) as Promise<Array<unknown>>).then((raws) => raws.map((raw) => (raw === undefined ? undefined : this._decode(raw))))
  }

  /**
   * Return the number of entries.
   *
   * @remarks
   * **SQL equivalent**: `SELECT COUNT(*) FROM {prefix}`
   * (LMDB keeps an accurate count per sub-DB; this is O(1), no scan).
   *
   * Delegates to LMDB's synchronous `getCount()` — no Promise overhead.
   *
   * @param tx - Optional read transaction for snapshot consistency.
   * @returns Total entry count.
   *
   * @public
   */
  count(_tx?: LmdbTransaction): number {
    this._assertOpen()
    const opts = this._readOpts(_tx)
    return (opts ? this.env.getCount(opts) : this.env.getCount()) as number
  }

  // ──────────────────────────────────────────────────────────────────
  // Bulk / iteration
  // ──────────────────────────────────────────────────────────────────

  /**
   * Iterate keys within an optional range.
   *
   * @remarks
   * **SQL equivalent**:
   * `SELECT key FROM {prefix} WHERE key >= {start} AND key < {end} ORDER BY key {LIMIT/OFFSET}`
   * (omit `start` for no lower bound, omit `end` for no upper bound).
   *
   * @param options - Range bounds (`start`, `end`, `limit`, `offset`, `reverse`).
   * @param tx - Optional read transaction (unused — LMDB auto-uses the active
   * read transaction from {@link LmdbEnv.readTransaction}).
   * @returns Array of keys. Empty if no matches.
   *
   * @public
   */
  keys(options?: IRangeOptions, tx?: LmdbTransaction): Promise<K[]> {
    const closed = this._rejectClosed<K[]>()
    if (closed) return closed
    return Promise.resolve(this.env.getKeys(this._rangeOpts(options, tx)).asArray) as Promise<K[]>
  }

  /**
   * Iterate deserialized values within an optional range.
   *
   * @remarks
   * **SQL equivalent**:
   * `SELECT value FROM {prefix} WHERE key >= {start} AND key < {end} ORDER BY key {LIMIT/OFFSET}`
   * (extracted via the repository codec; omits the key column from the result).
   *
   * @param options - Range bounds (`start`, `end`, `limit`, `offset`, `reverse`).
   * @param tx - Optional read transaction (unused).
   * @returns Array of values. Empty if no matches.
   *
   * @public
   */
  values(options?: IRangeOptions, tx?: LmdbTransaction): Promise<T[]> {
    const closed = this._rejectClosed<T[]>()
    if (closed) return closed
    return Promise.resolve(this.env.getRange(this._rangeOpts(options, tx)).asArray).then((arr) => (arr as Array<{key: K; value: unknown}>).map((e) => this._decode(e.value)))
  }

  /**
   * Iterate `[key, value]` pairs within an optional range.
   *
   * @remarks
   * **SQL equivalent**:
   * `SELECT key, value FROM {prefix} WHERE key >= {start} AND key < {end} ORDER BY key {LIMIT/OFFSET}`
   * (values are decoded via the repository codec before returning).
   *
   * @param options - Range bounds (`start`, `end`, `limit`, `offset`, `reverse`).
   * @param tx - Optional read transaction (unused).
   * @returns Array of `[key, value]` tuples. Empty if no matches.
   *
   * @public
   */
  entries(options?: IRangeOptions, tx?: LmdbTransaction): Promise<Array<[K, T]>> {
    const closed = this._rejectClosed<Array<[K, T]>>()
    if (closed) return closed
    return Promise.resolve(this.env.getRange(this._rangeOpts(options, tx)).asArray).then((arr) => (arr as Array<{key: K; value: unknown}>).map((e) => [e.key as K, this._decode(e.value)]))
  }

  /**
   * Stream entries as an async iterator (memory-efficient for large datasets).
   *
   * @remarks
   * **SQL equivalent**: cursor-based `SELECT key, value FROM {prefix} WHERE ...`
   * (equivalent to a server-side cursor / `FETCH NEXT` — loads pages lazily,
   * suitable for very large result sets).
   *
   * @param options - Range bounds (`start`, `end`, `reverse`).
   * @param tx - Optional read transaction (unused).
   * @returns Async iterable of `[key, value]` tuples.
   *
   * @example
   * ```typescript
   * for await (const [id, user] of userRepo.iterate({ start: "u" })) {
   *   console.log(id, user);
   * }
   * ```
   *
   * @public
   */
  async *iterate(options?: IRangeOptions, tx?: LmdbTransaction): AsyncIterableIterator<[K, T]> {
    this._assertOpen()
    const iter = this.env.getRange(this._rangeOpts(options, tx)) as Iterable<{key: K; value: unknown}>
    for (const entry of iter) {
      yield [entry.key as K, this._decode(entry.value)]
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Query helpers (LIKE-style patterns, prefix scans, ordering)
  // ──────────────────────────────────────────────────────────────────

  /**
   * Compile a LIKE-style glob pattern to a regex.
   *
   * @remarks
   * Pattern syntax (KV-friendly):
   * - `*` matches any sequence of characters (SQL `%`)
   * - `?` matches any single character (SQL `_`)
   * - All other characters are literal; regex metacharacters are auto-escaped.
   *
   * @param pattern - Glob pattern using `*` and `?` wildcards.
   * @returns Anchored regex matching the entire key string.
   * @internal
   */
  private _patternToRegex(pattern: string): RegExp {
    const cached = this._patternCache.get(pattern)
    if (cached) return cached
    const specials = new Set([`.`, `+`, `^`, `$`, `{`, `}`, `(`, `)`, `|`, `[`, `]`, `\\`])
    let body = `^`
    for (const ch of pattern) {
      if (ch === `*`) {
        body += `.*`
      } else if (ch === `?`) {
        body += `.`
      } else if (specials.has(ch)) {
        body += `\\${ch}`
      } else {
        body += ch
      }
    }
    body += `$`
    const regex = new RegExp(body)
    // FIFO eviction: cap the cache so a long-lived repo fed many distinct
    // user-supplied patterns cannot grow the Map without bound (plan 007 L4).
    if (this._patternCache.size >= LmdbRepository._PATTERN_CACHE_MAX) {
      const oldest = this._patternCache.keys().next().value
      if (oldest !== undefined) this._patternCache.delete(oldest)
    }
    this._patternCache.set(pattern, regex)
    return regex
  }

  /**
   * Extract a leading literal prefix from a LIKE pattern.
   *
   * @remarks
   * Returns the prefix string when the pattern is purely prefix-shaped
   * (e.g. `"user:*"` → `"user:"`). Returns `null` for non-prefix patterns
   * (infix `*foo`, suffix `*foo`, single-char `?`, mixed `u?er:*`).
   *
   * Used by {@link like} to switch from full-scan + filter to an efficient
   * LMDB range scan.
   *
   * @param pattern - Glob pattern.
   * @returns Literal prefix when the pattern is prefix-only, otherwise `null`.
   * @internal
   */
  private _extractPrefixLikePattern(pattern: string): string | null {
    if (!pattern.endsWith(`*`)) return null
    if (pattern.indexOf(`?`) !== -1) return null
    if (pattern.indexOf(`*`) !== pattern.length - 1) return null
    return pattern.slice(0, -1)
  }

  /**
   * Compute the exclusive upper-bound key for a prefix range scan.
   *
   * @remarks
   * Works for `string` and `Buffer` keys by appending a high sentinel
   * byte/character. For numeric or other key types, returns `undefined`
   * (callers should fall back to full-scan methods).
   *
   * @param prefix - The prefix key.
   * @returns The exclusive end key, or `undefined` if unsupported.
   * @internal
   */
  private _prefixEnd(prefix: K): K | undefined {
    if (typeof prefix === `string`) {
      return `${prefix}￿` as K
    }
    if (Buffer.isBuffer(prefix)) {
      return Buffer.concat([prefix, Buffer.from([0xff])]) as unknown as K
    }
    return undefined
  }

  /**
   * Infer a bounded `[start, end)` range from a LIKE pattern's literal
   * prefix anchor, so non-prefix patterns no longer force a full-table scan.
   *
   * @remarks
   * Walks the pattern from the start collecting literal characters until the
   * first wildcard (`*` or `?`) is hit. That literal run becomes a range
   * lower bound; the exclusive upper bound is derived via {@link _prefixEnd}.
   * Only `string` keys are bounded (Buffer/numeric fall back to full scan).
   *
   * Example: `"user:*"` → `{start: "user:", end: "user:￿"}` (caller also
   * applies the regex so `*foo` and `user:1*5` stay correct); `"foo*bar"`
   * → `{start: "foo", end: "foo￿"}`; `"*foo"` → `null` (no literal prefix,
   * full scan required).
   *
   * The regex filter is always still applied on top, so bounding the range
   * never changes the result set — it only shrinks the number of keys the
   * cursor must visit and materialize.
   *
   * @param pattern - Glob pattern.
   * @returns Range bounds `{start, end}` when a literal prefix exists and
   * the key type is supported, otherwise `null`.
   * @internal
   */
  private _inferRangeFromPrefix(pattern: string): {start: K; end: K} | null {
    if (pattern.length === 0) return null
    let anchor = ``
    for (const ch of pattern) {
      if (ch === `*` || ch === `?`) break
      anchor += ch
    }
    if (anchor.length === 0) return null
    const end = this._prefixEnd(anchor as K)
    if (end === undefined) return null
    return {start: anchor as K, end}
  }

  /**
   * Whether the repository's keys are strings (cached probe).
   *
   * @remarks
   * String range bounds are only meaningful for string-keyed sub-DBs —
   * ordered-binary encodes numbers/Buffers differently, so `[prefix,
   * prefixEnd)` bounds can silently skip (or include) the wrong entries.
   * Delegates to the cached {@link _probeKeyType} (plan 007 P1) — the
   * per-call native cursor seek this method used to do is gone.
   *
   * @internal
   */
  private _keysAreStrings(): boolean {
    const type = this._probeKeyType()
    return type === `string` || type === `empty`
  }

  /**
   * Find entries whose key matches a LIKE-style glob pattern.
   *
   * @remarks
   * **SQL equivalent**:
   * `SELECT key, value FROM {prefix} WHERE CAST(key AS TEXT) LIKE {pattern}`
   *
   * Pattern syntax:
   * - `*` matches any sequence of characters (SQL `%`)
   * - `?` matches any single character (SQL `_`)
   * - All other characters are literal; regex metacharacters are auto-escaped.
   *
   * **Optimization**: when the pattern is purely prefix-shaped (e.g.
   * `"user:*"`), this method switches to an LMDB range scan over
   * `[prefix, prefixEnd)` and avoids both the regex filter and
   * deserialization of non-matching values. Complexity drops from
   * **O(N) full scan** to **O(log N + M) range scan** where M is the
   * number of matches.
   *
   * The bounded-scan paths apply only to string-keyed repositories —
   * ordered-binary encodes numbers and Buffers differently than strings,
   * so string bounds would silently skip matching keys. Non-string-keyed
   * repos always use the lazy full scan with regex filtering.
   *
   * Non-prefix patterns (infix, suffix, mixed `?`/`*`) fall back to a
   * lazy full scan with regex filtering — values are deserialized only
   * for matching keys (LMDB's `RangeIterable.filter` is lazy).
   *
   * @param pattern - Glob pattern with `*` and `?` wildcards.
   * @param options - Optional `limit`/`offset`/`reverse`. For prefix
   * patterns, `start`/`end` are overridden by the detected prefix bounds.
   * @returns Array of matching `[key, value]` tuples. Empty if no matches.
   *
   * @public
   */
  like(pattern: string, options?: IRangeOptions): Promise<Array<[K, T]>> {
    const closed = this._rejectClosed<Array<[K, T]>>()
    if (closed) return closed
    const stringsOnly = this._keysAreStrings()
    const prefix = stringsOnly ? this._extractPrefixLikePattern(pattern) : null
    if (prefix !== null) {
      const endKey = this._prefixEnd(prefix as K)
      if (endKey !== undefined) {
        return Promise.resolve(
          this.env.getRange({
            start: prefix as K,
            end: endKey,
            limit: options?.limit,
            offset: options?.offset,
            reverse: options?.reverse,
            inclusiveEnd: options?.inclusiveEnd,
            exclusiveStart: options?.exclusiveStart
          }).asArray
        ).then((arr) => (arr as Array<{key: K; value: unknown}>).map((e) => [e.key as K, this._decode(e.value)]))
      }
    }
    const regex = this._patternToRegex(pattern)
    // Bound the scan by a literal prefix anchor so we don't full-scan the
    // sub-DB; the regex still filters on top, so results are unchanged.
    const inferred = stringsOnly ? this._inferRangeFromPrefix(pattern) : null
    const rangeOpts: IRangeOptions = {...options}
    if (inferred) {
      rangeOpts.start = (options?.start as K) ?? inferred.start
      if (options?.end === undefined) {
        rangeOpts.end = inferred.end
      }
    }
    return Promise.resolve(this.env.getRange(rangeOpts).filter(({key}: {key: Key}) => regex.test(String(key))).asArray).then((arr) => (arr as Array<{key: K; value: unknown}>).map((e) => [e.key as K, this._decode(e.value)]))
  }

  /**
   * Find entries whose key starts with the given prefix.
   *
   * @remarks
   * **SQL equivalent**: `SELECT key, value FROM {prefix} WHERE key LIKE {prefix}%`
   *
   * Uses an LMDB range scan on `[prefix, prefixEnd)` for string/Buffer
   * keys. For numeric or other unsupported key types, falls back to a
   * lazy full scan with `String(...).startsWith(prefix)` filter.
   *
   * `options.start`/`options.end` are overridden by the prefix bounds —
   * only `limit`/`offset`/`reverse` are honored.
   *
   * @param prefix - Key prefix to match.
   * @param options - Range bounds (`limit`/`offset`/`reverse`).
   * @returns Array of matching `[key, value]` tuples. Empty if no matches.
   *
   * @public
   */
  findByPrefix(prefix: K, options?: IRangeOptions): Promise<Array<[K, T]>> {
    const closed = this._rejectClosed<Array<[K, T]>>()
    if (closed) return closed
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(prefix)) {
      return Promise.resolve(this.env.getRange({...options, start: prefix, end: endKey}).asArray).then((arr) => (arr as Array<{key: K; value: unknown}>).map((e) => [e.key as K, this._decode(e.value)]))
    }
    // Unsupported key type (e.g. numeric), or a string prefix on a non-string
    // keyed repo: no valid prefix bounds, so we must scan. To avoid
    // materializing every value, collect only the keys (cheap, no decode),
    // filter by prefix, then fetch the matched values.
    return Promise.resolve(this.env.getKeys(options).asArray)
      .then((keys) => (keys as K[]).filter((k) => String(k).startsWith(String(prefix))))
      .then((matchedKeys) => this.env.getMany(matchedKeys).then((raws) => (raws as Array<unknown>).map((raw, i) => [matchedKeys[i] as K, this._decode(raw)] as [K, T])))
  }

  /**
   * Count entries whose key starts with the given prefix.
   *
   * @remarks
   * **SQL equivalent**: `SELECT COUNT(*) FROM {prefix} WHERE key LIKE {prefix}%`
   *
   * For string/Buffer keys, delegates to LMDB's native `getKeysCount`
   * which is **O(log N + M)** — no array allocation, no per-key iteration.
   * This path is fully synchronous (no `async`).
   *
   * For numeric/other key types (no prefix bounds possible), falls back to
   * async key collection via `.asArray`.
   *
   * @param prefix - Key prefix to match.
   * @returns Number of entries with matching key prefix.
   *
   * @public
   */
  countByPrefix(prefix: K): Promise<number> {
    const closed = this._rejectClosed<number>()
    if (closed) return closed
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined && this._stringBoundsValid(prefix)) {
      // Native getKeysCount is O(log N + M) — no array allocation.
      return Promise.resolve(this.env.getKeysCount({start: prefix, end: endKey}))
    }
    // Unsupported key type (e.g. numeric): no prefix bounds possible, so we
    // must scan. Use the native key-array drain (fast path) and count inline
    // instead of allocating a second filtered array via `.filter().length`.
    return Promise.resolve(this.env.getKeys().asArray).then((keys) => {
      let count = 0
      for (const k of keys as K[]) {
        if (String(k).startsWith(String(prefix))) count++
      }
      return count
    })
  }

  /**
   * Delete every entry whose key starts with the given prefix.
   *
   * @remarks
   * **SQL equivalent**: `DELETE FROM {prefix} WHERE key LIKE {prefix}%`
   *
   * Range-scans the keys, then issues all `remove()` calls. Returns the
   * count actually removed.
   *
   * @param prefix - Key prefix to match.
   * @returns Number of entries deleted.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @public
   */
  deleteByPrefix(prefix: K): Promise<number> {
    const closed = this._rejectClosed<number>()
    if (closed) return closed
    if (this.env.readOnly) return Promise.reject(new LmdbReadOnlyError(`deleteByPrefix`))
    // Empty prefix would wipe the entire repo — reject loudly (plan 007 B11).
    if (this._isEmptyPrefix(prefix)) {
      return Promise.reject(new LmdbEmptyPrefixError())
    }
    const endKey = this._prefixEnd(prefix)
    // Bounded range scan for matching key types. For unsupported key types
    // (e.g. numeric) or a string prefix on a Buffer-keyed repo there is no
    // valid prefix bound, so we drain the native key array once and filter.
    const keysPromise: Promise<K[]> =
      endKey !== undefined && this._stringBoundsValid(prefix)
        ? (Promise.resolve(this.env.getKeys({start: prefix, end: endKey}).asArray) as Promise<K[]>)
        : Promise.resolve(this.env.getKeys().asArray).then((keys) => {
            const matched: K[] = []
            const prefixStr = String(prefix)
            for (const k of keys as K[]) {
              if (String(k).startsWith(prefixStr)) matched.push(k)
            }
            return matched
          })
    // Synchronous remove inside a single txn avoids N promise allocations
    // and lets lmdb-js coalesce the removals into one native commit.
    return keysPromise.then((keys) =>
      this.env.transaction(() => {
        let removed = 0
        for (const k of keys) {
          if (this.env.removeSync(k)) removed++
        }
        return removed
      })
    )
  }

  /**
   * Get the first entry in key order.
   *
   * @remarks
   * **SQL equivalent**: `SELECT key, value FROM {prefix} ORDER BY key ASC LIMIT 1`
   *
   * Issues a cursor-bounded query (`limit: 1`) — no extra iteration layer.
   *
   * @returns First `[key, value]` tuple, or `undefined` if the repository is empty.
   *
   * @public
   */
  first(): Promise<[K, T] | undefined> {
    const closed = this._rejectClosed<[K, T] | undefined>()
    if (closed) return closed
    return Promise.resolve(this.env.getRange({limit: 1}).asArray).then((arr) => {
      const entry = (arr as Array<{key: K; value: unknown}>)[0]
      return entry ? ([entry.key as K, this._decode(entry.value)] as [K, T]) : undefined
    })
  }

  /**
   * Get the last entry in key order.
   *
   * @remarks
   * **SQL equivalent**: `SELECT key, value FROM {prefix} ORDER BY key DESC LIMIT 1`
   *
   * LMDB reverse convention: when `reverse: true`, the range query uses
   * `start: 'unbounded-low', end: 'unbounded-high'` in reverse order.
   *
   * @returns Last `[key, value]` tuple, or `undefined` if the repository is empty.
   *
   * @public
   */
  last(): Promise<[K, T] | undefined> {
    const closed = this._rejectClosed<[K, T] | undefined>()
    if (closed) return closed
    return Promise.resolve(this.env.getRange({reverse: true, limit: 1}).asArray).then((arr) => {
      const entry = (arr as Array<{key: K; value: unknown}>)[0]
      return entry ? ([entry.key as K, this._decode(entry.value)] as [K, T]) : undefined
    })
  }

  /**
   * Update a value atomically by reading, transforming, and writing back.
   *
   * @remarks
   * **SQL equivalent**: an UPSERT pattern
   * `UPDATE {prefix} SET value = {updater(current)} WHERE key = ?`
   * (or `INSERT ... ON CONFLICT UPDATE` semantics).
   *
   * Atomic — the read and write run inside a single LMDB write transaction
   * (via {@link LmdbEnv.transaction} with a synchronous callback), so
   * concurrent `update()` calls on the same key cannot interleave. The
   * read sees a consistent snapshot and the write is committed atomically.
   *
   * @param key - Key to update.
   * @param updater - Function transforming the current value (or `undefined`
   * if the key is absent) to the new value.
   * @returns The new value that was written.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @public
   */
  update(key: K, updater: (current: T | undefined) => T): Promise<T> {
    const closed = this._rejectClosed<T>()
    if (closed) return closed
    if (this.env.readOnly) return Promise.reject(new LmdbReadOnlyError(`update`))
    return this.env.transaction(() => {
      const current = this.get(key)
      const next = updater(current)
      this.set(key, next)
      return next
    })
  }
}
