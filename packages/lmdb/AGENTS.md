# @GRAMSTAX/LMDB — LMDB Database Wrapper

Multi-runtime (Bun, Node.js >=18) key-value database with schema-declared repositories per sub-database.

## Source Layout

```
packages/lmdb/src/
├── env.ts          LmdbEnv — root DB class (lifecycle, register/sub, transactions, migrations)
├── sub-manager.ts  LmdbEnvSubManager — sub-DB registry + state factory (internal)
├── sub.ts          LmdbEnvSub — typed self-contained sub handle (all sub methods)
├── schema.ts       LmdbSchema + t builders + ValueOf/KeyOf type helpers
├── types.ts        LmdbSubState/IndexDescriptor/MAX_MATERIALIZE (internal)
├── transaction.ts  LmdbTransaction — commit/abort/lifecycle
├── errors.ts       LmdbError + typed subclasses
├── replica.ts      Read-only replica helper
└── index.ts        Barrel (re-exports all modules)
```

## Core Pattern

The ONLY repository declaration path is a schema class. Extend `LmdbSchema` with `static db` + `static key` (a single `t` builder) + `static value` (a map of `t` builders), then `env.register(SchemaClass)` materializes a fully typed sub handle.

```typescript
class UserSchema extends LmdbSchema {
  static db = `user`
  static key = t.number()
  static value = {
    id: t.number().unique(),   // SQL UNIQUE INDEX
    name: t.string(),
    age: t.number()
  }
}

class Db extends LmdbEnv {
  constructor(path: string) {
    super({path, maxDbs: 10, compression: true})
    this.register(UserSchema) // register in constructor
  }
}
```

- **Root class**: `class Db extends LmdbEnv` — subclass, do not wrap.
- **Schema**: extend `LmdbSchema` with `static db` (sub-DB name), `static key` (primary key builder — never `unique()`/`.index()`), and `static value` (row columns). Optional: `static hookBeforeWrite`/`static hookBeforeRead` (row transforms, must be declared together), `static ttl` (ms, materializes a TTL sub; `0` = TTL sub without default expiry).
- **Registration**: `env.register(SchemaClass)` validates the schema and registers it, returning a typed **`LmdbEnvSub<S>`** handle — every sub method is pre-bound to the schema (`users.put(key, value)`, `users.get(key)`, `users.findByIndex(query)`, ...), fully typed via `ValueOf`/`KeyOf`/`SchemaIndexesOf`. The handle is self-contained (holds its own sub-DB state) and CACHED: `env.register(UserSchema) === env.sub(UserSchema)`. `env.sub(SchemaClass)` fetches an already-registered handle (throws `LmdbSchemaNotRegisteredError` otherwise). `register` is strict: duplicate class → `LmdbSchemaAlreadyRegisteredError`; duplicate `db` → `LmdbDuplicateDbNameError`. The old schema-class-first env methods (schema class as first argument) and the raw `dbName` overloads were REMOVED — sub operations only exist on the handle. Cross-sub work goes through the handle's `owner` (the env): `users.owner.transaction(...)`, `users.owner.sub(OtherSchema).get(key)`.
- **Env opens on construction** — no explicit `open()` call. Defaults: `mapSize` = 4 GB (`4 << 30` bytes), `maxDbs` = 128.
- **Sync reads**: `get()`/`has()`/`count()` are synchronous (delegate to lmdb sync methods).
- **Atomic writes**: `env.transaction()` for every read-then-write pattern. Use a sync callback (non-async) — sub methods are non-async, and a sync callback keeps all writes in the same event turn for proper batching.
- **Cross-repo access**: `this.env.sub(OtherSchema)` inside transactions.
- **Key design**: natural key per repo — no namespace prefixes. Composite keys: `static key = t.array<string>()` (runtime keys are arrays like `["tenant-a", "u1"]`).
- **Counting**: `repo.count()` = O(1), synchronous — prefer over manual counters.
- **Encoding**: default msgpack (fast, Date/Map/Set/BigInt); `encoding: "json"` for human-readable.
- **Materialization guardrail**: `keys()`/`values()`/`entries()`/`like()`/`findByPrefix()`/`deleteByPrefix()` reject with `LmdbMaterializationError` when the result set would exceed `MAX_MATERIALIZE` (`100_000`). Pass `{limit}` below the cap or use `iterate()` (lazy, never guarded) for result sets larger than 100k.
- **Queue v2**: `LmdbQueue` enqueue/dequeue run in ONE synchronous transaction (`transactionSync`) — counter bump + payload write (enqueue) and read + delete (dequeue) commit atomically, FIFO preserved across processes.
- **Service layer**: domain methods do NOT live on the schema. Keep the schema for storage and put business logic in a service class that receives the `Db` env — e.g. `class UserService { constructor(private db: Db) { this.db.register(UserSchema) } }`, then `this.db.sub(UserSchema).put(...)`.

## Embedded Indexes

Secondary indexes are declared as schema value columns — index sub-DBs are auto-created at registration and maintained in the same writer transaction as the primary write. Replaces the manual index-repo + `NonUniqueIndex` wiring (the legacy helper was removed).

```typescript
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    username: t.string().unique(), // SQL UNIQUE — duplicates throw LmdbUniqueConstraintError
    email: t.string().index()      // SQL INDEX — duplicates allowed
  } // no `as const` needed — builder generics carry the literal index markers
}
```

- **Declaration**: `.unique()` on a value column → unique index; `.index(name?)` → non-unique index (explicit name overrides the derived one). The name auto-resolves as a (dotted) field path on the value. Custom `extractor`s and `{dbName}` overrides from the class-style era are gone — schemas auto-resolve field paths only.
- **Key API**: `findByIndex(query, tx?)` → `T[] | T | undefined` (single object-query read; unique-only queries yield `T | undefined`, any non-unique key yields `T[]`, multi-key queries AND all keys; the optional `tx` keeps every point read of the query on the same snapshot inside `readTransaction`/`transaction`), `reindex(name?)` → `{built, skipped}` (rebuilds from primary data; unique collisions land in `skipped`). `findOneByIndex` was removed before release — never use it.
- **Semantics**: `null`/`undefined` extracts are skipped; unique conflicts throw `LmdbUniqueConstraintError` and roll back (self-update allowed); updates free the old index value; `delete`/`deleteByPrefix`/`clear` clean index rows; `putMany`/`update`/`putIfNotExists`/`compareAndSet` maintain indexes; TTL repos supported (extractor runs on the unwrapped value).
- **Anti-patterns**: no `increment`/`decrement`/`putBinary` on indexed repos (rejected with `LmdbError`). An empty query (`{}`), a `null`/`undefined` query value, or an unknown index key throws `LmdbError`. Non-unique (dupSort) index sub-DBs opt out of versions (`useVersions: false` in construction opts) — LMDB rejects dupSort combined with versions.

## LmdbSchema

The single declaration path. Extend `LmdbSchema` with `static db`, `static key` (a single `t` builder), and `static value` — a map of `t` builders. Registering the schema class via `register(SchemaClass)` returns a typed **`LmdbEnvSub<S>`** handle whose methods take no schema argument — row type via `ValueOf<typeof UserSchema>`, key type via `KeyOf`, narrow `findByIndex` via `SchemaIndexesOf`.

```typescript
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index(),
    email: t.string(),
    tags: t.array().nullable(),
    createdAt: t.date()
  } // no `as const` needed — builder generics carry the literal index markers
}

type UserRow = ValueOf<typeof UserSchema>

class Db extends LmdbEnv {
  constructor(path: string) {
    super({path, maxDbs: 10})
    this.register(UserSchema)
  }
}
```

- **register**: `register(SchemaClass)` validates the schema (`LmdbSchema.validate`) and builds the sub state. All operations run on the returned `LmdbEnvSub<S>` handle — fully typed via `ValueOf`/`KeyOf`/`SchemaIndexesOf` (`KeyOf` intersects with `ILmdbKey`, lmdb-js `Key` = `Key[] | string | symbol | number | boolean | Uint8Array`), so a `t.bigint()` key column degrades to `never` at the type level — keep keys to string/number/boolean/array/buffer.
- **`static key` + `static value`**: no `as const` needed — the builder generics carry the literal index markers, so `ValueOf` / `KeyOf` / `SchemaIndexesOf` keep narrowing `findByIndex` per query. `key` is the primary key and must not carry `unique`/`index`. `t.object<T>()` / `t.array<T>()` accept an optional element/value type that `ValueOf` carries into the row type (`t.object<{bio: string}>()` → `{bio: string}`, `t.array<string>()` → `string[]`). Note `ValueOf` columns are `T | undefined` (nullable-by-default) — reads narrow with `?.` / `??`.
- **`static hookBeforeWrite` / `static hookBeforeRead`**: optional row transforms at the repository boundary (`hookBeforeWrite` before LMDB serializes, `hookBeforeRead` after it deserializes — e.g. `Date` → ms `number`). They are forwarded as the repository's codec (constructor opts), replacing the deleted `LmdbCodec` and class-style `static serialize`/`deserialize`. Must be declared TOGETHER; `validate` throws `LmdbError` for write-hook-without-read-hook or vice versa.
- **`static ttl`**: repository-wide default TTL in ms — materializes a TTL sub (per-put `{ttlMs}` overrides it). `static ttl = 0` materializes the TTL sub without a default. TTL-specific members (`put(..., {ttlMs})`, `purgeExpired`) are available on the sub handle: `sub.put(key, value, {ttlMs})` / `sub.purgeExpired()`.
- **Scalar values & dupSort**: `static value` may be a single `t` builder (not just a column map) — `t.number()` for bare-number counters (`increment`/`decrement`), `t.string()`/`t.buffer()` for blob values, plus `static dupSort = true` for one-key-to-many-ordered-values subs. `ValueOf<S>` resolves to the scalar type. `static useVersions` / `static encoding` forward to the sub-DB handle. `register` is the ONLY registration path — the former `_createRepo`/`_createCollection` escape hatches are gone.
- **Runtime guards**: `LmdbSchema.validate` throws `LmdbError` at `register` time for a missing `db`/`key`/`value`, write-hook without read-hook (or vice versa), a unique/indexed `key` column, or duplicate index names.
- **Anti-patterns**: do not add `unique`/`index` to the `key` column (primary key only). Do not extend `LmdbRepository` directly — class-style repos (`static dbName` / `static indexes` / `static codec` / `static ttlMs`) are removed and `register()` does not accept them. Do not use `LmdbCodec` — it was deleted; use schema `hookBeforeWrite`/`hookBeforeRead`.

## API

| Method                          | Return type              | Sync/Async |
| ------------------------------- | ------------------------ | ---------- |
| `get(key, tx?)`                 | `T \| undefined`         | sync       |
| `getStrict(key, tx?)`           | `T` (throws if absent)   | sync       |
| `has(key, tx?)`                 | `boolean`                | sync       |
| `count(tx?)`                    | `number`                 | sync       |
| `put(key, value, ttlOrTx?)`     | `Promise<void>`          | async      |
| `delete(key, tx?)`              | `Promise<boolean>`       | async      |
| `clear(tx?)`                    | `Promise<void>`          | async      |
| `drop()`                        | `Promise<void>`          | async      |
| `keys/values/entries(options?, tx?)` | `Promise<array>`     | async      |
| `iterate(options?, tx?)`        | `AsyncIterableIterator`  | async      |
| `first(tx?)`, `last(tx?)`       | `Promise<tuple\|undefined>` | async   |
| `findByPrefix(prefix, options?, tx?)` | `Promise<array>`    | async      |
| `like(pattern, options?, tx?)`  | `Promise<array>`         | async      |
| `countByPrefix(prefix)`         | `Promise<number>`        | async      |
| `deleteByPrefix(prefix)`        | `Promise<number>`        | async      |
| `prefetch(keys)`                | `Promise<void>`          | async      |
| `getMany(keys)`                 | `Promise<array>`         | async      |

Env-level: `register(SchemaClass)` → `LmdbEnvSub<S>` (only registration path, returns the pre-bound handle); `sub(SchemaClass)` → the cached `LmdbEnvSub<S>` (throws `LmdbSchemaNotRegisteredError` if absent); `isRegistered(SchemaClass)` → `boolean`.

Transaction lifecycle: `'active' | 'committed' | 'aborted' | 'released'` — read transactions that finish normally report `'released'` (not `aborted`). `env.on('beforecommit'|'aftercommit', cb)` / `env.off(...)` attach commit listeners; `close()` detaches them and purges the env from lmdb-js's `allDbs` registry. `deleteByPrefix('')` rejects with `LmdbEmptyPrefixError` (use `clear()`). After `close()`, all ops throw `LmdbEnvClosedError`.

Constructor options: `path`, `maxDbs` (default 128), `compression`, `encoding`, `readOnly`, `mapSize` (default 4 GB), `cache`, `useVersions`, `keyEncoding`, `dupSort`, `noSync`, `encryptionKey`, `commitDelay`, `pageSize`, and all other `lmdb` `open()` options.

## Build & Test

```
nx build lmdb                     # tsup → dist/src/
bun test packages/lmdb/test/
```

## Anti-Patterns

- Do not wrap `LmdbEnv` in a delegation layer — extend it directly.
- Do not use prefix-encoded keys for namespacing — use sub-DBs per repo.
- Do not skip transactions for read-then-write patterns (race condition risk).
- Do not use `@ts-ignore`/`@ts-expect-error` in source.
- `LmdbRepository`/`LmdbCollection`/`RepoOf` were deleted (v1.x). Declare a schema and register it; all operations go through the returned `LmdbEnvSub` handle.
- Do not use `LmdbCodec` / static `codec`/`serialize`/`deserialize`/`ttlMs` — deleted; use schema `hookBeforeWrite`/`hookBeforeRead`/`static ttl`.
- Do not put domain methods on repositories — use a service layer (schema + service class holding the typed repo).
