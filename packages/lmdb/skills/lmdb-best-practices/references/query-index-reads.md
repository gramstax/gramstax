# query-index-reads

Match the query shape to the index; cap every fan-out.

## Why

Unique-only queries resolve to one row via point lookups. Non-unique queries materialize candidates (most-selective index drives first), so an uncapped fan-out (`{subscribed: true}` at millions of rows) materializes gigabytes to return a slice. `{limit}` pages the driver with flat memory.

## Incorrect

```typescript
// materializes 2M rows to keep 10 — OOM at scale
const top = (await users.findByIndex({subscribed: true})).slice(0, 10)
```

## Correct

```typescript
await users.findByIndex({username: `damar`}) // unique → row | undefined
await users.findByIndex({email: `a@b.com`}) // non-unique → rows
await users.findByIndex({subscribed: true}, undefined, {limit: 1000}) // bounded
await users.findByIndex({email, username}) // multi-key AND, driver + verify
await orders.findByIndex({'tenant+status': [`t1`, `active`]}) // composite point
await orders.findByIndex({'tenant+status': {start: [`t1`], end: [`t2`]}}) // composite range
```

## Notes

- Measured: limit-100 of 5000 matches ≈ 37x vs unbounded (`bench` A/B).
- Contradictory keys → empty (`undefined`/`[]`), never error. `{}`/null/unknown key → `LmdbError`.
- Snapshot reads: pass `tx` (sequential path preserves the snapshot; native batch cannot pin it).
