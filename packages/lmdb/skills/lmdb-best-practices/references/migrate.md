# migrate

Backfill declaratively with idempotent transforms, not hand-rolled scripts.

## Why

A `{version, name, transform: {schema, schemaVersion?, map, onProgress?}}` step rewrites every row in 500-row transactions with progress; crashed steps rerun from scratch on the next `migrate()` (key-stable puts cannot duplicate rows) with a `transform:<version>` marker committed alongside the version bump. Skew (step target vs `static version`) throws `LmdbError` instead of writing foreign-shaped rows.

The failure mode is a `map` with side effects or order dependence: because a crash reruns the step from row zero, anything the first partial run already did happens twice. A counter increment backfills `+2` on the rows the crash had already reached; a non-defensive read of a not-yet-existing field throws halfway and leaves the version unbumped, so the next boot retries the same throw.

## Step shapes

| | `up` | `transform` |
| --- | --- | --- |
| Shape | `up: () => void \| Promise<void>` — arbitrary code | `transform: {schema, schemaVersion?, map, onProgress?}` — row rewrite |
| Runs | once, when its version is unapplied | once per row batch, when its version is unapplied |
| Batching | your problem — one txn unless you chunk | 500-row `putMany` batches with `onProgress(done, total)` per committed chunk |
| Crash rerun | reruns from scratch like any unapplied step | reruns from scratch — key-stable puts cannot duplicate, but `map` runs again |
| Version marker | version bump commits after `up` returns | `transform:<version>` marker commits alongside the version bump |
| Use for | seeding, one-off DDL-ish work, index-adjacent setup | reshaping every row of a sub |

One rule for both: a step needs EITHER `up` OR `transform` — neither throws `LmdbError`; both run with `transform` first, then `up`. Reruns skip applied versions silently, and `migrate()` resolves `{applied, currentVersion}` while `getMigrationVersion()` reads the stored version synchronously.

## Crash-and-rerun sequence

| # | Event | State |
| --- | --- | --- |
| 1 | `migrate([{version: 2, ...}])` starts; no marker for v2 | `currentVersion` still 1 |
| 2 | batches 1-3 commit (1500 rows rewritten), `onProgress` fires per chunk | rows new-shaped, version still 1 — marker commits only at the end |
| 3 | process dies mid-batch-4 | rows 1-1500 new, rest old, version 1 |
| 4 | next boot calls `migrate()` again | v2 unapplied (no marker), reruns from row zero |
| 5 | `map` runs again over rows 1-1500 | harmless IFF `map` is idempotent and defensive |
| 6 | all batches commit, marker + version bump commit together | `currentVersion` 2, step skipped forever after |

This is why `map` must be IDEMPOTENT (`map(map(row))` deep-equals `map(row)` — prefer `??` defaults over increments, toggles, or appends) and DEFENSIVE (older rows present `undefined` for newer fields, so read with `??`/optional chaining). The skew check is the other guardrail: `schemaVersion` must equal the schema's `static version` when declared, else `LmdbError` before any row is touched — and `LmdbSchema.validate` rejects a non-integer `static version` at registration.

## Incorrect

```typescript
// one giant txn (memory blowup) or unmarked script (reruns double-apply)
for await (const [k, v] of users.iterate()) await users.put(k, reshape(v))
```

```typescript
// wrong: non-idempotent map — the crash rerun applies the increment
// a second time to every row the first run already reached
transform: {schema: UserSchema, map: (row: UserRow) => ({...row, logins: row.logins + 1})}
```

```typescript
// wrong: skewed target — the schema declares `static version = 3`
// but the step names 2, so `migrate()` throws `LmdbError` untouched
transform: {schema: UserSchema, schemaVersion: 2, map: (row: UserRow) => row}
```

## Correct

```typescript
// idempotent + defensive map — rerun-safe, old rows tolerated
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

```typescript
// `up` for non-row work — runs once per version, skipped after
await env.migrate([{version: 2, name: `seed-admins`, up: async () => {
  await admins.putIfNotExists(`root`, {name: `root`}) // conditional — itself rerun-safe
}}])
const v = env.getMigrationVersion() // sync number — 2 once both steps applied
```

## Notes

- Structural: chunked `putMany` batches carry indexes/CDC/TTL exactly like `put`.
- `migrate()` returns `{applied, currentVersion}`; `getMigrationVersion()` reads the stored version synchronously.
- Steps need `up` or `transform`; `up` runs after `transform`; reruns skip applied versions silently.
- Maps must be idempotent and defensive (older rows present `undefined` for newer fields); TTL subs are re-stamped with default expiry.
- Shape versions are declared per schema — see `schema-design.md` for `static version` conventions.
