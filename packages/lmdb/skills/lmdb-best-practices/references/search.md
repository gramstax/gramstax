# search

Full-text search is a storage marker, not a query language.

## Why

`t.string().search()` provisions one `{db}:search:{column}` dupSort table holding term→PK postings, maintained in the same writer transaction as the primary write. `sub.search(query)` ANDs tokenized terms across all searched columns and ranks by per-column hits — a selective-term seek instead of a full `values()` scan with JS filtering.

The failure mode is vocabulary mismatch: the tokenizer is fixed (lowercase + `[^a-z0-9]+` split, no stemming, no ASCII folding), so a query term that never survives tokenization the same way the stored text did silently ANDs to an empty set. Searching for `running` never matches `run`, and `café` never matches `cafe` — not a ranking quirk, a total miss with no error.

## The tokenizer contract

`LmdbSearch.tokenize` (`search.ts`) is the single function both indexing and querying run through, so write and read always agree — but only if you predict what it does to your text:

| Input text | Terms produced | Consequence |
| --- | --- | --- |
| `Hello World` | `hello`, `world` | case never matters — both sides lowercase |
| `order-42:shipped` | `order`, `42`, `shipped` | punctuation splits — hyphenated codes become separate terms |
| `running runs` | `running`, `runs` | no stemming — each inflection is a different term, ANDed independently |
| `café résumé` | `caf`, `r`, `sum` | non-ASCII letters separate (`search.ts`) — accented text fragments |
| `!!!` or `` (empty) | `(none)` | empty term list — empty query throws `LmdbError`, never returns `[]` |
| non-string field (`null`, missing, off-kind row) | `(none)` | `tokenizeField` contributes zero terms — mirrors how `null` extracts skip embedded indexes |

Query semantics on top of those terms:

- **AND, not OR.** `search(`hello world`)` intersects the posting lists — a row must contain every term somewhere across the searched columns. One rare term narrows fast; one common term costs little because the intersection starts from the smallest list.
- **Across ALL searched columns.** There is no column-scoped query — `title` and `body` postings merge, and ranking counts per-column hits (a row matching in two columns outranks one matching in one).
- **Returns PKs, not rows.** `search(query, {limit?})` resolves to `KeyOf[]` — fetch rows with `get`/`getMany` afterward.
- **Storage-only marker.** `.search()` changes nothing about the row type — `ValueOf` is identical with or without it. It only provisions the posting table at registration.

## Incorrect

```typescript
// full scan + JS filter on every keystroke — O(n) per query
const hits = (await docs.values()).filter((d) => d.title.includes(q))
```

```typescript
// wrong: stemming assumed — `running` and `run` are different terms,
// so this ANDs two disjoint posting lists and returns nothing
await docs.search(`running shoes`)
```

```typescript
// wrong: searching a schema with no `.search()` column (or an empty
// query string) throws `LmdbError` — there is no graceful empty result
await docs.search(``)
```

## Correct

```typescript
// declare searchable columns — row type unchanged, posting tables provisioned
class DocSchema extends LmdbSchema {
  static db = `docs`
  static key = t.number()
  static value = {title: t.string().search(), body: t.string().search()}
}
const docs = env.register(DocSchema)
await docs.search(`hello world`) // ANDs terms, best first → PKs
await docs.search(`hello`, {limit: 10}) // bounded output — always cap fan-out reads
```

```typescript
// unit-test the tokenizer directly — `LmdbSearch` statics are exported
// from the package root, so query vocabulary stays predictable
LmdbSearch.tokenize(`Hello, World!`) // [`hello`, `world`]
LmdbSearch.tokenizeField(null) // [] — absent fields contribute nothing
LmdbSearch.fingerprintPk([`tenant-a`, `u1`]) // stable string for score-map lookups
```

## Notes

- Measured: `search('w99999')` 6.8ms vs full-scan filter 574ms on 100k rows (~84x, ad-hoc `bun -e`).
- Posting tables are dupSort term→PK per searched column; ranking happens at read time in `LmdbEnvSub.search` (`search.ts`).
- Posting maintenance rides the embedded-index write path in the same writer transaction — a rolled-back put leaves no phantom postings (`search.ts`).
- `fingerprintPk` exists because `Map` identity breaks for array/buffer PKs — each read materializes a fresh object, so the score map keys on the stable string encoding instead (`search.ts`).
- `reindex()` rebuilds posting tables; `delete`/`clear`/`deleteByPrefix` clean them; empty query or no searched columns → `LmdbError`.
- `increment`/`decrement`/`putBinary` are rejected with `LmdbError` on searched subs — counters live in a separate non-searched sub.
- Runnable grounding: `packages/lmdb/example/search-cdc-demo.ts` exercises `search()` alongside composite indexes and `subscribe` on one handle.
