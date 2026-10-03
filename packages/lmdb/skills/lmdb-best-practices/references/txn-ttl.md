# txn-ttl

Expiry is lazy; reclamation is explicit and chunked.

## Why

Expired rows read as missing immediately (filtered on `get`/`has`, deleted lazily), but storage is reclaimed only by `purgeExpired()`, which scans the whole sub and deletes in 500-row transactions. On a hot TTL sub, purge cost grows with total rows, not expired rows. Reads never pay for dead rows, but the disk does: without a purge schedule the sub grows until the map fills, and then every write in the env throws.

## Expiry priority

| Source | Form | Effect |
| --- | --- | --- |
| Per-put override | `put(k, v, {ttlMs})` or `put(k, v, ms)` | wins for that write (`sub.ts:1440`) |
| Schema default | `static ttl = ms` | every `put` without an override, including `putMany` |
| Opt-in, no default | `static ttl = 0` | TTL sub materialized, nothing expires unless a put carries `{ttlMs}` |
| Neither | none | never expires |

A put with no override on a `static ttl = 0` schema lives forever, since `0` provisions the machinery, not a deadline. The override accepts a bare millisecond number or a `{ttlMs}` object, and both funnel into the same expiry envelope.

## Lazy expiry versus reclamation

| | Lazy expiry (reads) | `purgeExpired()` (reclamation) |
| --- | --- | --- |
| `get` / `has` | expired reads as missing, evicted on read | none |
| Storage | untouched | removed in 500-row txns (`sub.ts:2249`) |
| Cost | O(1) per read | grows with total rows, not expired rows |
| Returns | value or `undefined` | reclaimed count (`0` on non-TTL subs) |
| Schedule | always on | intra-day on hot subs, never per read |

Purge is for storage, never for correctness: reads already filter expired rows, so purging before a read adds a full scan for zero freshness gain. Index rows die with the record, since extractors run on the unwrapped value, so expiry never leaves a dangling index entry.

## Incorrect

```typescript
// wrong: reads hide expired rows but free nothing, disk grows until someone purges
// wrong: on a hot sub the map fills and every write in the env starts throwing
await sessions.put(`s1`, row, {ttlMs: 80})
// ...never calling purgeExpired
```

```typescript
// wrong: `static ttl = 0` provisions the TTL sub with NO default, so this row never expires
// wrong: a bare `0` means opt-in per put, not expire-immediately
class SessionSchema extends LmdbSchema {
  static db = `sessions`
  static key = t.string()
  static value = {userId: t.string(), token: t.string()}
  static ttl = 0
}
await sessions.put(`s1`, row)
```

```typescript
// wrong: reads already treat expired rows as missing, so purge buys zero freshness
// wrong: each call scans the whole sub, turning O(1) reads into full scans when done per read
const row = sessions.get(`s1`)
if (row === undefined) {
  await sessions.purgeExpired()
}
```

## Correct

```typescript
// correct: schema default covers every put, per-put `{ttlMs}` overrides once
// correct: expired reads as `undefined` immediately, no purge needed for correctness
class SessionSchema extends LmdbSchema {
  static db = `sessions`
  static key = t.string()
  static value = {userId: t.string(), token: t.string()}
  static ttl = 30 * 60 * 1000
}
await sessions.put(`s1`, row)
await sessions.put(`s2`, row, {ttlMs: 80})
sessions.get(`s1`)
```

```typescript
// correct: `static ttl = 0` keeps the sub non-expiring until a put opts in
// correct: purge runs on a schedule and returns the reclaimed count for monitoring
class OtpSchema extends LmdbSchema {
  static db = `otps`
  static key = t.string()
  static value = {code: t.string()}
  static ttl = 0
}
await otps.put(`o1`, {code: `4821`}, {ttlMs: 5 * 60 * 1000})
setInterval(() => {
  void otps.purgeExpired().then((n) => console.log(`purged ${n}`))
}, 60 * 1000)
```

## Notes

- `putMany` honors the schema default TTL exactly like `put`.
- `purgeExpired()` returns the reclaimed count (`0` on non-TTL subs); run on a schedule.
- Purge intra-day on hot subs; purge is for storage, never for correctness.
- Extractors run on the unwrapped value, so indexes stay consistent through expiry.
- Locks: `test/ttl.test.ts` covers priority, lazy reads, and chunked purge.
