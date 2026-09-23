# search

Full-text search is a storage marker, not a query language.

## Why

`t.string().search()` provisions one `{db}:search:{column}` dupSort table holding term→PK postings, maintained in the same writer transaction as the primary write. `sub.search(query)` ANDs tokenized terms across all searched columns and ranks by per-column hits — a selective-term seek instead of a full `values()` scan with JS filtering.

## Incorrect

```typescript
// full scan + JS filter on every keystroke — O(n) per query
const hits = (await docs.values()).filter((d) => d.title.includes(q))
```

## Correct

```typescript
static value = {title: t.string().search(), body: t.string().search()}
await docs.search(`hello world`) // ANDs terms, best first → PKs
await docs.search(`hello`, {limit: 10}) // bounded output
```

## Notes

- Measured: `search('w99999')` 6.8ms vs full-scan filter 574ms on 100k rows (~84x, ad-hoc `bun -e`).
- Tokenizer is lowercase + `[^a-z0-9]+` split, no stemming; non-ASCII letters separate. The tokenizer lives on `LmdbSearch` (`tokenize`/`tokenizeField`/`fingerprintPk` statics).
- `reindex()` rebuilds posting tables; `delete`/`clear`/`deleteByPrefix` clean them; empty query or no searched columns → `LmdbError`.
