# index-write-cost

Every index multiplies write cost — budget them like infrastructure.

## Why

Each put pays: primary write + peek + per-index extractor + unique point-check + old-row free + new-row insert, all in one transaction (~5-8 native ops). At millions of message-driven writes (e.g. `lastActiveAt` per Telegram update), two extra indexes can halve write throughput.

## Write-amplification table

One `put` fans out to every table the schema declares. Count the rows per write before adding a marker:

| Operation | Primary | Per unique index | Per non-unique index | Per search column |
| --- | --- | --- | --- | --- |
| `put` (insert) | 1 write | point-check + 1 insert | 1 insert | 1 posting row per token |
| `put` (update, indexed field changed) | 1 write | old-row free + point-check + 1 insert | old-row free + 1 insert | stale postings freed + fresh postings per token |
| `put` (update, indexed fields untouched) | 1 write | 0 | 0 | 0 |
| `delete` / `deleteByPrefix` / `clear` | 1 remove | 1 remove each | 1 remove each | postings removed with the record |
| `purgeExpired` | 1 remove | removed with the record | removed with the record | removed with the record |

Two rules fall out. First, an index on a column that changes every write (a `lastSeenAt` timestamp, a message counter) pays the free-plus-insert cycle on every single put while buying lookups nobody runs — that is the most expensive index you can declare. Second, the per-write cost is linear in the index count, so a five-index schema on a per-message path pays five index writes per message before the primary write is even counted.

## Separate hot counters into a non-indexed sub

`increment` / `decrement` / `putBinary` are rejected with `LmdbError` on indexed/search subs (`sub.ts`) — they bypass the extractor, so they would leave every index stale. That rejection is the fix wearing a guard uniform:

- Keep counters in a scalar sub (`static value = t.number()`) with no markers — `increment` is atomic read-then-write in one txn there
- Keep identity/lookup rows in an indexed sub that is written rarely (profile creation, registration)
- Cross the two with `owner`: `users.owner.sub(CounterSchema).increment(`msg-total`)` in the same handler, without coupling their write costs
- Measure the split with `bench/index.bench.ts` (`Index / writes`: indexed vs plain put) before and after

## Incorrect

```typescript
// wrong: five indexes on a per-message write path — every message pays 5 index writes
static value = {a: t.string().unique(), b: t.string().index(), c: t.string().index(), d: t.string().index(), e: t.string().index()}
```

```typescript
// wrong: indexed every write while nobody queries it — each put pays free + insert for nothing
static value = {id: t.number().unique(), lastSeenAt: t.date().index()}
```

```typescript
// wrong: rejected with LmdbError — counters cannot live on an indexed sub
await users.increment(`msg-total`)
```

## Correct

```typescript
// profile: indexed for lookups (rare writes); activity: non-indexed for hot writes
class ProfileSchema extends LmdbSchema { static value = {id: t.number().unique(), username: t.string().index()} }
class ActivitySchema extends LmdbSchema { static value = {at: t.date(), kind: t.string()} } // no indexes
```

```typescript
// scalar sub, atomic, index-free — the sanctioned home for counters
await counters.increment(`msg-total`)
```

```typescript
// same handler, decoupled costs — lookups and counters commit apart
await profiles.put(id, row) // indexed, rare
await counters.increment(`msg-total`) // plain, hot
```

## Notes

- `increment`/`decrement`/`putBinary` throw on indexed/search subs by design — counters live apart.
- Measure with `bench/index.bench.ts` (`Index / writes`: indexed vs plain put).
- Locked by `test/repository.counter.test.ts` (atomic counters, indexed-sub rejection) and `test/repository.binary.test.ts` (`putBinary` guard).
- Each declared index also consumes one `maxDbs` slot at registration — size `maxDbs` for schema + indexes + composite/search tables (`env-sizing.md`).
- An update that touches no indexed field pays only the primary write — shape hot-path updates to avoid indexed columns.
- Sibling rules: `index-declaration.md` (which markers exist), `index-maintenance.md` (who maintains the extra rows), `query-bulk-writes.md` (how bulk writes amortize the cost), `txn-ttl.md` (expiry writes also pay maintenance).
