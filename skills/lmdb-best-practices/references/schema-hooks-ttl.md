# schema-hooks-ttl

Transforms and expiry belong on the schema, nowhere else.

## Why

`LmdbCodec` and class-style `serialize`/`deserialize`/`ttlMs` are deleted. Hooks/ttl on the schema keep storage and transform in one visible place — and `putMany` honors them exactly like `put` (a past hole where `putMany` skipped TTL envelopes is now closed and tested). A transform hidden in a service layer runs on some paths and not others: bulk import writes raw while point writes transform, and the reader can no longer tell which rows are which. Expiry has the same shape — a TTL declared anywhere but the schema is a TTL honored nowhere but that one call site.

## The hook pair

`hookBeforeWrite` runs before LMDB serializes, `hookBeforeRead` after it deserializes. The two sides are one contract: declaring half of it leaves rows that can be written but never read back (or vice versa), so `validate` refuses the pair unless both halves are present.

| Declaration | Register result |
| --- | --- |
| Neither hook | ok — the automatic record codec owns the hook slot |
| Both `hookBeforeWrite` + `hookBeforeRead` | ok — custom transform replaces the record codec |
| Only `hookBeforeWrite` | `LmdbError` at register — write-hook without read-hook |
| Only `hookBeforeRead` | `LmdbError` at register — read-hook without write-hook |

The schema's `static value` still drives the row type (`ValueOf`) when hooks are declared, so reads and writes stay typed while the on-disk form is whatever the hooks produce. On TTL subs the hooks receive the `{v, exp}` envelope, not the bare row — write them envelope-aware.

## Codec-bypass matrix

Row schemas without custom hooks store positionally: values encode as arrays in column declaration order with no field names (~1.5x faster decode, ~20% smaller bytes, zero type change). Three declarations opt out of that layout and store through their own path instead.

| Declaration | Codec | Stored form |
| --- | --- | --- |
| Plain row value (no hooks, no TTL) | automatic record codec | positional array in column order |
| Custom hook pair declared | hooks replace the codec | whatever `hookBeforeWrite` returns |
| `static ttl` declared | TTL envelope path | `{v, exp}` expiry envelope |
| Scalar `static value` | no codec (no columns to order) | the scalar itself |

Dotted-path columns walk and rebuild through `getPath`/`setPath`, so `"profile.email"` survives the positional round-trip. Rows written before the codec (plain objects, or raw bytes via `putBinary`) decode through untouched — the reader passes non-array values back as-is.

## TTL precedence

| Declaration | Effect |
| --- | --- |
| No `static ttl`, no per-put option | rows never expire |
| `static ttl = 80` | repository-wide default: every `put` expires 80ms out unless overridden |
| Per-put `{ttlMs}` | overrides `static ttl` for that write only |
| `static ttl = 0` | materializes the TTL sub with NO default expiry — per-put `{ttlMs}` and `purgeExpired()` available, nothing expires by default |

Reads (`get`/`has`) treat expired entries as missing (lazy delete); `purgeExpired()` reclaims the storage and returns the count (0 on non-TTL subs). Priority order: per-put `{ttlMs}` → `static ttl` → never expires.

## Incorrect

```typescript
// wrong: write path bypasses the declared transform — reads come back raw;
// wrong: without hookBeforeRead the schema throws at register anyway
class S extends LmdbSchema {
  static db = `s`; static key = t.string(); static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => row // without hookBeforeRead: throws at register
}
```

```typescript
// wrong: class-style transform and TTL knobs are deleted — neither is read at
// register, so the dates store untransformed and nothing ever expires
class S extends LmdbSchema {
  static db = `s`; static key = t.string(); static value = {at: t.date()}
  static serialize = (row: unknown): unknown => row // deleted: use hookBeforeWrite
  static ttlMs = 80 // deleted: use static ttl
}
```

```typescript
// wrong: hook ignores the TTL envelope — on a TTL sub the hook receives
// {v, exp}, so this double-wraps the row and hookBeforeRead cannot unwrap it
class S extends LmdbSchema {
  static db = `s`; static key = t.string(); static value = {at: t.date()}
  static ttl = 80
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as {at: Date}).at.getTime()}) // wrong: row is the {v, exp} envelope here
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)}) // wrong: raw is the envelope, not the row
}
```

## Correct

```typescript
// correct: paired hooks — write converts Date to ms before LMDB serializes,
// read converts back after it deserializes; static value keeps the row typed
class DateSchema extends LmdbSchema {
  static db = `dates`; static key = t.string(); static value = {at: t.date()}
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as {at: Date}).at.getTime()})
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)})
}
```

```typescript
// correct: TTL on the schema — default expiry plus per-put override on the
// handle; putMany wraps the same envelope, so bulk writes expire identically
class SessionSchema extends LmdbSchema {
  static db = `sessions`; static key = t.string()
  static value = {userId: t.string(), token: t.string()}
  static ttl = 0 // TTL sub, no default: per-put {ttlMs} only
}
await sessions.put(`s1`, row, {ttlMs: 80}) // expires 80ms out
const purged = await sessions.purgeExpired() // reclaims expired rows
```

## Notes

- Hooks receive the `{v, exp}` envelope on TTL subs — write them envelope-aware.
- Reads treat expired rows as missing (lazy delete); `purgeExpired()` reclaims storage.
- Custom-hook, TTL, and scalar-value schemas bypass the automatic record codec (positional array storage) — plain row schemas get it with no type change.
- `increment`/`decrement`/`putBinary` are rejected with `LmdbError` on indexed/search subs — keep counters in a separate non-indexed, non-TTL sub rather than stacking hooks on top.
- Deleted APIs stay deleted: `LmdbCodec`, class-style `static serialize`/`deserialize`/`codec`/`ttlMs` — declare `hookBeforeWrite`/`hookBeforeRead`/`static ttl` on the schema instead.
- `static version` (integer row-shape version for migration transforms) is orthogonal to hooks/TTL — version skew is refused by the migration runner, not by the codec path; see `migrate.md`.
