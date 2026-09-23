import {compareKeys} from "lmdb"
import {LmdbError} from "./errors"
import type {KeyOf, LmdbSchema, ValueOf} from "./schema"
import type {LmdbEnvSub} from "./sub"
import type {ISyncOptions, ISyncResult} from "./types/sync"

export type {ISyncOptions, ISyncResult} from "./types/sync"

/**
 * Sub-DB holding per-stream sync cursors.
 *
 * @remarks
 * Keyed `sync:<name>` inside `__sync_state`; each committed chunk advances
 * the cursor so killed runs resume mid-stream.
 */
const SYNC_STATE_DB = `__sync_state`
/**
 * Rows per copy transaction.
 */
const SYNC_CHUNK = 500
/**
 * Hash spot-checks per verify.
 */
const VERIFY_SAMPLES = 8

/**
 * Differential env-to-env sync for `@gramstax/lmdb`.
 *
 * @remarks
 * `LmdbSyncStream` copies rows past a checkpoint through a keyset cursor in
 * 500-row chunks: each chunk commits to the destination via `putMany`
 * (indexes, search, CDC, TTL ride along), then the cursor persists to
 * `__sync_state` under the stream name — so a killed run resumes mid-stream
 * instead of restarting. Source iteration order is natively ascending, so
 * destination writes ride `{sorted: true}` appends. An explicit
 * `checkpoint` option runs one-shot past that key without touching the
 * stored cursor. Sync copies upsert-style and never deletes destination-only
 * rows; quiesce writes on both subs before syncing (concurrent writes
 * defeat the verify step by design).
 *
 * Sync helpers ride as statics on this class; a run threads six pieces
 * of state — source, destination, options, cursor, counters,
 * exhaustion — across paged async iterations. Construct per run;
 * instances are single-use.
 *
 * @public
 */
export class LmdbSyncStream<S extends typeof LmdbSchema> {
  /**
   * Create a sync stream for one run (instances are single-use).
   *
   * @param source - Sub to copy from.
   * @param dest - Sub to copy to (same schema class, any env; must differ).
   * @param options - `{name?, checkpoint?, limit?, verify?}`.
   */
  constructor(
    private readonly source: LmdbEnvSub<S>,
    private readonly dest: LmdbEnvSub<S>,
    private readonly options?: ISyncOptions<S>
  ) {}

  /**
   * Canonicalize a row value to a stable string for hashing.
   *
   * @remarks
   * Sorts object keys and map entries, normalizes dates/binary/sets/bigints,
   * so equal rows stringify equal regardless of materialized key order.
   *
   * @param value - The value to canonicalize.
   * @returns The canonical string form.
   */
  private static _canonical(value: unknown): string {
    if (value === null) return `null`
    if (value === undefined) return `undefined`
    if (typeof value === `string`) return JSON.stringify(value)
    if (typeof value === `number` || typeof value === `boolean`) return `${typeof value}:${String(value)}`
    if (typeof value === `bigint`) return `bigint:${String(value)}`
    if (value instanceof Date) {
      const time = value.getTime()
      return Number.isNaN(time) ? `date:invalid` : `date:${value.toISOString()}`
    }
    if (value instanceof Uint8Array) return `bin:${Buffer.from(value).toString(`hex`)}`
    if (Array.isArray(value)) return `[${value.map((entry) => LmdbSyncStream._canonical(entry)).join(`,`)}]`
    if (value instanceof Map) {
      const pairs = [...value.entries()].map(([k, v]): [string, string] => [LmdbSyncStream._canonical(k), LmdbSyncStream._canonical(v)])
      pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      return `map:{${pairs.map(([k, v]) => `${k}:${v}`).join(`,`)}}`
    }
    if (value instanceof Set) {
      return `set:[${[...value]
        .map((entry) => LmdbSyncStream._canonical(entry))
        .sort()
        .join(`,`)}]`
    }
    if (typeof value === `object`) {
      const record = value as Record<string, unknown>
      const keys = Object.keys(record).sort()
      return `{${keys.map((k) => `${JSON.stringify(k)}:${LmdbSyncStream._canonical(record[k])}`).join(`,`)}}`
    }
    return `${typeof value}:${String(value)}`
  }

  /**
   * FNV-1a 32-bit hash of canonical text.
   *
   * @param text - Canonical row text.
   * @returns The unsigned 32-bit hash.
   */
  private static _fnv1a(text: string): number {
    let hash = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
  }

  /**
   * Read the persisted cursor for a stream.
   *
   * @param source - Sub whose owner holds the `__sync_state` sub-DB.
   * @param name - Stream name.
   * @returns The stored cursor key, or `undefined` when never synced.
   */
  private static _readCheckpoint<S extends typeof LmdbSchema>(source: LmdbEnvSub<S>, name: string): KeyOf<S> | undefined {
    const state = source.owner.getDb(SYNC_STATE_DB)
    return state.get(`sync:${name}`) as KeyOf<S> | undefined
  }

  /**
   * Persist the cursor for a stream.
   *
   * @param source - Sub whose owner holds the `__sync_state` sub-DB.
   * @param name - Stream name.
   * @param key - Last copied key.
   */
  private static _writeCheckpoint<S extends typeof LmdbSchema>(source: LmdbEnvSub<S>, name: string, key: KeyOf<S>): void {
    source.owner.getDb(SYNC_STATE_DB).putSync(`sync:${name}`, key)
  }

  /**
   * Verify a destination mirrors its source: counts plus hash spot-checks.
   *
   * @remarks
   * Counts compare O(1); then up to 8 evenly-strided rows compare by hash
   * (stride spread catches tail divergence that head-only sampling would
   * miss on delta syncs). Throws on the first mismatch — quiesce writes
   * before syncing.
   *
   * @param source - Sub to verify from.
   * @param dest - Sub to verify against.
   */
  private static async _verify<S extends typeof LmdbSchema>(source: LmdbEnvSub<S>, dest: LmdbEnvSub<S>): Promise<void> {
    const sourceCount = source.count()
    const destCount = dest.count()
    if (sourceCount !== destCount) {
      throw new LmdbError(`sync verify failed for '${source.schemaClass.db}': source has ${sourceCount} rows but destination has ${destCount} — quiesce writes, clear the destination, and re-run under a fresh stream name`)
    }
    if (sourceCount === 0) return
    const stride = Math.max(1, Math.floor(sourceCount / VERIFY_SAMPLES))
    let taken = 0
    let index = 0
    for await (const [key] of source.iterate()) {
      if (index % stride === 0 && taken < VERIFY_SAMPLES) {
        const left = LmdbSyncStream.hashRowValue(source.get(key))
        const right = LmdbSyncStream.hashRowValue(dest.get(key))
        if (left !== right) {
          throw new LmdbError(`sync verify failed for '${source.schemaClass.db}': row hash mismatch at key '${String(key)}'`)
        }
        taken++
      }
      index++
    }
  }

  /**
   * Deterministic hash of a row value for sync verification.
   *
   * @remarks
   * Canonicalizes key order, dates, binary, maps, sets, and bigints before
   * hashing, so equal rows hash equal across envs regardless of materialized
   * key order. Pure and total over row-shaped values.
   *
   * @param value - The decoded row.
   * @returns An unsigned 32-bit hash.
   * @public
   */
  static hashRowValue(value: unknown): number {
    return LmdbSyncStream._fnv1a(LmdbSyncStream._canonical(value))
  }

  /**
   * Copy rows past the checkpoint through a keyset cursor in 500-row chunks.
   *
   * @remarks
   * Each committed chunk advances the persisted cursor, so kills resume
   * mid-stream. An explicit `checkpoint` runs one-shot without touching the
   * stored cursor. Destination writes use `{sorted: true}` appends (source
   * order is natively ascending). Sync upserts — destination-only rows are
   * never deleted.
   *
   * @returns `{copied, checkpoint, verified}`.
   * @throws {LmdbError} On self-sync and verify divergence.
   */
  async run(): Promise<ISyncResult<S>> {
    if (this.source === this.dest) throw new LmdbError(`cannot sync a sub to itself`)
    const name = this.options?.name ?? this.dest.schemaClass.db
    const verify = this.options?.verify !== false
    const limit = typeof this.options?.limit === `number` && Number.isFinite(this.options.limit) ? this.options.limit : undefined
    if (limit !== undefined && limit <= 0) return {copied: 0, checkpoint: undefined, verified: false}
    const bound = this.options?.checkpoint ?? LmdbSyncStream._readCheckpoint(this.source, name)
    let start: KeyOf<S> | undefined = bound
    let copied = 0
    let checkpoint: KeyOf<S> | undefined
    let exhausted = false
    for (;;) {
      if (limit !== undefined && copied >= limit) break
      const take = limit === undefined ? SYNC_CHUNK : Math.min(SYNC_CHUNK, limit - copied)
      const page = await this.source.entries(start === undefined ? {limit: take} : {start, limit: take})
      if (page.length === 0) {
        exhausted = true
        break
      }
      let rows = page
      if (start !== undefined && page.length > 0 && compareKeys(page[0]![0], start) === 0) rows = page.slice(1)
      if (rows.length === 0) {
        exhausted = page.length < take
        break
      }
      const chunk = rows as Array<[KeyOf<S>, ValueOf<S>]>
      await this.dest.putMany(chunk, SYNC_CHUNK, {sorted: true})
      copied += chunk.length
      const lastKey = chunk[chunk.length - 1]![0]
      checkpoint = lastKey
      if (this.options?.checkpoint === undefined) LmdbSyncStream._writeCheckpoint(this.source, name, lastKey)
      start = lastKey
      if (page.length < take) {
        exhausted = true
        break
      }
    }
    let verified = false
    if (verify && exhausted) {
      await LmdbSyncStream._verify(this.source, this.dest)
      verified = true
    }
    return {copied, checkpoint, verified}
  }
}
