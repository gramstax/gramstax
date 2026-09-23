# index-declaration

Declare indexes as value columns; let the env own the sub-DBs.

## Why

Each index auto-creates a `{db}:idx:{name}` sub-DB maintained in the same writer transaction as the primary write — no manual wiring, no drift. Declaration is also documentation: the schema shows every access path.

## Incorrect

```typescript
// manual index sub-DB + hand-rolled maintenance (stale-index bugs guaranteed)
static indexes = {email: {unique: true}} // removed class-style API
```

## Correct

```typescript
static value = {
  id: t.number().unique(), // duplicates → LmdbError + rollback
  email: t.string().index(), // duplicates allowed
  lower: t.string().index(`lowerEmail`), // explicit name, auto-resolved path
  "profile.email": t.string().index(), // dotted paths work
  tenant: t.string().index([`tenant`, `status`]) // composite → queried as {'tenant+status': [...]}
}
await users.findByIndex({email: `a@b.com`}) // non-unique → rows
await users.findByIndex({'tenant+status': [`t1`, `active`]}) // point tuple
await users.findByIndex({'tenant+status': [`t1`]}) // prefix seek
await users.reindex() // → {built, skipped}; collisions land in skipped
```

## Notes

- `null`/`undefined` extracts are skipped (row stays findable by primary key).
- Empty query, null value, or unknown index name throws `LmdbError` — fail fast beats silent empty.
