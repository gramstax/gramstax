# index-maintenance

Indexes maintain themselves — except when they must not.

## Why

`put`/`putMany`/`putIfNotExists`/`delete`/`deleteByPrefix`/`clear` all maintain index rows in the writer transaction; `purgeExpired` cleans them with the record; updates free the old value. The only manual operation is `reindex()` after out-of-band changes.

## Maintenance coverage matrix

Every write path maintains every index kind — there is no path where the primary commits and the index lags, because both land in the same writer transaction:

| Operation | Unique index | Non-unique index | Composite | Search postings |
| --- | --- | --- | --- | --- |
| `put` (insert) | point-check + insert | insert | tuple insert | postings per token |
| `put` (update) | old-row free + point-check + insert | old-row free + insert | old tuple free + new insert | stale freed + fresh per token |
| `putMany` / `putIfNotExists` | maintained per entry | maintained per entry | maintained per entry | maintained per entry |
| `delete` | row removed | row removed | tuple removed | postings removed |
| `deleteByPrefix` / `clear` | rows of every deleted record removed | rows of every deleted record removed | tuples of every deleted record removed | postings of every deleted record removed |
| `purgeExpired` (TTL) | removed with the record | removed with the record | removed with the record | removed with the record |
| `increment` / `decrement` / `putBinary` | rejected (`LmdbError`) | rejected (`LmdbError`) | rejected (`LmdbError`) | rejected (`LmdbError`) |

Two consequences. First, hand-rolled parallel lookup tables are pure liability: every path above already syncs the embedded index, so a manual table only adds a surface that drifts on the first missed path. Second, the rejection row is load-bearing — the three bypass writes are refused exactly because they would break the matrix, so counters live in a separate non-indexed sub (`index-write-cost.md`).

## `reindex()`: the one manual operation

`reindex(name?)` (`sub.ts`) rebuilds from primary data — reach for it after out-of-band changes (a restore, a file-level copy, a version upgrade that touched stored rows):

- `reindex()` rebuilds every index and resolves `{built, skipped}`
- `reindex(`email`)` rebuilds one index — an embedded index, a searched column, or both
- Unique collisions land in `skipped` (key, index, value per record) rather than failing the rebuild — inspect the list instead of retrying blind
- TTL repos reindex from the unwrapped value, exactly like the write path
- Nothing else needs a manual pass — if the data changed through the sub API, the matrix above already covered it

## dupSort and versions do not mix

Every embedded-index sub-DB (unique and non-unique alike) is created with `useVersions: false` (`sub-manager.ts`) — LMDB rejects `dupSort` combined with versions, so the opt-out is unconditional rather than per-index. Do not set `useVersions: true` expecting versioned index rows; the construction opts already settled it.

## Incorrect

```typescript
// wrong: hand-rolled parallel table next to an embedded index — drifts on the first missed path
await users.put(id, row)
await lookup.put(row.email, id)
```

```typescript
// wrong: retrying the same rebuild without reading skipped — the collisions come back every time
await users.reindex()
await users.reindex()
```

## Correct

```typescript
// index rows commit atomically with the primary — no second write exists
await users.put(id, row)
```

```typescript
// full rebuild after out-of-band changes — collisions land in skipped, not in a throw
const {built, skipped} = await users.reindex()
for (const hit of skipped) console.log(hit.key, hit.index)
```

```typescript
// single index rebuild — embedded index, searched column, or both
await users.reindex(`email`)
```

```typescript
// TTL-aware by construction — the extractor runs on the unwrapped value either way
await sessions.put(`s1`, {userId: `u1`}, {ttlMs: 80})
await sessions.purgeExpired() // index rows leave with the record
```

## Notes

- Every embedded-index sub-DB (unique and non-unique alike) is created with `useVersions: false` — LMDB forbids dupSort+versions.
- Extractors run on the unwrapped value for TTL subs.
- Self-update (same key, same value) is allowed through unique indexes.
- Composite tuple rows maintain exactly like single-column rows (put/delete/clear/reindex); search posting tables (`search.md`) follow the same rule — written in the same transaction as the primary row.
- Locked by `test/index-embedded.test.ts` (atomic maintenance, `reindex` shape) + `test/ttl.test.ts` (unwrapped extractor, `purgeExpired` cleanup) and `test/non-unique-index.test.ts` (bulk-delete cleanup).
- Sibling rules: `index-declaration.md` (which tables exist), `index-write-cost.md` (what the matrix costs per write), `query-bulk-writes.md` (bulk paths ride the same matrix), `search.md` (posting-table specifics).
