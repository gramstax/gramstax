# index-maintenance

Indexes maintain themselves — except when they must not.

## Why

`put`/`putMany`/`putIfNotExists`/`delete`/`deleteByPrefix`/`clear` all maintain index rows in the writer transaction; `purgeExpired` cleans them with the record; updates free the old value. The only manual operation is `reindex()` after out-of-band changes.

## Incorrect

```typescript
// hand-maintaining a parallel lookup table next to an embedded index
await users.put(id, row)
await lookup.put(row.email, id) // drifts on every missed path
```

## Correct

```typescript
await users.put(id, row) // index rows commit atomically with the primary
await users.reindex() // → {built, skipped}; collisions land in skipped
await users.reindex(`email`) // single index rebuild
```

## Notes

- Every embedded-index sub-DB (unique and non-unique alike) is created with `useVersions: false` — LMDB forbids dupSort+versions.
- Extractors run on the unwrapped value for TTL subs.
- Self-update (same key, same value) is allowed through unique indexes.
- Composite tuple rows maintain exactly like single-column rows (put/delete/clear/reindex); search posting tables (`search.md`) follow the same same-txn rule.
