# schema-hooks-ttl

Transforms and expiry belong on the schema, nowhere else.

## Why

`LmdbCodec` and class-style `serialize`/`deserialize`/`ttlMs` are deleted. Hooks/ttl on the schema keep storage and transform in one visible place — and `putMany` honors them exactly like `put` (a past hole where `putMany` skipped TTL envelopes is now closed and tested).

## Incorrect

```typescript
// write path bypasses the declared transform; reads come back raw
class S extends LmdbSchema {
  static db = `s`; static key = t.string(); static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => row // without hookBeforeRead: throws at register
}
```

## Correct

```typescript
class DateSchema extends LmdbSchema {
  static db = `dates`; static key = t.string(); static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as {at: Date}).at.getTime()})
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)})
}
class SessionSchema extends LmdbSchema {
  static db = `sessions`; static key = t.string()
  static value = {userId: t.string(), token: t.string()}
  static ttl = 0 // TTL sub, no default: per-put {ttlMs} only
}
await sessions.put(`s1`, row, {ttlMs: 80})
```

## Notes

- Hooks receive the `{v, exp}` envelope on TTL subs — write them envelope-aware.
- Reads treat expired rows as missing (lazy delete); `purgeExpired()` reclaims storage.
