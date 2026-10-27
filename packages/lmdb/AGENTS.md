# @GRAMSTAX/LMDB — LMDB Database Wrapper

Multi-runtime (Bun, Node.js >=18) key-value database with schema-declared repositories per sub-database.

## Source Layout

```
packages/lmdb/src/
├── env.ts           LmdbEnv — root DB class (lifecycle, register/sub, transactions, migrations, CDC)
├── sub-manager.ts   LmdbEnvSubManager — sub-DB registry + state factory (internal)
├── sub.ts           LmdbEnvSub + MAX_MATERIALIZE — typed self-contained sub handle (all sub methods)
├── schema.ts        LmdbSchema + t builders + ValueOf/KeyOf type helpers
├── search.ts        LmdbSearch — tokenize/fingerprintPk statics + posting-table model (full-text search)
├── queue.ts         LmdbQueue + IQueueSchema — FIFO queue over a dedicated sub-DB
├── sync.ts          LmdbSyncStream + statics (hashRowValue/checkpoint/verify) (differential sync)
├── codec.ts         RecordCodec + getPath/setPath statics (positional record storage)
├── cdc/             Change-data-capture — index.ts (Cdc facade) + store.ts (CdcStore/outbox) + hub.ts (CdcHub/subscribe/tail/ack)
├── backup.ts        LmdbBackup — timestamped backup/list/prune/restore/schedule
├── job-run.ts       JobRunSchema + LmdbJobRun — cron scheduling + run-stamps that survive restarts
├── reader.ts        LmdbReader — read-only attach for 1-writer N-reader
├── transaction.ts   LmdbTransaction — commit/abort/lifecycle
├── errors.ts        LmdbError — the single error class thrown by the package
├── types/           Shared `I*` types, one file per source module (internal)
│   ├── env.ts          ├── indexes.ts       ├── key.ts        ├── range.ts
│   ├── sub.ts          ├── sub-state.ts     ├── sub-manager.ts
│   ├── schema.ts       ├── search.ts        ├── codec.ts
│   ├── cdc.ts          ├── cdc-hub.ts       ├── cdc-store.ts
│   ├── sync.ts         ├── backup.ts        └── transaction.ts
└── index.ts         Barrel (re-exports every runtime module + selected `./types/*`)
```

`types/` is **internal**: the barrel re-exports only `codec`, part of `env`, `indexes`, `key`, `range`, `search`, and `sub-state`. The rest reach consumers indirectly because their owning module re-exports them (e.g. `sync.ts` re-exports `ISyncOptions`/`ISyncResult`). Import types from the package root, never from `dist/src/types/...`.

`MAX_MATERIALIZE` lives in `sub.ts`, not in `types/`.


## Where to Look

| Task | File |
| --- | --- |
| Env lifecycle, register/sub, transactions, migrations, CDC, commit hooks | `env.ts` |
| All sub-DB read/write methods, materialization guardrail, `findByIndex` | `sub.ts` |
| `t` builders, `LmdbSchema.validate`, `ValueOf`/`KeyOf`/`SchemaIndexesOf`, enum/default markers | `schema.ts` |
| FIFO queue, `__queue_meta`, single-transaction enqueue/dequeue | `queue.ts` |
| Full-text search posting tables, `tokenize`/`fingerprintPk` | `search.ts` |
| CDC facade/store/hub — subscribe, tail, ack, prune | `cdc/` |
| Differential sync cursor, checkpoint, verify | `sync.ts` |
| Positional row codec, `getPath`/`setPath` | `codec.ts` |
| Timestamped backup, prune, restore, tar/S3 snapshot, scheduler | `backup.ts` |
| Cron scheduling + persisted run-stamps (`JobRunSchema`), restart-safe jobs | `job-run.ts` |
| Read-only replica attach, transaction lifecycle | `reader.ts`, `transaction.ts` |
| The single error class | `errors.ts` |
| Public exports | `index.ts` |

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
- **Registration**: `env.register(SchemaClass)` validates the schema and registers it, returning a typed **`LmdbEnvSub<S>`** handle — every sub method is pre-bound to the schema (`users.put(key, value)`, `users.get(key)`, `users.findByIndex(query)`, ...), fully typed via `ValueOf`/`KeyOf`/`SchemaIndexesOf`. The handle is self-contained (holds its own sub-DB state) and CACHED: `env.register(UserSchema) === env.sub(UserSchema)`. `env.sub(SchemaClass)` fetches an already-registered handle (throws `LmdbError` otherwise). `register` is strict: duplicate class → `LmdbError`; duplicate `db` → `LmdbError`. The old schema-class-first env methods (schema class as first argument) and the raw `dbName` overloads were REMOVED — sub operations only exist on the handle. Cross-sub work goes through the handle's `owner` (the env): `users.owner.transaction(...)`, `users.owner.sub(OtherSchema).get(key)`.
- **Env opens on construction** — no explicit `open()` call. Defaults: `mapSize` = 4 GB (`4 * 1024 * 1024 * 1024` bytes), `maxDbs` = 128.
- **Sync reads**: `get()`/`has()`/`count()` are synchronous (delegate to lmdb sync methods).
- **Atomic writes**: `env.transaction()` for every read-then-write pattern. Use a sync callback (non-async) — sub methods are non-async, and a sync callback keeps all writes in the same event turn for proper batching.
- **`transactionFast` (no rollback)**: `env.transactionFast()` commits via lmdb-js `db.transaction()` on the writer thread instead of blocking the main thread. It is atomic for commit-visibility but **cannot roll back**: lmdb-js records a callback error and rethrows it without calling `mdb_txn_abort`, so the transaction commits anyway. `tx.abort()` therefore throws `LmdbError` (loud, not silent) and a throwing callback surfaces an error stating its writes were committed. Used internally by `_deleteByPrefix`, `_putMany` and CDC `pruneCdc`. **Never** use it where rollback is load-bearing: `_writeIndexed` (unique-conflict rollback keeps primary row and index entry consistent), `migrate` (`up()` runs inside the transaction), `_purgeExpired` (counts `removeSync` return values), and `_increment` (throws before any write, so the commit-on-throw message would be false). `rootTransactionSync` (queue `enqueue`/`dequeue`) is separate and must stay synchronous for its single-transaction read+delete.
- **Cross-sub access**: `this.env.sub(OtherSchema)` inside transactions.
- **Key design**: natural key per sub — no namespace prefixes. Composite keys: `static key = t.array<string>()` (runtime keys are arrays like `["tenant-a", "u1"]`).
- **Counting**: `sub.count()` = O(1) (`mdb_stat`), synchronous — prefer over manual counters.
- **Pagination**: prefer keyset (`entries({start: lastKey, limit})`, O(log n) seek) over `offset` (O(offset) cursor stepping per page).
- **Encoding**: default msgpack (fast, Date/Map/Set/BigInt); `encoding: "json"` for human-readable.
- **Materialization guardrail**: `keys()`/`values()`/`entries()`/`like()`/`findByPrefix()`/`deleteByPrefix()` reject with `LmdbError` when the result set would exceed `MAX_MATERIALIZE` (`100_000`). The guard counts only the effective range (`start`+`end`, or the inferred prefix bounds for `like()`/`findByPrefix()`) via keys-only counting instead of walking the whole sub-DB — selective patterns on oversized repos pass instead of false-rejecting. Pass `{limit}` below the cap or use `iterate()` (lazy, never guarded) for result sets larger than 100k.
- **Queue v2**: `LmdbQueue` enqueue/dequeue run in ONE synchronous transaction (`rootTransactionSync`) — counter bump + payload write (enqueue) and read + delete (dequeue) commit atomically, FIFO preserved across processes. `peek()`/`size()` are sync (cursor + O(1) stat); only `enqueue`/`dequeue`/`clear` are async. Keys must be string-kind (`t.string()` or string enum); `IQueueSchema` is a constraint type, not a base class.
- **Job scheduling**: `LmdbJobRun` owns a whole restart-safe job, the way `LmdbQueue` owns a queue. `new LmdbJobRun(env)` registers `JobRunSchema` idempotently (`if (!env.isRegistered(S)) env.register(S)`) — a schema (`db: '__job_run'`, `key: t.string()`, `value: {at: t.number()}`), so rows are typed and readable via `env.sub(JobRunSchema)`, with no raw `getDb` and no cast. The `__` prefix marks it engine bookkeeping (like `__queue_meta` / `__sync_state`), so CDC ignores it — the schema class is exported for typing and `isRegistered`, but the rows are not domain data. `.start(key, {pattern, task, timezone?, runOnStart?, catchUp?, onError?, persist?})` → `{stop, runNow, lastRun, nextRun, label}` and owns ALL scheduling: the croner job, the missed-boundary check via `previousRuns(1)`, the one-shot boot catch-up, and the overlap guard. `.missed(key, {pattern, timezone?, now?})` exposes that check standalone; `.lastRun` (sync) / `.recordRun(key, at?)` (async) / `.clear(key)` / `.sub` manage stamps. Stamp only after `task()` resolves — that is what makes a failed run retryable instead of lost. Croner is never given a `name`: its registry is process-global and throws on a duplicate. `LmdbBackup.start()` is a thin wrapper over this. See `example/job-run.ts`.
- **Backup lifecycle**: `LmdbBackup.backup(env, dir, keep?, compact?)` → timestamped `backup-*` dir + prune (foreign files never touched); `.list(dir)` oldest-first; `.prune(dir, keep)` standalone; `.restore(src, dest, {overwrite?})` validates `data.mdb`; `.snapshot(env, {dir, keep?, s3Keep?, format?, compact?, s3?})` for `tar.gz` (`s3Keep` splits remote retention from local `keep`) (optional `tar` peer, atomic `.part` rename, staging cleanup) + S3 PUT-verified upload (optional `@aws-sdk/client-s3` peer) + remote prune; `.restoreArchive/.downloadFromS3(s3, key, destDir, fileName)/.listArchives/.pruneArchives` companions — `downloadFromS3` takes folder and file name separately and writes a `Math.random()`-suffixed `.part` sibling, so parallel downloads into one directory cannot interleave before the rename; `.start(env, {dir, keep?, pattern, timezone?, runOnStart?, format?, compact?, s3?, onError?, persist?, persistKey?})` → `{stop(), runNow(), lastRun(), nextRun(), label()}` — a thin wrapper that supplies the snapshot task and delegates every scheduling decision (croner, the `previousRuns(1)` missed-boundary check, the one-shot boot catch-up, the overlap guard) to `LmdbJobRun.start`; see the Job scheduling bullet. `pattern` is a wall-clock cron expression (LOCAL time unless `timezone` is set), not a duration, and `persist: false` skips the stamp reads/writes and the catch-up. See `example/job-run.ts` and `example/backup-s3-tar.ts`.
  - **`compact` is a dev decision, not a hardcoded flag.** lmdb-js's `backup(path, compact)` requires the boolean, and `mdb_env_copy2` treats it as a compaction pass: `false` (default) is a fast plain copy keeping the free-page layout, `true` rewrites the copy densely — slower, smaller on disk, cheaper to restore. It propagates through all four paths: `env.backup(dest, compact)`, `LmdbBackup.backup(env, dir, keep, compact)`, both `snapshot` branches (`dir` and `tar.gz`), and the `start()` tick via `IBackupStartOptions.compact`. `env.backup()` requires the destination directory to exist already — `mdb_env_copy2` does not `mkdir` and throws `ENOENT`; `LmdbBackup.backup` does `mkdirSync(dest, {recursive: true})` first, which is why the library path works and a direct `env.backup()` call needs the caller to create it.
- **Service layer**: domain methods do NOT live on the schema. Keep the schema for storage and put business logic in a service class that receives the `Db` env — e.g. `class UserService { constructor(private db: Db) { this.db.register(UserSchema) } }`, then `this.db.sub(UserSchema).put(...)`.

## Embedded Indexes

Secondary indexes are declared as schema value columns — index sub-DBs are auto-created at registration and maintained in the same writer transaction as the primary write. Replaces the manual index-sub-DB + `NonUniqueIndex` wiring (the legacy helper was removed).

```typescript
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    username: t.string().unique(), // SQL UNIQUE — duplicates throw LmdbError
    email: t.string().index()      // SQL INDEX — duplicates allowed
  } // no `as const` needed — builder generics carry the literal index markers
}
```

- **Declaration**: `.unique()` on a value column → unique index; `.index(name?)` → non-unique index (explicit name overrides the derived one). The name auto-resolves as a (dotted) field path on the value. Custom `extractor`s and `{dbName}` overrides from the class-style era are gone — schemas auto-resolve field paths only.
- **Key API**: `findByIndex(query, tx?)` → `T[] | T | undefined` (single object-query read; unique-only queries yield `T | undefined`, any non-unique key yields `T[]`, multi-key queries AND all keys; the optional `tx` keeps every point read of the query on the same snapshot inside `readTransaction`/`transaction`), `reindex(name?)` → `{built, skipped}` (rebuilds from primary data; unique collisions land in `skipped`). `findOneByIndex` was removed before release — never use it.
- **Semantics**: `null`/`undefined` extracts are skipped; unique conflicts throw `LmdbError` and roll back (self-update allowed); updates free the old index value; `delete`/`deleteByPrefix`/`clear` clean index rows; `putMany`/`putIfNotExists` and versioned `rootPut` (the optimistic-locking overload — there is no `update` or `compareAndSet` method) maintain indexes; TTL repos supported (extractor runs on the unwrapped value).
- **Anti-patterns**: no `increment`/`decrement`/`putBinary` on indexed repos (rejected with `LmdbError`). An empty query (`{}`), a `null`/`undefined` query value, or an unknown index key throws `LmdbError`. Non-unique (dupSort) index sub-DBs opt out of versions (`useVersions: false` in construction opts) — LMDB rejects dupSort combined with versions.
- **Composite indexes**: `.index([`a`, `b`])` on the first column by convention declares one concatenated-key sub-DB (`{db}:idx:{a+b}`, ordered-binary keys/values) keyed by the ordered tuple. Query with full tuples (point), short tuples (prefix seek), or `{start, end}` bounds (range): `findByIndex({[`a+b`]: [`t1`, `active`]})`. At most one composite key per query; malformed tuples/ranges throw `LmdbError`. Maintenance (put/update/delete/clear/reindex) mirrors single-column behavior.
- **Full-text search**: `t.string().search()` marks a searchable column (storage-only, row type unchanged) backed by a `{db}:search:{col}` term→PK posting table maintained in the write txn. `sub.search(query, {limit?})` ANDs tokenized terms (lowercase + `[^a-z0-9]+` split, no stemming) across all searched columns, ranked by per-column hits. Empty query or search-less schema throws `LmdbError`.
- **CDC subscriptions**: every put/delete appends `{db, type, key, value}` to `__cdc_log` in the same writer txn (aborts publish nothing). `env.subscribe(filter, cb)` delivers `{type, key, value}` post-commit (from-now, idempotent unsubscribe); `env.tailCdc({consumer?, from?, limit?})` / `env.ackCdc(consumer, seq)` give persistent followers resume across restarts; `env.pruneCdc(keep?)` drops entries at/below `min(minAck, newest - keep)`. Capture arms on first CDC touch (earlier writes invisible); `__`-prefixed internal subs are excluded. Deletes are key-only (dupSort exact removes carry value); `clear()` emits one `clear` event.
- **Differential sync**: `source.syncTo(dest, {name?, checkpoint?, limit?, verify?})` copies rows past the checkpoint through a keyset cursor in 500-row chunks (each committed chunk advances the persisted cursor in `__sync_state`, so kills resume mid-stream). Destination writes ride `{sorted: true}` appends. Explicit `checkpoint` runs one-shot without touching stored state. Sync upserts only (never deletes dest extras); verify (default on, counts + hash spot-checks) throws `LmdbError` on divergence — quiesce writes first.
- **Record codec**: row schemas without custom hooks store positionally (arrays in column order, no field names) via the hook slot — ~1.5x faster decode, ~20% smaller bytes, zero type change. Bypasses: custom-hook, TTL, and scalar schemas. Dotted-path columns walk/rebuild.
- **Sorted bulk import**: `putMany(entries, chunkSize?, {sorted?, onProgress?})` with ascending keys skips the B-tree search per put (MDB_APPEND, ~7x at 100k rows); first inversion throws `LmdbError` before anything is written (strictly increasing, non-decreasing for dupSort). `importJSONL(jsonl, {sorted?, onProgress?})` reports per committed chunk.
- **Managed migrations**: steps accept `{version, name, up?, transform?}` — `transform: {schema, schemaVersion?, map, onProgress?}` rewrites every row in 500-row `putMany` batches; crashed steps rerun from scratch (key-stable, no duplicates) with a `transform:<version>` marker committed alongside the version bump. `map` must be idempotent and defensive; `schemaVersion` must equal the schema's `static version` when declared (skew → `LmdbError`); steps need `up` or `transform`.

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
    tags: t.array().optional(),
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
- **`static key` + `static value`**: no `as const` needed — the builder generics carry the literal index markers, so `ValueOf` / `KeyOf` / `SchemaIndexesOf` keep narrowing `findByIndex` per query. `key` is the primary key and must not carry `unique`/`index`. `t.object<T>()` / `t.array<T>()` accept an optional element/value type that `ValueOf` carries into the row type (`t.object<{bio: string}>()` → `{bio: string}`, `t.array<string>()` → `string[]`). `.optional()` columns are omit-able (`field?: T | undefined`) — reads narrow with `?.` / `??`. `.default(v)` / `.$defaultFn(fn)` imply optional and fill at write time when the field is `undefined`.
- **Enum columns (drizzle-style, runtime-validated)**: `t.enum(`active`, `archived`)` (kind inferred: string/number/bigint, homogen only; empty/mixed throws `LmdbError`) or literal params `t.string(`active`, `archived`)` / `t.number(1, 2)` / `t.bigint(1n, 2n)` — zero args stay wide. Out-of-enum writes throw `LmdbError` (extends `LmdbError`) on `put`/`putSync`/`putMany`/`putIfNotExists`, including enum keys; non-enum columns cost nothing. Literals ride the `V` generic so `.optional()` / `.unique()` / `.index()` / `static key` narrow automatically.
- **`static hookBeforeWrite` / `static hookBeforeRead`**: optional row transforms at the repository boundary (`hookBeforeWrite` before LMDB serializes, `hookBeforeRead` after it deserializes — e.g. `Date` → ms `number`). They are forwarded as the repository's codec (constructor opts), replacing the deleted `LmdbCodec` and class-style `static serialize`/`deserialize`. Must be declared TOGETHER; `validate` throws `LmdbError` for write-hook-without-read-hook or vice versa. Declaring hooks (or `static ttl`, or a scalar value) opts out of the automatic record codec.
- **Search/composite markers**: `t.string().search()` provisions a posting table (storage-only); `t.string().index([`a`, `b`])` declares a concatenated-key composite named `a+b` (arity ≥ 2, columns must exist, scalar/key hosts rejected; nested markers rejected like nested indexes).
- **`static version`**: optional integer shape version for migration transforms (`validate` rejects non-integers); transform `schemaVersion` must match it when declared.
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
| `search(query, {limit?})`       | `Promise<KeyOf[]>`       | async      |
| `putMany(entries, chunk?, {sorted?, onProgress?})` | `Promise<void>` | async |
| `importJSONL(jsonl, {sorted?, onProgress?})` | `Promise<number>` | async |
| `syncTo(dest, {name?, checkpoint?, limit?, verify?})` | `Promise<{copied, checkpoint, verified}>` | async |
| `reindex(name?)`                 | `Promise<{built, skipped}>` | async     |

Env-level: `register(SchemaClass)` → `LmdbEnvSub<S>` (only registration path, returns the pre-bound handle); `sub(SchemaClass)` → the cached `LmdbEnvSub<S>` (throws `LmdbError` if absent); `isRegistered(SchemaClass)` → `boolean`. CDC: `subscribe(filter, cb)` → unsubscribe; `tailCdc({consumer?, from?, limit?})` → `Promise<records>`; `ackCdc(consumer, seq)`; `pruneCdc(keep?)` → `Promise<number>`. Migrations: `migrate(migrations)` → `Promise<{applied, currentVersion}>`; `getMigrationVersion()` → `number` (sync).

Transaction lifecycle: `'active' | 'committed' | 'aborted' | 'released'` — read transactions that finish normally report `'released'` (not `aborted`). `env.on('beforecommit'|'aftercommit', cb)` / `env.off(...)` attach commit listeners; `close()` detaches them and purges the env from lmdb-js's `allDbs` registry. `deleteByPrefix('')` rejects with `LmdbError` (use `clear()`). After `close()`, all ops throw `LmdbError`.

Constructor options: `path`, `maxDbs` (default 128), `compression`, `encoding`, `readOnly`, `mapSize` (default 4 GB), `cache`, `useVersions`, `keyEncoding`, `dupSort`, `noSync`, `encryptionKey`, `commitDelay`, `pageSize`, `onWarn`, and all other `lmdb` `open()` options.

## Diagnostics

**The package never writes to `console`.** Every internal warning and recoverable failure is reported to the host through `emitWarn()`, and an env with no listener attached reports nothing. That is the library contract: a library that logs behind an application's back fights the host's logger and makes test output non-deterministic.

- `new LmdbEnv({onWarn: (message) => ...})` attaches a sink at construction, or `env.onWarn(fn)` / `env.offWarn(fn)` attach and detach later.
- `env.emitWarn(message)` (internal) is the single reporting path — `maxDbs` headroom (`sub-manager.ts`), a CDC subscriber whose callback threw (`cdc/hub.ts`), and a failed scheduled tick with no explicit `onError` (`job-run.ts`) all route through it.
- A listener that throws is contained per-occurrence: the remaining listeners still run and the throw cannot escape into a writer transaction or a cron tick.
- `close()` clears the listener set, so host callbacks are released and nothing reports after shutdown.
- Attach a sink in production if you want these; the `maxDbs` one-time warning is the main reason to.

## Ops Sizing (production)

- **`mapSize` is virtual, not RAM** — size it 10-50x expected data (millions of rows need tens of GB). Breaching it throws `LmdbError` at runtime; monitor with `env.getMapSizeUsed()` (registration already refuses below 10% free).
- **`maxDbs` counts everything**: each schema + each `.unique()`/`.index()` + each composite/search table + each queue (`+2` with `__queue_meta`) consumes a sub-DB slot. CDC (`__cdc_log` + `__cdc_meta`) and sync (`__sync_state`) open 2/1 slots lazily on first use — touch a CDC/sync API at boot and size accordingly. `LmdbJobRun` differs from CDC and sync: `JobRunSchema` is registered rather than fetched through `getDb`, so its `__job_run` slot is taken **eagerly** on `new LmdbJobRun(env)` instead of lazily on first use — construct it only if you schedule something. Breaching it throws mid-registration; a one-time diagnostic fires below 32 remaining slots (production configs only) through `env.emitWarn()` — see **Diagnostics** below.
- **Broadcast queries need `{limit}`**: unbounded `findByIndex` on a non-unique key materializes every match — always pass `{limit}` for fan-out reads (`findByIndex({subscribed: true}, undefined, {limit: 1000})`).

## Build & Test

```
nx build lmdb                     # tsup → dist/src/
bun test packages/lmdb/test/
```

## Bench

```
cd packages/lmdb && bun run bench:crud     # per-file: bench:queue|range|queries|transaction|decode|concurrent|codec|index|batch|ttl
cd packages/lmdb && bun run bench:quick    # fast subset (BENCH_N=1000)
cd packages/lmdb && bun run bench:all      # full suite (slow: decode defaults to 500k rows)
```

- Runner: mitata (`bench`/`group`/`run`); shared setup in `bench/_setup.ts` (`setupEnv`, `populateSync`, `benchSize`, `runBench`). Bench labels state the per-iteration request count (`3 reqs`, `500 puts/1 txn`).
- Knobs: `BENCH_N` (dataset size, per file), `BENCH_CONC` (csv concurrency, concurrent only), `BENCH_FILTER` (regex → mitata `run({filter})`, e.g. `BENCH_FILTER="count" bun run bench:crud`).
- Benches are `@internal` scripts — excluded from `bun test` and CI. Destructive ops (delete, dequeue-drain) are self-contained per iteration (unique keys / refill) so mitata's adaptive iteration count never breaks them.

## Agent skills

### Best practices

`skills/lmdb-best-practices/` — rule-based skill synced with the
current source: query patterns (point reads, range scans, keyset pagination,
index reads, bulk writes), index declaration and maintenance, env sizing, schema
design (enums, defaults, hooks, TTL), transactions and queues, full-text search,
CDC, migrations, differential sync, and mitata bench conventions. Load it when
writing, reviewing, or debugging anything in `src/`. Its
`references/_sections.md` is the rule index.

## Anti-Patterns

- Do not wrap `LmdbEnv` in a delegation layer — extend it directly.
- Do not use prefix-encoded keys for namespacing — one sub-DB per entity type.
- Do not skip transactions for read-then-write patterns (race condition risk).
- Do not use `@ts-ignore`/`@ts-expect-error` in source.
- `LmdbRepository`/`LmdbCollection`/`RepoOf` were deleted (v1.x). Declare a schema and register it; all operations go through the returned `LmdbEnvSub` handle.
- Do not use `LmdbCodec` / static `codec`/`serialize`/`deserialize`/`ttlMs` — deleted; use schema `hookBeforeWrite`/`hookBeforeRead`/`static ttl`.
- Do not put domain methods on the schema or the handle — use a service layer (schema + service class holding the typed sub handle).
- Do not write to `console` from `src/` — report through `env.emitWarn(message)` and let the host decide where diagnostics go. This is a hard rule: `grep -rn "console\." src/` must return nothing.
