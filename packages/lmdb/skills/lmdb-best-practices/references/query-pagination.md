# query-pagination

Paginate with the last key (keyset), never with deep offsets.

## Why

`{offset: N}` steps the cursor over N dead rows per page — O(offset) wasted work on every page. `{start: lastKey}` seeks O(log n) straight to the resume point. Measured (`bench/range.bench.ts`, `Range / pagination` group): depth-1000 offset vs keyset ≈ 6x.

## What each page costs

`{offset}` does not remember where the last page stopped. Every page starts the cursor at the range start and walks past all previous rows to discard them, so page k pays for k pages of rows it never returns. Keyset resumes from a key, so the B-tree seek lands on the page directly and the cost stays flat no matter how deep you go.

| Page depth | `{offset}` page cost | Keyset page cost |
| --- | --- | --- |
| 10 | 10 discarded steps — noise | one O(log n) seek |
| 100 | 100 discarded steps — still fine | one seek, same as page 1 |
| 1000 | 1000 discarded steps — measured ≈ 6x slower than keyset | one seek, flat |

The rule of thumb follows from the table: `{offset}` below ~100 rows depth is harmless and simpler to write; beyond that always carry the last key forward. A full-table walk with `{offset}` is the worst case — every page re-walks all previous rows, so total work grows with the square of the depth while keyset stays linear.

## Composite keys and the last-key trap

Keyset works on any ordered key space: strings, numbers, and composite array keys like `["tenant-a", "u1"]`, which sort lexicographically under ordered-binary encoding (`types/key.ts`). Two things bite when you carry the key forward:

1. Carry the FULL tuple. Resuming from a partial prefix (just the tenant) seeks to the tenant first row and re-emits rows you already returned. The resume value is always the complete key of the last returned row.
2. `start` is inclusive. Resuming at the verbatim last key repeats one row per page. Pass `exclusiveStart: true` (`types/range.ts`) to skip the resume row itself instead of deduping by hand.

## Incorrect

```typescript
// wrong: page 100 re-walks 1000 rows to discard them — every page pays full depth
// wrong: cost grows with depth, so later pages are slower than early ones
await sub.entries({limit: 10, offset: 1000})
```

```typescript
// wrong: each iteration restarts at the range start and skips further each time
// wrong: a full walk this way costs pages-squared steps instead of one pass
for (let p = 0; ; p++) {
  const page = await sub.entries({limit: 100, offset: p * 100})
  if (page.length === 0) break
}
```

```typescript
// wrong: `start` is inclusive, so the last row of page N is also the first row of page N+1
// wrong: every page carries a duplicate — use `exclusiveStart` instead of deduping
const page = await sub.entries({start: lastKeyFromPreviousPage, limit: 10})
```

## Correct

```typescript
// cursor seeks directly; cost is flat with page depth
let start: string | undefined
for (;;) {
  const page = await sub.entries(start ? {start, limit: 10} : {limit: 10})
  if (page.length === 0) break
  start = page[page.length - 1]![0]
}
```

```typescript
// `start` is inclusive — `exclusiveStart` skips the resume row itself, no dedupe needed
const page = await sub.entries({start: lastKey, exclusiveStart: true, limit: 10})
```

```typescript
// composite keys sort lexicographically — carry the FULL tuple, not the tenant prefix
const page = await orders.entries({start: [`t1`, `u-last-seen`], exclusiveStart: true, limit: 10})
```

```typescript
// depth below ~100 — the stepping cost is noise, keyset buys nothing here
await sub.entries({limit: 10, offset: 40})
```

## Notes

- Offset is fine below ~100 rows depth; beyond that always carry the last key.
- Keys sort byte-wise — keyset works on any ordered key space (strings, numbers, composite arrays).
- Per-page `{limit}` keeps each page far under `MAX_MATERIALIZE`; keyset plus a bounded `[start, end)` also keeps the guardrail count on the range — see `query-range-scans.md`.
- Totals for progress bars (`page x of y`) come from `count()` / `countByPrefix()`, not from walking — see `query-count.md`.
