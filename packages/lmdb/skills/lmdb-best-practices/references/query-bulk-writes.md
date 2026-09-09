# query-bulk-writes

Batch writes in chunks; never N+1 the write path.

## Why

`putMany` commits in one transaction per 500-row chunk (chunked, TTL- and index-aware). Single puts each schedule their own flush. Prefix deletes run in one transaction with sync removes.

## Incorrect

```typescript
// N independent flushes, N promises, no atomicity
for (const [k, v] of rows) await users.put(k, v)
await users.deleteByPrefix(``) // throws LmdbEmptyPrefixError — use clear()
```

## Correct

```typescript
await users.putMany(rows) // chunked single-txn batches
await users.putMany(rows, 1000) // explicit chunk size
await users.deleteByPrefix(`tmp:`) // one txn, returns removed count
await users.clear() // empty the sub
await users.putIfNotExists(k, v) // native conditional, no read-then-write race
await counters.increment(`seq`) // atomic read-then-write in one txn
```

## Notes

- `putMany` honors schema TTL envelopes and index maintenance exactly like `put`.
- Read-then-write outside a transaction races — wrap in `env.transaction()` with a sync callback.
- `increment`/`putBinary` are rejected on indexed subs (would stale the index).
