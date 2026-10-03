# index-declaration

Declare indexes as value columns; let the env own the sub-DBs.

## Why

Each index auto-creates a `{db}:idx:{name}` sub-DB maintained in the same writer transaction as the primary write — no manual wiring, no drift. Declaration is also documentation: the schema shows every access path.

## Declaration decision table

Every marker is storage-only: the row type is unchanged, and each declared index consumes one `maxDbs` slot at registration:

| Declaration | Uniqueness | Sub-DB | Reach for it when |
| --- | --- | --- | --- |
| `t.number().unique()` | Unique | `{db}:idx:{col}` | The column identifies the row — duplicates throw `LmdbError` and roll back (self-update with the same key+value is allowed) |
| `t.string().index()` | Non-unique | `{db}:idx:{col}` | Many rows share the value — reads return `T[]` and need `{limit}` |
| `t.string().index(`name`)` | Non-unique | `{db}:idx:{name}` | The column name is wrong for queries — the explicit name overrides the derived one and auto-resolves as a dotted field path on the value |
| `t.string().index([`a`, `b`])` | Non-unique | `{db}:idx:{a+b}` | Two columns are always filtered together — one concatenated-key sub-DB instead of two seeks plus an intersect |
| `t.string().search()` | N/A (full-text) | `{db}:search:{col}` | Free-text ranking, not equality — queried via `search()`, never `findByIndex` |

The name auto-resolves as a dotted field path on the value, so `"profile.email": t.string().index()` indexes `value.profile.email`. Columns extracting to `null` / `undefined` are skipped — that record stays findable by primary key only. Custom `extractor`s and `{dbName}` overrides from the class-style era were removed: schemas auto-resolve field paths, nothing else.

## Composite arity and host constraints

`.index([`a`, `b`])` goes on the first column by convention. `LmdbSchema.validate` (`schema.ts`) rejects the bad shapes at `register` time, not at first query:

- Arity must be 2 or more — a single-element list declares nothing useful
- Every member column must exist on the value map — a typo fails registration with `LmdbError`
- Scalar values and the `static key` cannot host markers — the key is the primary key, never `unique()` / `index()`
- Nested markers are rejected — a `unique` / `index` / `search` buried inside a `t.object` / `t.array` shape would be silently ignored, so declare it as a top-level dotted column instead
- Duplicate index names are rejected — two columns resolving to the same name need an explicit `.index(name)` override on one of them
- `.search()` is string-columns only on a row-shaped value — scalar subs carry no searchable columns

Query the composite as one key: full tuples (point), short tuples (prefix seek), or `{start, end}` bounds (range). At most one composite key per query — malformed tuples throw `LmdbError`.

## Incorrect

```typescript
// wrong: removed class-style API — register() accepts schema classes only
static indexes = {email: {unique: true}}
```

```typescript
// wrong: the key is the primary key — validate throws LmdbError at register time
static key = t.number().unique()
```

```typescript
// wrong: nested inside a shape, so validate throws — declare it as a top-level dotted column
static value = {profile: t.object({email: t.string().index()})}
```

## Correct

```typescript
// unique index — duplicates throw LmdbError and roll back the write
static value = {
  id: t.number().unique(),
  email: t.string().index()
}
```

```typescript
// explicit name + dotted path — the name auto-resolves as a field path on the value
static value = {
  lower: t.string().index(`lowerEmail`),
  [`profile.email`]: t.string().index()
}
```

```typescript
// composite on the first column — one concatenated-key sub-DB queried as tenant+status
static value = {
  tenant: t.string().index([`tenant`, `status`]),
  status: t.string()
}
await orders.findByIndex({[`tenant+status`]: [`t1`, `active`]}) // point tuple
await orders.findByIndex({[`tenant+status`]: [`t1`]}) // prefix seek
```

```typescript
// rebuild path — collisions land in skipped instead of failing the rebuild
await users.reindex() // → {built, skipped} across every index
```

## Notes

- `null`/`undefined` extracts are skipped (row stays findable by primary key).
- Empty query, null value, or unknown index name throws `LmdbError` — fail fast beats silent empty.
- Locked by `test/schema.test.ts` (validate guards) + `test/composite-index.test.ts` (arity, tuple, range queries) and `test/index-embedded.test.ts` (unique conflicts, self-update).
- Sibling rules: `query-index-reads.md` (how each kind is queried), `index-write-cost.md` (what each kind costs per write), `index-maintenance.md` (how each kind is rebuilt).
