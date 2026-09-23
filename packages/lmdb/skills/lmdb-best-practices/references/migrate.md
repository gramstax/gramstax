# migrate

Backfill declaratively with idempotent transforms, not hand-rolled scripts.

## Why

A `{version, name, transform: {schema, schemaVersion?, map, onProgress?}}` step rewrites every row in 500-row transactions with progress; crashed steps rerun from scratch on the next `migrate()` (key-stable puts cannot duplicate rows) with a `transform:<version>` marker committed alongside the version bump. Skew (step target vs `static version`) throws `LmdbError` instead of writing foreign-shaped rows.

## Incorrect

```typescript
// one giant txn (memory blowup) or unmarked script (reruns double-apply)
for await (const [k, v] of users.iterate()) await users.put(k, reshape(v))
```

## Correct

```typescript
class UserSchema extends LmdbSchema {
  static version = 2
  static value = {name: t.string(), email: t.string().optional()}
}
await env.migrate([{version: 1, name: `fill-email`, transform: {
  schema: UserSchema, schemaVersion: 2,
  map: (row: UserRow) => ({...row, email: row.email ?? `${row.name}@x.co`}), // idempotent!
  onProgress: (done, total) => console.log(done, total)
}}])
```

## Notes

- Structural: chunked `putMany` batches carry indexes/CDC/TTL exactly like `put`.
- `migrate()` returns `{applied, currentVersion}`; `getMigrationVersion()` reads the stored version synchronously.
- Steps need `up` or `transform`; `up` runs after `transform`; reruns skip applied versions silently.
- Maps must be idempotent and defensive (older rows present `undefined` for newer fields); TTL subs are re-stamped with default expiry.
