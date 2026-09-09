# query-range-scans

Bound every scan; let the guardrail count the range, not the database.

## Why

Unbounded scans pay a full-DB count for the guardrail and materialize everything. Bounded scans (`start`+`end`) count only their range via keys-only counting, and `like`/`findByPrefix` infer bounds from the pattern automatically.

## Incorrect

```typescript
// full scan + regex over every key, then decode every value
await users.like(`*admin*`) // only when truly unavoidable
await users.entries() // unbounded on a big sub-DB: guard rejects (correctly)
```

## Correct

```typescript
await users.findByPrefix(`admin:`) // bounded [prefix, prefixEnd), no regex
await users.like(`admin:*`) // same bounded shape, inferred automatically
await users.entries({start: `k000500`, end: `k001000`}) // exact bounded guard
await users.countByPrefix(`admin:`) // counts without materializing
for await (const [k, v] of users.iterate()) {} // lazy escape hatch, never guarded
```

## Notes

- `first()`/`last()` are single-row cursors — never emulate with `entries({limit: 1})` plus manual slicing (same thing, more code).
- Selective patterns on oversized repos pass the guard instead of false-rejecting (bounded counting); covered by `repository.guardrail.test.ts`.
