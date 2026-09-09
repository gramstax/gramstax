# index-write-cost

Every index multiplies write cost — budget them like infrastructure.

## Why

Each put pays: primary write + peek + per-index extractor + unique point-check + old-row free + new-row insert, all in one transaction (~5-8 native ops). At millions of message-driven writes (e.g. `lastActiveAt` per Telegram update), two extra indexes can halve write throughput.

## Incorrect

```typescript
// five indexes on a per-message write path: every message pays 5 index writes
static value = {a: t.string().unique(), b: t.string().index(), c: t.string().index(), d: t.string().index(), e: t.string().index()}
```

## Correct

```typescript
// profile: indexed for lookups (rare writes); activity: non-indexed for hot writes
class ProfileSchema extends LmdbSchema { static value = {id: t.number().unique(), username: t.string().index()} }
class ActivitySchema extends LmdbSchema { static value = {at: t.date(), kind: t.string()} } // no indexes
await counters.increment(`msg-total`) // scalar sub, atomic, index-free
```

## Notes

- `increment`/`putBinary` throw on indexed subs by design — counters live apart.
- Measure with `bench/index.bench.ts` (`Index / writes`: indexed vs plain put).
