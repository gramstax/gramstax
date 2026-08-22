/**
 * NonUniqueIndex — declarative non-unique secondary index over a primary repository.
 *
 * @remarks
 * LMDB has no engine-level secondary indexes (unlike Postgres `CREATE INDEX`). This helper
 * maintains a `dupSort` index repository mapping `extractor(primaryValue) -> primaryKey`.
 * `dupSort = true` is required because one indexed value maps to many primary keys
 * (e.g. `shared@example.com -> [u1, u2]`), exactly like SQL `CREATE INDEX` (non-unique) vs
 * `CREATE UNIQUE INDEX`. The index repo **must** be declared with `static dupSort = true` —
 * the constructor validates this and throws otherwise. Writes to primary and index are batched
 * in one LMDB writer transaction (`env.transaction`), so concurrent writers cannot leave them
 * inconsistent. Reads via `findByIndex` fan out through `getValues` + `get`.
 *
 * SQL analogy: `NonUniqueIndex` ≈ `CREATE INDEX idx ON users(email)` (allows duplicates).
 * For a unique secondary (1 email = 1 user), use a separate `LmdbRepository` with `dupSort: false`
 * and a `UniqueIndex` helper (not this class).
 *
 * @packageDocumentation
 * @public
 */

import type {LmdbEnv} from "./env"
import {LmdbError} from "./errors"
import type {LmdbRepository} from "./repository"
import type {ILmdbKey} from "./types"

/**
 * Maintains a non-unique secondary index for a primary repository.
 *
 * @remarks
 * Requires the index repository to be `dupSort: true` — validated in the constructor.
 * If you need a unique secondary (1:1), do not use this class; use a plain
 * `LmdbRepository` with `dupSort: false` and `put` semantics.
 *
 * @typeParam PrimaryT - Value type of the primary repository.
 * @typeParam PrimaryK - Key type of the primary repository.
 * @typeParam IndexKey - Indexed field value type (key type of the index repo).
 *
 * @public
 */
export class NonUniqueIndex<PrimaryT, PrimaryK extends ILmdbKey, IndexKey extends ILmdbKey> {
  /**
   * @param env - Owning env (provides the writer transaction).
   * @param primary - Primary repository (e.g. User by id).
   * @param index - Index repository — **must** be `dupSort: true` (e.g. email -> id). Validated.
   * @param extractor - Maps a primary value to its indexed field value.
   *
   * @throws {@link LmdbError} if `index` is not `dupSort: true`.
   */
  constructor(
    private readonly env: LmdbEnv,
    private readonly primary: LmdbRepository<PrimaryT, PrimaryK>,
    private readonly index: LmdbRepository<PrimaryK, IndexKey>,
    private readonly extractor: (value: PrimaryT) => IndexKey
  ) {
    const ctor = this.index.constructor as unknown as {dupSort?: boolean; name?: string}
    if (!ctor.dupSort) {
      throw new LmdbError(`NonUniqueIndex requires index repo with static dupSort = true (got ${String(ctor.name ?? `unknown`)} dupSort=${String(ctor.dupSort)}). Use dupSort: true for non-unique secondary index (SQL: CREATE INDEX), like EmailIndexRepo in the example.`)
    }
  }

  /**
   * Store a primary record and update the index atomically.
   *
   * @param key - Primary key.
   * @param value - Primary value.
   */
  async put(key: PrimaryK, value: PrimaryT): Promise<void> {
    await this.env.transaction(() => {
      const existing = this.primary.get(key)
      if (existing !== undefined) {
        const oldIdx = this.extractor(existing)
        const newIdx = this.extractor(value)
        if (oldIdx !== newIdx) {
          const idxEnv = (this.index as unknown as {env: {put: (k: unknown, v: unknown) => Promise<boolean>; remove: (k: unknown, v: unknown) => Promise<boolean>}}).env
          void idxEnv.remove(oldIdx as unknown as string, key as unknown as string)
          void idxEnv.put(newIdx as unknown as string, key as unknown as string)
        }
      } else {
        const newIdx = this.extractor(value)
        const idxEnv = (this.index as unknown as {env: {put: (k: unknown, v: unknown) => Promise<boolean>}}).env
        void idxEnv.put(newIdx as unknown as string, key as unknown as string)
      }
      void this.primary.put(key, value)
    })
  }

  /**
   * Remove a primary record and its index entry atomically.
   *
   * @param key - Primary key to remove.
   * @returns `true` if the primary existed and was removed.
   */
  async remove(key: PrimaryK): Promise<boolean> {
    return this.env.transaction(() => {
      const existing = this.primary.get(key)
      if (existing === undefined) return false
      const idx = this.extractor(existing)
      const idxEnv = (this.index as unknown as {env: {remove: (k: unknown, v: unknown) => Promise<boolean>}}).env
      void idxEnv.remove(idx as unknown as string, key as unknown as string)
      void this.primary.delete(key)
      return true
    })
  }

  /**
   * Find all primary records whose indexed field equals `indexKey`.
   *
   * @param indexKey - Indexed field value to look up.
   * @returns Array of primary values — empty if none match.
   */
  async findByIndex(indexKey: IndexKey): Promise<PrimaryT[]> {
    const pks = await (this.index as unknown as {getValues: (k: IndexKey) => Promise<PrimaryK[]>}).getValues(indexKey)
    const out: PrimaryT[] = []
    for (const pk of pks) {
      const v = this.primary.get(pk)
      if (v !== undefined) out.push(v)
    }
    return out
  }
}

/**
 * @deprecated Use `NonUniqueIndex` — kept for backwards compatibility. Will be removed in 1.0.
 */
export const SecondaryIndex = NonUniqueIndex
