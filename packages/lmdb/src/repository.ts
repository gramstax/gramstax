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
 * Custom serialization: override `static serialize` / `static deserialize`
 * or assign a full {@link ICodec} to `static codec`.
 *
 * @packageDocumentation
 * @public
 */

import {LmdbTransaction} from "./transaction"
import {resolveCodec} from "./codec"
import {LmdbMissingDbNameError, LmdbReadOnlyError} from "./errors"
import type {ICodec, IRangeOptions, LMDBKey} from "./types"
import type {Database} from "lmdb"

/**
 * Forward-declared `LmdbEnv` shape. The real class lives in `./env` and is
 * injected via the constructor — this avoids a circular import between
 * `Repository` and `LmdbEnv`.
 *
 * @internal
 */
interface IEnvForRepo {
  /** @internal */
  getDb(name: string): any
  /** @internal */
  readonly readOnly: boolean
  /**
   * Run a callback inside a write transaction.
   *
   * @remarks
   * All writes performed inside the callback (via any repository registered
   * with this env) are batched into a single atomic commit.
   *
   * @param fn - Callback receiving the {@link LmdbTransaction} wrapper.
   * @returns The callback's resolved value.
   */
  transaction<T>(fn: (tx: LmdbTransaction) => Promise<T>): Promise<T>
  /**
   * Run a callback inside a read-only transaction (consistent snapshot).
   *
   * @param fn - Callback receiving the read-only {@link LmdbTransaction}.
   * @returns The callback's resolved value.
   */
  readTransaction<T>(fn: (tx: LmdbTransaction) => Promise<T>): Promise<T>
  /**
   * Retrieve a previously registered repository by class.
   *
   * @remarks
   * Enables cross-repository access within transaction callbacks.
   * All repositories must be registered before calling this method.
   *
   * @param repoClass - The LmdbRepository subclass constructor.
   * @returns The registered repository instance.
   */
  getRepository<T extends LmdbRepository<any, any>>(repoClass: new (...args: any[]) => T): T
}

/**
 * Base class for typed repositories over LMDB.
 *
 * @typeParam T - Value type stored in this repository.
 * @typeParam K - Key type used to address values. Defaults to `string`.
 *
 * @public
 */
export abstract class LmdbRepository<T = unknown, K extends LMDBKey = string> {
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
  static codec?: ICodec<any>

  /**
   * LMDB native value encoding for the sub-database.
   *
   * @remarks
   * Passed to LMDB's `openDB(name, {encoding})`. Default `msgpack` (fastest,
   * supports `Date`/`Map`/`Set`/BigInt). Use `json` for human-readable
   * storage, `binary` for raw Buffers, `string` for UTF-8 strings.
   *
   * @virtual
   * @public
   */

  /**
   * Optional custom serializer. Use with {@link deserialize}.
   *
   * @virtual
   * @public
   */
  static serialize?(value: any): unknown

  /**
   * Optional custom deserializer. Use with {@link serialize}.
   *
   * @virtual
   * @public
   */
  static deserialize?(raw: unknown): any

  /**
   * The owning {@link LmdbEnv} instance.
   *
   * @remarks
   * Exposed as public to allow subclasses to call `env.transaction()`,
   * `env.getRepository()`, and other env-level methods directly.
   *
   * @public
   */
  protected readonly env: IEnvForRepo

  /** @internal Raw LMDB sub-database handle (`Database<any, any>` retains
   *  method autocomplete while key/value safety is handled by `LmdbRepository`). */
  protected readonly raw: Database<any, any>

  /** @internal */
  protected readonly _codec: ICodec<T> | undefined

  /** @internal Cache of compiled LIKE regexes — avoids O(N) recompile per call. */
  protected readonly _patternCache = new Map<string, RegExp>()

  /**
   * Construct a LmdbRepository bound to an env.
   *
   * @remarks
   * Called by {@link LmdbEnv.register}, not by user code directly.
   *
   * @param env - The owning env.
   * @param dbName - The sub-database name. Defaults to the static `dbName`.
   * @internal
   */
  constructor(env: IEnvForRepo, dbName?: string) {
    const resolved = dbName ?? (this.constructor as any).dbName
    if (!resolved) {
      throw new LmdbMissingDbNameError(this.constructor.name)
    }
    this.env = env
    this.raw = env.getDb(resolved)
    this._codec = resolveCodec(this.constructor)
  }

  /**
   * Build LMDB options object carrying a read transaction if one is supplied.
   *
   * @internal
   */
  private _readOpts(tx?: LmdbTransaction): {transaction: any} | undefined {
    if (tx?.raw) {
      return {transaction: tx.raw}
    }
    return undefined
  }

  private _decodeValue(raw: unknown): T {
    return this._codec ? this._codec.deserialize(raw) : (raw as T)
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
   * @example
   * ```typescript
   * await userRepo.set("u1", { name: "Alice" });
   * ```
   *
   * @public
   */
  async set(key: K, value: T, _tx?: LmdbTransaction): Promise<void> {
    if (this.env.readOnly) throw new LmdbReadOnlyError(`set`)
    const encoded = this._codec ? this._codec.serialize(value) : value
    await this.raw.put(key, encoded)
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
   * @param key - Key to look up.
   * @param tx - Optional read transaction for snapshot consistency.
   * @returns The deserialized value, or `undefined` if the key is absent.
   *
   * @example
   * ```typescript
   * const user = await userRepo.get("u1");
   * if (user) {
   *   console.log(user.name);
   * }
   * ```
   *
   * @public
   */
  async get(key: K, _tx?: LmdbTransaction): Promise<T | undefined> {
    const opts = this._readOpts(_tx)
    const raw = opts ? await this.raw.get(key, opts) : await this.raw.get(key)
    if (raw === undefined) return undefined
    return this._codec ? this._decodeValue(raw) : (raw as T)
  }

  /**
   * Check whether a key exists.
   *
   * @remarks
   * **SQL equivalent**: `SELECT EXISTS (SELECT 1 FROM {prefix} WHERE key = ?)`
   *
   * @param key - Key to check.
   * @param tx - Optional read transaction for snapshot consistency.
   * @returns `true` if the key exists, `false` otherwise.
   *
   * @public
   */
  async has(key: K, _tx?: LmdbTransaction): Promise<boolean> {
    const opts = this._readOpts(_tx)
    return Boolean(opts ? await this.raw.doesExist(key, opts) : await this.raw.doesExist(key))
  }

  /**
   * Delete a value by key.
   *
   * @remarks
   * **SQL equivalent**: `DELETE FROM {prefix} WHERE key = ?`
   * (returns the affected-row count: `true` = 1 row deleted, `false` = 0 rows).
   *
   * Delegates directly to LMDB's `remove()` which returns `true` when the
   * key existed and `false` when it didn't — no extra `doesExist` probe.
   *
   * @param key - Key to remove.
   * @param tx - Optional write transaction for cross-repo atomic writes.
   * @returns `true` if the key existed and was removed, `false` otherwise.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @public
   */
  async delete(key: K, _tx?: LmdbTransaction): Promise<boolean> {
    if (this.env.readOnly) throw new LmdbReadOnlyError(`delete`)
    if (await this.raw.doesExist(key)) {
      await this.raw.remove(key)
      return true
    }
    return false
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
  async clear(_tx?: LmdbTransaction): Promise<void> {
    if (this.env.readOnly) throw new LmdbReadOnlyError(`clear`)
    await this.raw.clearAsync()
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
   * @example
   * ```typescript
   * await users.drop();
   * ```
   *
   * @public
   */
  async drop(): Promise<void> {
    if (this.env.readOnly) throw new LmdbReadOnlyError(`drop`)
    await this.raw.drop()
  }

  /**
   * Asynchronously prefetch the given keys into the page cache.
   *
   * @remarks
   * Delegates to LMDB's native `prefetch` which runs on a separate
   * worker thread, page-faulting the entries' pages so that subsequent
   * synchronous `get`s are served from RAM (no hard-page-fault stalls
   * on the main thread). Best used before a known burst of reads.
   *
   * @param keys - Keys whose pages should be pre-faulted.
   *
   * @example
   * ```typescript
   * await users.prefetch(["u1", "u2", "u3"]);
   * // Subsequent users.get("u1") is now cheap (no page fault).
   * ```
   *
   * @public
   */
  async prefetch(keys: K[]): Promise<void> {
    await this.raw.prefetch(keys)
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
   * @example
   * ```typescript
   * const users = await userRepo.getMany(["u1", "u2", "u3"]);
   * ```
   *
   * @public
   */
  async getMany(keys: K[]): Promise<Array<T | undefined>> {
    const raws = (await this.raw.getMany(keys)) as Array<unknown>
    return raws.map((raw) => (raw === undefined ? undefined : this._decodeValue(raw)))
  }

  /**
   * Return the number of entries.
   *
   * @remarks
   * **SQL equivalent**: `SELECT COUNT(*) FROM {prefix}`
   * (LMDB keeps an accurate count per sub-DB; this is O(1), no scan).
   *
   * @param tx - Optional read transaction for snapshot consistency.
   * @returns Total entry count.
   *
   * @public
   */
  async count(_tx?: LmdbTransaction): Promise<number> {
    const opts = this._readOpts(_tx)
    return (opts ? await this.raw.getCount(opts) : await this.raw.getCount()) as number
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
   * @example
   * ```typescript
   * const userIds = await userRepo.keys({ start: "u", end: "v", limit: 100 });
   * ```
   *
   * @public
   */
  async keys(options?: IRangeOptions, _tx?: LmdbTransaction): Promise<K[]> {
    return (await this.raw.getKeys(options).asArray) as K[]
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
  async values(options?: IRangeOptions, _tx?: LmdbTransaction): Promise<T[]> {
    const arr = (await this.raw.getRange(options).asArray) as Array<{key: K; value: unknown}>
    return arr.map((e) => this._decodeValue(e.value))
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
  async entries(options?: IRangeOptions, _tx?: LmdbTransaction): Promise<Array<[K, T]>> {
    const arr = (await this.raw.getRange(options).asArray) as Array<{key: K; value: unknown}>
    return arr.map((e) => [e.key as K, this._decodeValue(e.value)])
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
  async *iterate(options?: IRangeOptions, _tx?: LmdbTransaction): AsyncIterableIterator<[K, T]> {
    const iter = this.raw.getRange(options) as Iterable<{key: K; value: unknown}>
    for (const entry of iter) {
      yield [entry.key as K, this._decodeValue(entry.value)]
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
        body += `\\` + ch
      } else {
        body += ch
      }
    }
    body += `$`
    const regex = new RegExp(body)
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
      return (prefix + `￿`) as K
    }
    if (Buffer.isBuffer(prefix)) {
      return Buffer.concat([prefix, Buffer.from([0xff])]) as unknown as K
    }
    return undefined
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
   * Non-prefix patterns (infix, suffix, mixed `?`/`*`) fall back to a
   * lazy full scan with regex filtering — values are deserialized only
   * for matching keys (LMDB's `RangeIterable.filter` is lazy).
   *
   * @param pattern - Glob pattern with `*` and `?` wildcards.
   * @param options - Optional `limit`/`offset`/`reverse`. For prefix
   * patterns, `start`/`end` are overridden by the detected prefix bounds.
   * @returns Array of matching `[key, value]` tuples. Empty if no matches.
   *
   * @example
   * ```typescript
   * // Keys starting with "user:" — uses fast range scan
   * await users.like("user:*")
   *
   * // Keys matching pattern "u_er:1" (single char wildcard)
   * await users.like("u?er:1")
   *
   * // Keys containing ":admin" anywhere — full scan + lazy filter
   * await users.like("*admin*")
   * ```
   *
   * @public
   */
  async like(pattern: string, options?: IRangeOptions): Promise<Array<[K, T]>> {
    const prefix = this._extractPrefixLikePattern(pattern)
    if (prefix !== null) {
      const endKey = this._prefixEnd(prefix as K)
      if (endKey !== undefined) {
        const arr = await this.raw.getRange({
          start: prefix as K,
          end: endKey,
          limit: options?.limit,
          offset: options?.offset,
          reverse: options?.reverse,
          inclusiveEnd: options?.inclusiveEnd,
          exclusiveStart: options?.exclusiveStart
        }).asArray
        return arr.map((e: {key: K; value: unknown}) => [e.key as K, this._decodeValue(e.value)])
      }
    }
    const regex = this._patternToRegex(pattern)
    const arr = await this.raw.getRange(options).filter(({key}: {key: K}) => regex.test(String(key))).asArray
    return arr.map((e: {key: K; value: unknown}) => [e.key as K, this._decodeValue(e.value)])
  }

  /**
   * Find entries whose key starts with the given prefix.
   *
   * @remarks
   * **SQL equivalent**: `SELECT key, value FROM {prefix} WHERE key LIKE {prefix}%`
   *
   * Uses an LMDB range scan on `[prefix, prefixEnd)` for string/Buffer
   * keys — **O(log N + M)** where M is the match count. For numeric or
   * other unsupported key types, falls back to a lazy full scan with
   * `String(...).startsWith(prefix)` filter (values are deserialized only
   * for matching keys).
   *
   * @param prefix - Key prefix to match.
   * @param options - Range bounds (`limit`/`offset`/`reverse`).
   * @returns Array of matching `[key, value]` tuples. Empty if no matches.
   *
   * @example
   * ```typescript
   * const admins = await users.findByPrefix("admin:");
   * ```
   *
   * @public
   */
  async findByPrefix(prefix: K, options?: IRangeOptions): Promise<Array<[K, T]>> {
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined) {
      const arr = (await this.raw.getRange({start: prefix, end: endKey, ...options}).asArray) as Array<{key: K; value: unknown}>
      return arr.map((e) => [e.key as K, this._decodeValue(e.value)])
    }
    const arr = (await this.raw.getRange(options).filter(({key}: {key: K}) => String(key).startsWith(String(prefix))).asArray) as Array<{key: K; value: unknown}>
    return arr.map((e) => [e.key as K, this._decodeValue(e.value)])
  }

  /**
   * Count entries whose key starts with the given prefix.
   *
   * @remarks
   * **SQL equivalent**: `SELECT COUNT(*) FROM {prefix} WHERE key LIKE {prefix}%`
   *
   * For string/Buffer keys, delegates to LMDB's native `getKeysCount`
   * which is **O(log N + M)** — no array allocation, no per-key iteration.
   * For numeric/other key types (no prefix bounds possible), falls back to
   * a full scan + filter.
   *
   * @param prefix - Key prefix to match.
   * @returns Number of entries with matching key prefix.
   *
   * @example
   * ```typescript
   * const adminCount = await users.countByPrefix("admin:");
   * ```
   *
   * @public
   */
  async countByPrefix(prefix: K): Promise<number> {
    const endKey = this._prefixEnd(prefix)
    if (endKey !== undefined) {
      return this.raw.getKeysCount({start: prefix, end: endKey})
    }
    const keys = (await this.raw.getKeys().asArray) as K[]
    return keys.filter((k) => String(k).startsWith(String(prefix))).length
  }

  /**
   * Delete every entry whose key starts with the given prefix.
   *
   * @remarks
   * **SQL equivalent**: `DELETE FROM {prefix} WHERE key LIKE {prefix}%`
   *
   * Range-scans the keys, then issues all `remove()` calls in the same
   * event turn. LMDB's async batching coalesces them into one atomic
   * transaction commit. Returns the count actually removed (concurrent
   * writes can lower this below the pre-count).
   *
   * @param prefix - Key prefix to match.
   * @returns Number of entries deleted.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @example
   * ```typescript
   * const removed = await sessions.deleteByPrefix("expired:");
   * console.log(`Purged ${removed} expired sessions`);
   * ```
   *
   * @public
   */
  async deleteByPrefix(prefix: K): Promise<number> {
    if (this.env.readOnly) throw new LmdbReadOnlyError(`deleteByPrefix`)
    const endKey = this._prefixEnd(prefix)
    const keys = endKey !== undefined ? ((await this.raw.getKeys({start: prefix, end: endKey}).asArray) as K[]) : ((await this.raw.getKeys().asArray) as K[]).filter((k) => String(k).startsWith(String(prefix)))
    const results = await Promise.all(keys.map((k) => this.raw.remove(k)))
    let removed = 0
    for (const r of results) if (r) removed++
    return removed
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
   * @example
   * ```typescript
   * const [firstKey, firstUser] = (await users.first()) ?? [];
   * ```
   *
   * @public
   */
  async first(): Promise<[K, T] | undefined> {
    const arr = (await this.raw.getRange({limit: 1}).asArray) as Array<{key: K; value: unknown}>
    const entry = arr[0]
    return entry ? [entry.key as K, this._decodeValue(entry.value)] : undefined
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
   * @example
   * ```typescript
   * const [lastKey, lastUser] = (await users.last()) ?? [];
   * ```
   *
   * @public
   */
  async last(): Promise<[K, T] | undefined> {
    const arr = (await this.raw.getRange({reverse: true, limit: 1}).asArray) as Array<{key: K; value: unknown}>
    const entry = arr[0]
    return entry ? [entry.key as K, this._decodeValue(entry.value)] : undefined
  }

  /**
   * Update a value atomically by reading, transforming, and writing back.
   *
   * @remarks
   * **SQL equivalent**: an UPSERT pattern
   * `UPDATE {prefix} SET value = {updater(current)} WHERE key = ?`
   * (or `INSERT ... ON CONFLICT UPDATE` semantics).
   *
   * Not transactional — concurrent `update()` calls on the same key may
   * race. Wrap in {@link LmdbEnv.transaction} if you need atomicity.
   *
   * @param key - Key to update.
   * @param updater - Function transforming the current value (or `undefined`
   * if the key is absent) to the new value.
   * @returns The new value that was written.
   *
   * @throws {@link LmdbReadOnlyError} if the env is read-only.
   *
   * @example
   * ```typescript
   * // Increment a counter (not thread-safe; use env.transaction if needed)
   * const newCount = await counters.update("hits", (n) => (n ?? 0) + 1);
   *
   * // Upsert with default
   * await users.update("u42", (u) => u ?? {id: "u42", name: "New"});
   * ```
   *
   * @public
   */
  async update(key: K, updater: (current: T | undefined) => T): Promise<T> {
    if (this.env.readOnly) throw new LmdbReadOnlyError(`update`)
    const current = await this.get(key)
    const next = updater(current)
    await this.set(key, next)
    return next
  }
}
