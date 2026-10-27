# query-count

Count from stat, not from walks — and know which count you need.

## Why

`count()` reads the O(1) `mdb_stat` entry count (flat across DB sizes; proven to 200k rows). `countByPrefix()` walks the range (O(matches)) — correct, but linear by nature. An earlier cursor-walk `count()` was replaced after scaling tests proved O(n).

## Which count to reach for

Three questions, three answers. The wrong one is usually materializing rows to read an array length — a number the engine already knows, delivered with a full decode plus a guardrail trip past 100k rows.

| Question | Call | Cost | Notes |
| --- | --- | --- | --- |
| How many rows total? | `count()` | O(1) `mdb_stat` via `getStats()`, sync (`sub.ts:757`) | hot-loop safe, flat across DB sizes |
| How many rows under a prefix? | `countByPrefix(prefix)` | O(matches) range walk | returns a number — nothing materialized, never guarded |
| How many rows match a predicate no prefix expresses? | maintained counter sub (`t.number()` plus `increment` / `decrement`) | O(1) read, O(1) bump per write | every write path must bump it inside the same `transaction` as the write |
| How many rows did a bulk delete just remove? | the `deleteByPrefix(prefix)` resolved number | counted as part of the delete | no second pass needed — the return value is the count |

Two subtleties before picking. First, `count(tx)` inside a snapshot keeps the walk path: the stat has no pinned view, so a transaction-pinned count walks the range instead (`sub.ts:757`) — same number, snapshot-correct, but no longer O(1). Batch snapshot totals rather than calling it per row. Second, a maintained counter drifts the moment one write path forgets the bump, and `increment` / `decrement` are rejected with `LmdbError` on indexed subs — keep counters in a separate non-indexed sub and treat the bump as part of the write, not an afterthought.

## Counting inside transactions

Reads and counts pin to a snapshot the same way: pass the trailing `tx` from `readTransaction` and every call sees one frozen view regardless of concurrent writers. The price is that `count(tx)` cannot use the stat (the stat is current-state only), so it walks — inside a transaction callback prefer one `count(tx)` over N of them, and never call it per row of a loop. Counter bumps go the other direction: they are writes, so they belong in the write `transaction` next to the put they describe, committing atomically or not at all.

## Incorrect

```typescript
// wrong: linear walk to learn a number the stat already knows
// wrong: materializes every key into an array just to read its length
const n = (await users.keys()).length
```

```typescript
// wrong: decodes every value into an array just to read its length — worse than keys()
// wrong: trips the materialization guardrail past 100k rows for a number `count()` gives free
const n = (await users.values()).length
```

```typescript
// wrong: the lazy escape hatch used as a counter — O(n) cursor walk, one decode per row
// wrong: `iterate()` exists for processing rows, not for learning how many there are
let n = 0
for await (const [_k, _v] of users.iterate()) n++
```

## Correct

```typescript
// O(1) stat — hot-loop safe, flat across DB sizes
const n = users.count()
```

```typescript
// O(matches) range walk — a number, nothing materialized, never guarded
const admins = await users.countByPrefix(`admin:`)
```

```typescript
// inside a snapshot the stat has no pinned view — `count(tx)` walks instead
// same number, snapshot-correct; batch snapshot totals rather than calling per row
const n = await users.owner.readTransaction(async (tx) => users.count(tx))
```

```typescript
// dupSort per-key count — how many values sit under one key, sync, no materialization
const tags = tagsDb.getValuesCount(`post:1`)
```

```typescript
// bulk delete reports its own count — the resolved number needs no follow-up read
const removed = await users.deleteByPrefix(`tmp:`)
```

## Notes

- `count(tx)` inside a snapshot keeps the walk path (stat has no snapshot) — same number, snapshot-correct.
- dupSort subs count key-value pairs in both methods — consistent.
- dupSort per-key counts use sync `getValuesCount(key)` — no walk, no array.
- Neither count is guarded: both return numbers, never arrays — the guardrail only gates materializing paths (see `query-range-scans.md`).
- Totals for paged walks (`page x of y`) pair with keyset pages — see `query-pagination.md`.
