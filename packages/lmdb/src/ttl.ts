/**
 * LmdbTtlRepository — TTL wrapper via envelope with lazy expiry.
 *
 * @remarks
 * Stores `{v, exp?}` envelopes. `exp` is absolute epoch ms. Reads via
 * `get`/`has` check `Date.now()` and treat expired entries as missing
 * (deleted lazily, or via `purgeExpired`). The check is deterministic per
 * process — no timers — so it stays correct across multiple processes.
 * Overwriting a key resets its TTL. Define a repository-wide default via
 * `static ttlMs` — per-call `ttlMs` overrides it.
 *
 * @packageDocumentation
 * @public
 */

import {LmdbRepository} from "./repository"
import {LmdbTransaction} from "./transaction"
import type {ILmdbKey} from "./types"

type TtlEnvelope<T> = {v: T; exp?: number}

/**
 * Repository with per-record TTL via envelope.
 *
 * @remarks
 * Define a default TTL once per repository class via `static ttlMs`.
 * Per-call `ttlMs` (number or `{ttlMs}`) overrides the class default.
 * Priority: `put(..., {ttlMs})` / `put(..., ttlMs)` → `static ttlMs` → never expires.
 * Overwriting a key resets its TTL.
 *
 * @typeParam T - Logical value type.
 * @typeParam K - Key type.
 *
 * @public
 */
export class LmdbTtlRepository<T, K extends ILmdbKey = string> extends LmdbRepository<unknown, K> {
  /**
   * Default TTL for this repository (ms). Optional — when omitted, records
   * without an explicit per-call TTL never expire. Define per subclass:
   * `static ttlMs = 60_000`.
   *
   * @virtual
   * @public
   */
  static ttlMs?: number

  /**
   * Store a value with optional TTL.
   *
   * @remarks
   * Priority: per-call `ttlMs` (if provided) → class `static ttlMs` → never expires.
   *
   * @param key - Key to write under.
   * @param value - Logical value to store.
   * @param ttlOrTx - Either a TTL (`number` or `{ttlMs}`) or a transaction.
   * When a TTL, it overrides the class default. Omitted → falls back to
   * `static ttlMs`, then never expires. Transaction is ignored — TTL sets
   * join the current writer transaction automatically via LMDB batching.
   */
  override async put(key: K, value: T, ttlOrTx?: unknown): Promise<void> {
    let ttlMs: number | undefined
    if (ttlOrTx instanceof LmdbTransaction) ttlMs = undefined
    else if (typeof ttlOrTx === `number`) ttlMs = ttlOrTx
    else if (ttlOrTx && typeof (ttlOrTx as {ttlMs?: unknown}).ttlMs === `number`) {
      ttlMs = (ttlOrTx as {ttlMs: number}).ttlMs
    }
    if (ttlMs === undefined) {
      const ctorTtl = (this.constructor as unknown as {ttlMs?: number}).ttlMs
      if (typeof ctorTtl === `number` && ctorTtl > 0) ttlMs = ctorTtl
    }
    const exp = typeof ttlMs === `number` && ttlMs > 0 ? Date.now() + ttlMs : undefined
    const envelope: TtlEnvelope<T> = exp !== undefined ? {v: value, exp} : {v: value}
    return super.put(key, envelope as unknown as unknown)
  }

  /**
   * Retrieve a value, treating expired entries as missing.
   *
   * @param key - Key to look up.
   * @param _tx - Optional transaction (ignored — reads check wall-clock).
   * @returns The logical value, or `undefined` if missing or expired.
   */
  override get(key: K, _tx?: LmdbTransaction): T | undefined {
    const envelope = super.get(key) as TtlEnvelope<T> | undefined
    if (!envelope) return undefined
    if (envelope.exp !== undefined && Date.now() > envelope.exp) {
      void super.delete(key)
      return undefined
    }
    return envelope.v
  }

  /**
   * Retrieve a value, throwing if missing or expired.
   *
   * @throws {@link LmdbKeyNotFoundError} if the key is absent or expired.
   */
  override getStrict(key: K, _tx?: LmdbTransaction): T {
    const v = this.get(key)
    if (v === undefined) {
      const {LmdbKeyNotFoundError} = require("./errors") as typeof import("./errors")
      throw new LmdbKeyNotFoundError((this.constructor as typeof LmdbRepository).dbName, key)
    }
    return v
  }

  /**
   * Check existence — expired entries count as absent.
   */
  override has(key: K, _tx?: LmdbTransaction): boolean {
    const envelope = super.get(key) as TtlEnvelope<T> | undefined
    if (!envelope) return false
    if (envelope.exp !== undefined && Date.now() > envelope.exp) {
      void super.delete(key)
      return false
    }
    return true
  }

  /**
   * Remove expired entries and return the number removed.
   *
   * @returns Number of entries purged.
   */
  async purgeExpired(): Promise<number> {
    this.env.assertOpen()
    const entries = await super.entries()
    let removed = 0
    const now = Date.now()
    for (const [k, envelope] of entries as unknown as Array<[K, TtlEnvelope<T>]>) {
      if (envelope.exp !== undefined && now > envelope.exp) {
        // delete is async but we await each to keep count accurate
        // (could batch via transaction, but S scope keeps it simple)
        const ok = await super.delete(k)
        if (ok) removed++
      }
    }
    return removed
  }
}
