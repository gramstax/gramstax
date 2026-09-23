# txn-ttl

Expiry is lazy; reclamation is explicit and chunked.

## Why

Expired rows read as missing immediately (filtered on `get`/`has`, deleted lazily), but storage is reclaimed only by `purgeExpired()` — which scans the whole sub and deletes in 500-row transactions. On a hot TTL sub, purge cost grows with total rows, not expired rows.

## Incorrect

```typescript
// relying on reads to clean storage: disk grows until someone purges
await sessions.put(`s1`, row, {ttlMs: 80})
// ...never calling purgeExpired
```

## Correct

```typescript
await sessions.put(`s1`, row, {ttlMs: 80}) // envelope {v, exp}
sessions.get(`s1`) // undefined after expiry (lazy delete on read)
await sessions.purgeExpired() // returns reclaimed count; run on a schedule
```

## Notes

- `putMany` honors the schema default TTL exactly like `put`.
- `purgeExpired()` returns the reclaimed count (`0` on non-TTL subs); run on a schedule.
- Purge intra-day on hot subs; purge is for storage, never for correctness.
- Extractors run on the unwrapped value, so indexes stay consistent through expiry.
