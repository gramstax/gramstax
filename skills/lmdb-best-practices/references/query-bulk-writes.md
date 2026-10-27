# query-bulk-writes

Batch writes in chunks; never N+1 the write path.

## Why

`putMany` commits in one transaction per 500-row chunk (chunked, TTL- and index-aware). Single puts each schedule their own flush. Prefix deletes run in one transaction with sync removes.

## Chunking decision table

`putMany(entries, chunkSize?, {sorted?, onProgress?})` (`sub.ts`) is the bulk path. Pick the row by what the producer guarantees:

| Situation | Call | Why |
| --- | --- | --- |
| Any order, any size | `putMany(rows)` | Default 500-row chunks — one transaction per chunk, never one flush per row |
| Known memory budget | `putMany(rows, 1000)` | Explicit chunk size — bigger chunks commit less often, smaller chunks hold less dirty state |
| Keys already ascending | `putMany(rows, 500, {sorted: true})` | MDB_APPEND fast path (~7x at 100k) — skips the B-tree search per put |
| Newline-delimited import | `importJSONL(lines, {sorted?, onProgress?})` | Parses `[key, value]` pairs per line, reports per committed chunk, returns rows imported |
| Conditional single | `putIfNotExists(k, v)` | Native conditional put — no read-then-write race |
| Hot counter | `counters.increment(`seq`)` | Atomic read-then-write in one txn — but only on a non-indexed sub |

Chunking bounds the failure too: a bad row aborts its chunk, not the whole import.

## `{sorted}` preconditions and the inversion error

`{sorted: true}` is a contract with LMDB, not a hint — claim it only when the producer guarantees ascending keys (migration backfill sorted by key, sync stream):

- Keys must be strictly ascending — non-decreasing for dupSort primaries (`appendDup` instead of `append`)
- Order is checked with storage-order comparison before writing, so the first inversion throws `LmdbError` before anything is written
- An unsorted input with `{sorted: true}` therefore fails whole, not half — fix the producer order, do not retry the same array
- When in doubt, omit `{sorted}` — plain `putMany` is still chunked single-transaction batches, just without the append fast path
- `{onProgress}` fires per committed chunk for both `putMany` and `importJSONL`, so progress bars track durable work

## Incorrect

```typescript
// wrong: N independent flushes, N promises, no atomicity
for (const [k, v] of rows) await users.put(k, v)
```

```typescript
// wrong: empty prefix rejects with LmdbError — it would mean "delete everything unguarded"
await users.deleteByPrefix(``)
```

```typescript
// wrong: keys are not ascending, so the first inversion throws and nothing is written
await users.putMany(shuffled, 500, {sorted: true})
```

## Correct

```typescript
// chunked single-txn batches — TTL envelopes and index rows maintained per entry
await users.putMany(rows)
```

```typescript
// explicit chunk size for a known memory budget
await users.putMany(rows, 1000)
```

```typescript
// MDB_APPEND fast path — ~7x at 100k, valid only because the producer sorts by key
await users.putMany(ordered, 500, {sorted: true})
```

```typescript
// bulk import with durable progress — onProgress fires per committed chunk
await users.importJSONL(lines, {sorted: true, onProgress: (done, total) => {}})
```

```typescript
// one transaction, returns the removed count — clear() empties the whole sub
await users.deleteByPrefix(`tmp:`)
await users.clear()
```

```typescript
// native conditional put and atomic counter — no read-then-write race
await users.putIfNotExists(k, v)
await counters.increment(`seq`)
```

## Notes

- `putMany` honors schema TTL envelopes and index maintenance exactly like `put`.
- Read-then-write outside a transaction races — wrap in `env.transaction()` with a sync callback.
- `increment`/`decrement`/`putBinary` are rejected on indexed/search subs (would stale the index). Raw buffers ride `putBinary(key, buf)` / `getBinary(key)` / `getBinaryFast(key)`.
- `{sorted: true}` needs strictly ascending keys (non-decreasing for dupSort) — first inversion throws `LmdbError` before anything is written.
- Locked by `test/repository.bulk.test.ts` (chunking, guards, progress) and `test/bulk-sorted.test.ts` (append path, inversion error).
- Sibling rules: `query-index-reads.md` (how to read the bulk back), `index-maintenance.md` (what `putMany` maintains per entry), `index-write-cost.md` (why hot counters live apart).
