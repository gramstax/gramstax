# query-pagination

Paginate with the last key (keyset), never with deep offsets.

## Why

`{offset: N}` steps the cursor over N dead rows per page — O(offset) wasted work on every page. `{start: lastKey}` seeks O(log n) straight to the resume point. Measured (`bench/range.bench.ts`, `Range / pagination` group): depth-1000 offset vs keyset ≈ 6x.

## Incorrect

```typescript
// page 100 re-walks 1000 rows to discard them
await repo.entries({limit: 10, offset: 1000})
```

## Correct

```typescript
// cursor seeks directly; cost is flat with page depth
let start: string | undefined
for (;;) {
  const page = await repo.entries(start ? {start, limit: 10} : {limit: 10})
  if (page.length === 0) break
  start = page[page.length - 1]![0]
}
```

## Notes

- Offset is fine below ~100 rows depth; beyond that always carry the last key.
- Keys sort byte-wise — keyset works on any ordered key space (strings, numbers, composite arrays).
