# query-range-scans

Bound every scan; let the guardrail count the range, not the database.

## Why

Unbounded scans pay a full-DB count for the guardrail and materialize everything. Bounded scans (`start`+`end`) count only their range via keys-only counting, and `like`/`findByPrefix` infer bounds from the pattern automatically.

## Pattern to bounds inference

Every range call resolves to one effective `[start, end)` before the cursor moves. `start` is inclusive, `end` is exclusive (`types/range.ts`); the `\uffff` sentinel is the exclusive upper bound for a prefix scan, the first key that sorts after any prefix.

| Call | Effective range | Regex? |
| --- | --- | --- |
| `findByPrefix(prefix)` | `[prefix, prefixEnd)` via `_prefixEnd` (`sub.ts:397`) | never — literal seek |
| `like("admin:*")` | same `[prefix, prefixEnd)`, inferred from the literal head (`sub.ts:380`) | no — the head anchors the scan |
| `like("*partial*")` | full keyspace — no literal head to anchor on | yes, `globMatch` per key over `getKeys` |
| `entries({start, end})` | exactly the caller bounds | no |
| `entries()` / `values()` / `keys()` unbounded | whole sub-DB | no |

Two details decide which row you land on. First, the prefix optimization is strings-only: `_like` checks `_keysAreStrings` and only then extracts a head (`sub.ts:850`), so number, buffer, and array keys always take the walk path even for a trailing-`wildcard` pattern. Second, the walk path is cheaper than it looks: it collects matching keys first, then batch-fetches values with one `getMany`, so non-matching rows are never decoded.

Why `like('*partial*')` cannot be bounded: a leading wildcard leaves no literal head, so no `[start, end)` can exclude any key up front. Every key must be tested against the regex, and the guardrail must count the whole sub-DB. If the substring you need is always a real prefix (`admin:` plus anything), spell it as one — the same query drops from full scan to bounded seek.

## Guardrail counting mechanics

`MAX_MATERIALIZE = 100_000` (`sub.ts:35`) gates `keys` / `values` / `entries` / `like` / `findByPrefix` / `deleteByPrefix`. Any of them rejects with `LmdbError` past the cap. `_assertMaterialize` (`sub.ts:455`) counts in three tiers, cheapest first:

1. `{limit}` above the cap rejects before any IO — the request declares itself too big.
2. Both bounds present (`start` plus `end`, caller-supplied or pattern-inferred) counts only the range with `getKeysCount({start, end})` — keys only, no values decoded, full-DB size irrelevant.
3. Otherwise it falls back to the full `_count(state)`.

The consequence is the point of the rule: a selective pattern on an oversized sub passes instead of false-rejecting, while an unbounded call on the same sub correctly rejects. For result sets genuinely larger than 100k, `iterate()` streams entries lazily (`sub.ts:826`) and is never guarded.

## Incorrect

```typescript
// wrong: leading wildcard — no literal head, so the scan covers the full keyspace
// wrong: every key runs through `globMatch`, and the guardrail counts the whole sub-DB
await users.like(`*admin*`) // only when truly unavoidable
```

```typescript
// wrong: unbounded materialization — the guardrail correctly rejects this past 100k rows
// wrong: even below the cap it decodes every value into one array
await users.entries()
```

```typescript
// wrong: `findByPrefix` reads its argument literally — the `*` matches a real asterisk
// wrong: prefix scans never run globs; that spelling is `like` with a trailing `*`
await users.findByPrefix(`admin:*`)
```

## Correct

```typescript
// bounded [prefix, prefixEnd) — cursor seek, no regex anywhere
await users.findByPrefix(`admin:`)
// same bounded shape, inferred from the literal head automatically
await users.like(`admin:*`)
```

```typescript
// exact caller bounds — the guard counts only [start, end) via keys-only counting
await users.entries({start: `k000500`, end: `k001000`})
// counts the range without materializing a single value
await users.countByPrefix(`admin:`)
```

```typescript
// lazy cursor — one entry at a time, never guarded, no array built
for await (const [k, v] of users.iterate()) {}
```

## Notes

- `first()`/`last()` are single-row cursors — never emulate with `entries({limit: 1})` plus manual slicing (same thing, more code).
- Selective patterns on oversized repos pass the guard instead of false-rejecting (bounded counting); covered by `repository.guardrail.test.ts`.
- `deleteByPrefix(``)` rejects with `LmdbError` — an empty prefix is not a range, use `clear()`.
- Paging over a bounded range is a separate concern — see `query-pagination.md`. Totals without materialization live in `query-count.md`; secondary-key selective reads in `query-index-reads.md`.
