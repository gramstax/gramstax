<div align="center">
  <h1>@gramstax/lmdb</h1>

  <p>A typed LMDB layer for Bun and Node.js: declare a schema, register it once, and get a sub-database handle with indexes, transactions, queues, backups, and change capture already wired in.</p>
  <p>
    <a href="https://github.com/gramstax/gramstax/actions/workflows/release.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/gramstax/gramstax/release.yml?branch=main&label=build&style=flat&logo=githubactions&logoColor=white"/></a>
    <a href="https://github.com/gramstax/gramstax/actions/workflows/release.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/gramstax/gramstax/release.yml?branch=main&label=CI&style=flat&logo=githubactions&logoColor=white"/></a>
    <img alt="Bun" src="https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white"/>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=typescript&logoColor=white"/>
    <img alt="Node" src="https://img.shields.io/badge/Node-%23333933.svg?style=flat&logo=nodedotjs&logoColor=white"/>
    <br/>
    <img alt="npm" src="https://img.shields.io/npm/v/@gramstax/lmdb?style=flat&logo=npm&logoColor=white&color=CB3837"/>
    <a href="https://gramstax.mintlify.site/"><img alt="Docs" src="https://img.shields.io/badge/Docs-gramstax.mintlify.site-3b82f6.svg?style=flat"/></a>
    <img alt="License" src="https://img.shields.io/badge/License-Apache--2.0-blue.svg"/>
  </p>
</div>

LMDB is a fast, transactional key-value store with a sharp edge: it is
untyped, it has no concept of a table, and every secondary index is a separate
database you have to keep in step with the primary one by hand.

This package keeps the speed and removes the bookkeeping. You declare a schema
as a class, register it once, and get back a handle whose methods are typed
from that declaration. Indexes, TTL, queues, change capture, backups, and
migrations ride along.

```ts
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number(),
    username: t.string().unique(),
    email: t.string().index(),
    age: t.number()
  }
}

const users = env.register(UserSchema)
users.put(1, {id: 1, username: `ada`, email: `ada@example.com`, age: 36})
users.get(1) // fully typed
```

## 💡 Why this package

Most LMDB usage in TypeScript looks like this: you open a database, you pick a
string for a table name, you write values through `any`, and you keep the
indexes in sync by hand. It works, and it is easy to get wrong in the ways
that matter:

| Concern | The usual way | Here |
| :------ | :------------- | :---- |
| Row shape | `any`, checked at runtime by whoever remembers | `ValueOf<typeof UserSchema>`, derived from the column builders |
| Table identity | A string you repeat in every call | `static db`, resolved once at registration |
| Secondary indexes | A second database you maintain yourself | `.unique()` / `.index()` on a column, maintained in the same write transaction |
| Primary-key writes | `db.put(key, value)` with the key type erased | `KeyOf<S>` intersects with what LMDB accepts, so an impossible key is a compile error |
| Read-then-write | Two operations, one of which can interleave | `env.transaction()`, with a callback that cannot yield between the read and the write |
| Materializing a whole table | An OOM crash in production | A cap of 100 000 rows, with a lazy iterator for anything larger |

The package does not hide LMDB. It codifies LMDB's semantics into one
declaration path, so the mistakes that come from assembling the pieces by
hand have nowhere to happen.

### What the package does not do

- It does not hide the storage engine. Your data is an LMDB file, and you can
  open it with any LMDB client.
- It does not replicate. `LmdbReader` is a read-only attach to the same file on
  the same machine, not a cluster.
- It does not log. The package never writes to the console, so diagnostics are
  yours to route.

## ✨ Features

### Storage

- 🗂️ **One declaration path**: extend `LmdbSchema`, set `static db`, `static
  key`, and `static value`, then call `env.register(SchemaClass)`.
- 🔤 **Typed rows and keys**: `ValueOf<S>` for the row shape, `KeyOf<S>` for the
  key, and `ISchemaIndexesOf<S>` to narrow `findByIndex` per query.
- 🧱 **A typed handle**: `register()` returns an `LmdbEnvSub<S>` whose methods
  take no schema argument and are pre-bound to the schema.
- 🧬 **Column builders**: `t.string()`, `t.number()`, `t.date()`, `t.array()`,
  `t.object()`, `t.enum()`, plus `.optional()`, `.default()`, `.unique()`,
  `.index()`, and `.search()`.

### Indexes and search

- 🔎 **Embedded indexes**: a `.unique()` or `.index()` column becomes a real
  index sub-database, maintained inside the same writer transaction as the
  primary write.
- 🧮 **Composite indexes**: a column can declare a composite index over two or
  more columns, keyed by the ordered tuple, and queried with full tuples,
  short tuples, or `{start, end}` bounds.
- 🔠 **Full-text search**: `.search()` provisions a term-to-key posting table,
  and `sub.search(query, {limit?})` ranks by per-column hits.

### Consistency

- 🔒 **Transactions**: `env.transaction()` for read-then-write, plus
  `readTransaction()` for a consistent snapshot and `transactionFast()` for a
  write that cannot roll back.
- 🕒 **TTL**: `static ttl` gives a sub-database a default expiry, and
  `sub.purgeExpired()` reclaims what lapsed.
- 🔁 **Change data capture**: every put and delete is appended to a durable
  outbox in the same transaction, and `env.subscribe()` delivers the events
  after commit.
- 📤 **Differential sync**: `source.syncTo(dest)` copies rows past a checkpoint
  in resumable chunks and verifies the result.

### Operations

- 📬 **Queues**: `LmdbQueue` gives you FIFO enqueue and dequeue in a single
  transaction.
- 🗓️ **Scheduled jobs**: `LmdbJobRun` persists run stamps, so a cron job knows
  after a restart whether it already ran.
- 💾 **Backups**: timestamped directories, `tar.gz` archives, and optional S3
  upload, with pruning and restore.
- 🔀 **Migrations**: versioned steps with an optional row transform that
  rewrites data in batches.

## 🚀 Quick Start

### 1. Prerequisites

- [Bun](https://bun.sh) v1.0+ or Node.js v18+
- `typescript ^6.0.3` (peer dependency)

### 2. Install

```bash
bun add @gramstax/lmdb
```

### 3. Declare a schema

A schema is a class. `static db` names the sub-database, `static key` is the
primary key builder, and `static value` maps the columns.

```ts
// schema.ts
import {LmdbSchema, t} from "@gramstax/lmdb"

export class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index(),
    email: t.string(),
    age: t.number()
  }
}
```

No `as const` is needed: the builder generics carry the index markers, so
`ValueOf`, `KeyOf`, and `ISchemaIndexesOf` keep narrowing on their own.

### 4. Open an env and register

`LmdbEnv` opens on construction. There is no `open()` call.

```ts
// db.ts
import {LmdbEnv} from "@gramstax/lmdb"
import {UserSchema} from "./schema"

export class Db extends LmdbEnv {
  users = this.register(UserSchema)

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true})
  }
}
```

`register()` returns a handle that is cached per schema class, so
`env.register(UserSchema) === env.sub(UserSchema)`.

### 5. Read and write

```ts
const db = new Db(`./data/users`)

await db.users.put(1, {id: 1, username: `ada`, email: `ada@example.com`, age: 36})

db.users.get(1) // {id: 1, username: "ada", ...} | undefined
db.users.count() // 1
db.users.findByIndex({username: `ada`}) // one row, typed
```

Point reads are synchronous, because the native calls are. Writes are
asynchronous, because LMDB batches them on the writer thread.

### 6. Next steps

- Put a service layer between the schema and your handlers: the schema owns
  storage, the service owns business logic.
- Read the [storage guide](https://github.com/gramstax/gramstax/blob/main/docs-site/guides/storage-lmdb.md)
  for the full surface, or the [package skill](https://github.com/gramstax/gramstax/blob/main/skills/lmdb-best-practices/SKILL.md)
  for the rules.

## 📖 Usage

### The schema class

`LmdbSchema` is the single declaration path. Extend it, declare three statics,
and register it.

```ts
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    id: t.number().unique(),
    username: t.string().index(),
    email: t.string(),
    tags: t.array().optional(),
    createdAt: t.date()
  }
}

type UserRow = ValueOf<typeof UserSchema>
```

| Static | Meaning |
| :------ | :------ |
| `db` | Sub-database name. Required, non-empty, unique per env |
| `key` | The primary key builder. Required, and it must not carry `unique()` or `.index()` |
| `value` | A map of column builders (a row shape) or a single builder (a scalar sub). Required |
| `dupSort?` | One key to many ordered values. Requires a scalar `value` |
| `useVersions?` | Per-schema record versioning; defaults to the env setting |
| `encoding?` | Per-sub-database value encoding, overriding the env default |
| `hookBeforeWrite?` | Transforms a row before LMDB serializes it. Must be declared together with `hookBeforeRead` |
| `hookBeforeRead?` | Transforms a decoded value back into a row. Must be declared together with `hookBeforeWrite` |
| `ttl?` | Repository-wide default expiry in ms. `0` materializes the TTL sub with no default |
| `version?` | Integer row-shape version, checked against a migration transform's `schemaVersion` |

`LmdbSchema.validate(schemaClass)` runs at registration and throws
`LmdbError` for: a missing `db`, `key`, or `value`; a `key` column carrying
`unique`, `index`, or a composite marker; a write hook without a read hook (or
the reverse); a non-integer `version`; `dupSort: true` on a row shape; a
`.search()` marker on a non-string column; a composite marker with fewer than
two columns or naming a column that does not exist; a nested index marker; and
a duplicate index name.

### Column builders

| Builder | Notes |
| :------- | :----- |
| `t.string()`, `t.number()`, `t.bigint()`, `t.boolean()`, `t.date()`, `t.buffer()`, `t.any()` | Zero-argument, wide columns |
| `t.string(`a`, `b`)`, `t.number(1, 2)`, `t.bigint(1n, 2n)` | Literal-validated columns. With no arguments the column stays wide |
| `t.enum(`a`, `b`)` | Kind inferred from the first literal. All values must share that kind, and at least one is required, or `LmdbError` is thrown |
| `t.object<T>()`, `t.array<T>()`, `t.map<T>()`, `t.set<T>()` | Shape columns. `ValueOf` carries the element type into the row |

Chain methods:

| Method | Effect |
| :----- | :----- |
| `.optional()` | The column is omit-able: `field?: T \| undefined` |
| `.default(v)` / `.$defaultFn(fn)` | Implies optional and fills at write time when the field is `undefined` |
| `.unique()` | A unique index. A duplicate write throws `LmdbError` and rolls back |
| `.index(name?)` | A non-unique index. The name defaults to the dotted field path |
| `.search()` | A searchable column, backed by a posting table |

A write that falls outside an enum's literals throws `LmdbError`, on `put`,
`putSync`, `putMany`, and `putIfNotExists`, including for enum keys.

### The typed handle

`register()` returns an `LmdbEnvSub<S>`. It is self-contained, holds its own
sub-database state, and is cached, so `env.register(UserSchema) === env.sub(UserSchema)`.

| Group | Members |
| :---- | :------ |
| Identity | `dbName` · `owner` (the owning `LmdbEnv`) · `schemaClass` · `keyType` · `valueType` (type-level only) |
| Point reads (sync) | `get(key, tx?)` · `getStrict(key, tx?)` (throws when absent) · `has(key, tx?)` · `count(tx?)` (O(1) `mdb_stat`) |
| Writes (async) | `put(key, value, ttlOrTx?)` · `putSync` · `removeSync` · `putIfNotExists(key, value)` · `delete(key, tx?)` · `clear(tx?)` · `drop()` |
| Range reads (async) | `keys` · `values` · `entries` · `iterate` (lazy, returns an `AsyncIterableIterator`) · `first(tx?)` · `last(tx?)` · `getKeys(options?)` (sync `Iterable`) |
| Prefix reads (async) | `like(pattern, options?, tx?)` · `findByPrefix(prefix, options?, tx?)` · `countByPrefix(prefix)` · `deleteByPrefix(prefix)` (rejects an empty prefix) |
| Bulk (async) | `putMany(entries, chunk?, {sorted?, onProgress?})` · `importJSONL(jsonl, {sorted?, onProgress?})` · `exportJSONL()` |
| Batch reads (async) | `getMany(keys)` · `prefetch(keys)` |
| Binary (mixed) | `putBinary(key, buf)` (async) · `getBinary(key)` and `getBinaryFast(key)` (sync) |
| Scalar counters | `increment(key, delta?)` · `decrement(key, amount?)` (async) |
| dupSort values | `addValue` · `removeValue` (async) · `getValues(key)` (async) · `getValuesCount(key)` (sync) |
| Index reads (async) | `findByIndex(query, tx?, {limit?})` · `reindex(name?)` |
| Search (async) | `search(query, {limit?})` |
| Versions | `getEntry(key)` (sync) |
| TTL | `put(key, value, {ttlMs})` · `purgeExpired()` |
| Sync (async) | `syncTo(dest, {name?, checkpoint?, limit?, verify?})` |

`putMany` takes `[key, value]` tuples, not bare objects:

```ts
await users.putMany([
  [1, {id: 1, username: `ada`, email: `ada@example.com`, age: 36}],
  [2, {id: 2, username: `grace`, email: `grace@example.com`, age: 45}]
])
```

### Transactions

`env.transaction()` is the answer to every read-then-write pattern. The
callback must be synchronous, because the sub methods are not async and a
yield between the read and the write would let another writer slip in.

```ts
await env.transaction((tx) => {
  const current = counter.get(`tickets`) ?? 0
  counter.put(`tickets`, current + 1, tx)
})
```

`tx.commit()` marks the transaction for commit; `tx.abort()` rolls it back;
`tx.release()` finishes a read transaction without reporting an abort.

`env.transactionFast()` is the other one, and the difference matters. It
commits through the writer thread instead of blocking the main thread, so it
is atomic for commit visibility but **cannot roll back**: lmdb-js records a
callback error and rethrows it without aborting the transaction, so the writes
commit anyway. `tx.abort()` inside it throws `LmdbError` rather than
pretending to roll back, and a throwing callback surfaces an error that says
its writes were committed.

Use `transactionFast()` only where rollback carries no meaning. Never use it
for a unique-conflict write (the rollback is what keeps the primary row and
the index entry consistent), for a migration (the `up()` step runs inside the
transaction), for a purge (it counts the removed rows), or for a counter
increment (it throws before any write, so the commit-on-throw message would be
false).

### Indexes

A `.unique()` or `.index()` column becomes a real index sub-database, created
at registration and maintained in the same writer transaction as the primary
write.

```ts
class UserSchema extends LmdbSchema {
  static db = `users`
  static key = t.number()
  static value = {
    username: t.string().unique(),
    email: t.string().index()
  }
}
```

```ts
users.findByIndex({username: `ada`}) // one row, or undefined
users.findByIndex({email: `a@example.com`}) // every matching row
users.findByIndex({username: `ada`, email: `a@example.com`}) // both keys ANDed
```

The return type follows the query: a query over only unique indexes yields one
row, and any non-unique key widens the result to an array.

| Rule | Behaviour |
| :--- | :--------- |
| A `null` or `undefined` indexed value | The row is skipped by the index. Query it by primary key |
| A unique conflict | Throws `LmdbError` and rolls back. Updating a row to its own value is allowed |
| An update | The old index value is freed and the new one written |
| A delete, a prefix delete, or a clear | The matching index rows go with it |
| `putMany`, `putIfNotExists`, and versioned `rootPut` | Maintain the indexes |
| A TTL sub | The extractor runs on the unwrapped value |
| An empty query `{}` | Throws `LmdbError` |
| An unknown index key | Throws `LmdbError` |

Composite indexes declare one concatenated-key sub-database:

```ts
static value = {
  tenant: t.string(),
  status: t.string(),
  team: t.string().index([`tenant`, `status`])
}
```

```ts
users.findByIndex({[`tenant+status`]: [`t1`, `active`]}) // point
users.findByIndex({[`tenant+status`]: [`t1`]}) // prefix seek
users.findByIndex({[`tenant+status`]: {start: [`t1`], end: [`t2`]}}) // range
```

At most one composite key per query. A malformed tuple or range throws
`LmdbError`.

### Full-text search

A `.search()` column is storage-only: the row type does not change.

```ts
static value = {
  bio: t.string().search()
}
```

```ts
users.search(`machine learning`) // primary keys, ranked by per-column hits
```

Terms are lowercased and split on `[^a-z0-9]+`, with no stemming, so
non-ASCII letters act as separators. An empty query, or a schema with no
searchable column, throws `LmdbError`.

### TTL

```ts
class SessionSchema extends LmdbSchema {
  static db = `sessions`
  static key = t.string()
  static value = {sid: t.string(), data: t.string()}
  static ttl = 3_600_000 // one hour
}
```

`static ttl = 0` materializes the TTL sub with no default. A per-write
`{ttlMs}` overrides the schema default, and `sub.purgeExpired()` removes what
has lapsed.

### Queues

`LmdbQueue` is a FIFO queue over one sub-database. Enqueue bumps a monotonic
counter and stores the payload in one synchronous transaction; dequeue reads
the head and deletes it in one. The id and the payload are always visible
together, and FIFO order holds across processes.

```ts
class JobSchema extends LmdbSchema {
  static db = `jobs`
  static key = t.string()
  static value = {payload: t.string()}
}

const queue = new LmdbQueue(env, JobSchema)

const id = await queue.enqueue({payload: `hello`}) // "000000000001"
const head = await queue.dequeue() // ["000000000001", {payload: "hello"}]
queue.size() // 0
```

The key must be string-kind (`t.string()` or a string enum). `peek()` and
`size()` are synchronous; `enqueue`, `dequeue`, and `clear` are asynchronous.

Dequeue removes the job atomically, so a job is never handed out twice. There
is no acknowledgement and no visibility timeout, which means a consumer that
takes a job and then dies has lost it. Treat the queue as at-most-once
delivery and make the handler idempotent if that matters.

### Scheduled jobs

`LmdbJobRun` owns a whole restart-safe job, the way `LmdbQueue` owns a queue.

```ts
const jobs = new LmdbJobRun(env)

const handle = jobs.start(`nightly-report`, {
  pattern: `0 3 * * *`,
  timezone: `Asia/Jakarta`,
  task: async () => {
    await buildReport()
  }
})

handle.stop()
```

The constructor registers `JobRunSchema` idempotently, so the run stamps are
typed and readable through `env.sub(JobRunSchema)` rather than through a raw
handle and a cast. The `__` prefix marks it as engine bookkeeping, like
`__queue_meta` and `__sync_state`, so change capture ignores it.

`start()` owns all the scheduling: the cron job, the missed-boundary check
through `previousRuns(1)`, the one-shot catch-up at boot, and the overlap
guard. `missed(key, {pattern, timezone?, now?})` exposes that check on its
own. Stamp the run only after `task()` resolves, which is what makes a failed
run retryable instead of lost.

`pattern` is a wall-clock cron expression in local time unless `timezone` is
set, not a duration. `persist: false` skips the stamp reads and writes, and
with them the catch-up.

### Backups

```ts
await LmdbBackup.backup(env, `./backups`) // a timestamped directory
LmdbBackup.list(`./backups`) // oldest first
await LmdbBackup.prune(`./backups`, 3) // keep the three newest
await LmdbBackup.restore(`./backups/backup-2026...`, `./restored`)
```

Only `backup-*` entries are ever listed or pruned, so foreign files in the
directory are left alone. `snapshot()` produces a `tar.gz` archive instead of a
directory and can upload it to S3.

The `tar.gz` and S3 paths load their peer dependencies lazily: an install
without `tar` or `@aws-sdk/client-s3` pays nothing, and only those two paths
throw. `downloadFromS3` writes a randomly suffixed `.part` sibling and renames
it into place, so parallel downloads into one directory cannot interleave.

`compact` is a decision, not a flag that happens to be there. lmdb-js's
`backup(path, compact)` requires the boolean, and `mdb_env_copy2` treats it as
a compaction pass: `false` (the default) is a fast plain copy that keeps the
free-page layout, and `true` rewrites the copy densely, which is slower,
smaller on disk, and cheaper to restore. It propagates through all four paths:
`env.backup(dest, compact)`, `LmdbBackup.backup(env, dir, keep, compact)`, both
`snapshot` branches, and the `start()` tick.

One asymmetry is worth knowing: `env.backup()` requires the destination
directory to exist already, because `mdb_env_copy2` does not create it and
throws `ENOENT`. `LmdbBackup.backup` creates it for you, which is why the
library path works and a direct `env.backup()` call does not.

`LmdbBackup.start(env, {...})` schedules the whole thing. It is a thin wrapper
that supplies the snapshot task and delegates every scheduling decision to
`LmdbJobRun.start`.

### Change data capture

Every put and delete appends `{db, type, key, value}` to `__cdc_log` in the
same writer transaction, so an aborted write publishes nothing.

```ts
const unsubscribe = env.subscribe(`users`, (event) => {
  console.log(event.type, event.key)
})
```

The filter is a sub-database name, or `{db, op?}` to narrow to `put`, `delete`,
or `clear`. Delivery is post-commit. A delete is key-only, and a clear emits a
single `clear` event.

For a follower that must survive a restart, `env.tailCdc({consumer?, from?,
limit?})` and `env.ackCdc(consumer, seq)` persist an acknowledgement, and
`env.pruneCdc(keep?)` drops entries at or below `min(minAck, newest - keep)`.

Capture arms on the first CDC touch, so writes made before that are invisible.
Internal `__`-prefixed sub-databases are excluded.

### Differential sync

```ts
const result = await source.syncTo(dest, {name: `users`, verify: true})
// {copied, checkpoint, verified}
```

Rows past the checkpoint are copied through a keyset cursor in 500-row chunks,
and each committed chunk advances the persisted cursor in `__sync_state`, so a
kill resumes mid-stream. An explicit `checkpoint` runs one-shot without
touching the stored state.

Sync upserts and never deletes destination-only rows. Verify is on by default
and counts rows plus hash spot-checks; a divergence throws `LmdbError`.
Quiesce writes on both sides before running it.

### Migrations

```ts
await env.migrate([
  {
    version: 2,
    name: `add-age`,
    transform: {
      schema: UserSchema,
      schemaVersion: 1,
      map: row => ({...row, age: 0})
    }
  }
])
```

A step needs either `up` or `transform`. A transform rewrites every row in
500-row `putMany` batches and commits a `transform:<version>` marker alongside
the version bump, so a crashed step reruns from scratch with no duplicates.
`map` must be idempotent and defensive. When the schema declares
`static version`, the transform's `schemaVersion` must match it, or the
migration throws `LmdbError`.

### Diagnostics

**The package never writes to `console`.** Every internal warning and
recoverable failure is reported to the host through `emitWarn()`, and an env
with no listener attached reports nothing. That is the library contract: a
library that logs behind an application's back fights the host's logger and
makes test output non-deterministic.

```ts
const env = new LmdbEnv({path, onWarn: (message) => logger.warn(message)})
```

Or attach and detach later with `env.onWarn(fn)` and `env.offWarn(fn)`.
`env.emitWarn(message)` is the single reporting path: the `maxDbs` headroom
warning, a change-capture subscriber whose callback threw, and a failed
scheduled tick with no explicit `onError` all route through it.

A listener that throws is contained per occurrence: the remaining listeners
still run, and the throw cannot escape into a writer transaction or a cron
tick. `close()` clears the listener set, so host callbacks are released and
nothing reports after shutdown.

### Ops sizing

- **`mapSize` is virtual, not RAM.** Size it 10 to 50 times your expected data;
  millions of rows need tens of gigabytes. Breaching it throws `LmdbError` at
  runtime, and registration refuses a map that is already below 10 percent
  free. `env.getMapSizeUsed()` returns `{total, used, free, ratio}`.
- **`maxDbs` counts everything.** Each schema, each `.unique()` or `.index()`,
  each composite or search table, and each queue (two slots, with
  `__queue_meta`) consumes a slot. Change capture (`__cdc_log` and
  `__cdc_meta`) and sync (`__sync_state`) open their slots lazily on first use,
  so touch those APIs at boot and size accordingly.
- **`LmdbJobRun` is the exception.** Its `__job_run` slot is taken eagerly on
  `new LmdbJobRun(env)`, because the schema is registered rather than fetched
  lazily. Construct it only if you schedule something.
- **A diagnostic fires below 32 remaining slots** in production configs
  only, through `env.emitWarn()`.
- **Broadcast queries need a `{limit}`.** An unbounded `findByIndex` on a
  non-unique key materializes every match.

## 🔍 How it works

### The sub-database layout

One schema is one LMDB sub-database. An index column is another sub-database
whose name is derived from the schema's `db` name, so `users` with a
`username` index owns `users` and one index sub-database beside it. Everything
the engine owns for itself starts with `__`: `__queue_meta`, `__job_run`,
`__cdc_log`, `__cdc_meta`, and `__sync_state`.

Because the name is derived, two schemas that want the same `db` collide at
registration, and `LmdbError` says so.

### The record codec

A row schema with no custom hooks, no TTL, and not a scalar shape stores its
rows positionally: the row encodes as an array in column declaration order,
and the field names never reach disk. The decode walks the same order and
rebuilds the object. The type is unchanged, so nothing in your code notices.

The package's own benchmark, on a 12-field bot-shaped row at N=2000 with
500-operation windows, measured 528 bytes per value against 659 for the
uncompressed baseline (about 20 percent smaller) and a sequential read of
5.05 ms against 8.05 ms (about 1.6 times faster). The write path was at
parity. The exact ratio depends on the row shape, so measure your own rows
before you rely on it.

### The materialization guardrail

`keys()`, `values()`, `entries()`, `like()`, `findByPrefix()`, and
`deleteByPrefix()` reject with `LmdbError` when the result set would exceed
`MAX_MATERIALIZE`, which is 100 000 rows. The guard counts only the effective
range, using a keys-only count instead of walking the whole sub-database, so a
selective pattern on an oversized repository passes instead of false-rejecting.

Pass a `{limit}` below the cap, or use `iterate()`, which is lazy and never
guarded.

## 📜 Scripts

Inside `packages/lmdb`:

```bash
bun run build                 # tsup → dist/src
bun run bench:crud            # one bench file; see the table below
bun run bench:quick           # a fast subset (BENCH_N=1000)
bun run bench:all             # the full suite, slow
```

The per-file benchmarks are `bench:crud`, `bench:queue`, `bench:range`,
`bench:queries`, `bench:transaction`, `bench:decode`, `bench:concurrent`,
`bench:codec`, `bench:index`, `bench:batch`, and `bench:ttl`.

The runner is mitata, with shared setup in `bench/_setup.ts`. The knobs are
`BENCH_N` for the dataset size, `BENCH_CONC` for csv concurrency, and
`BENCH_FILTER` for a regex that selects a single bench. The benchmarks are
`@internal` scripts: they are excluded from `bun test` and from CI.

From the repository root:

```bash
bun run test:packages       # bun test ./packages
bun run build:lmdb          # nx build lmdb
bun run lint:packages       # biome lint ./packages
```

## 🗂️ Project Structure

```text
packages/lmdb/
├── src/
│   ├── index.ts             # Public barrel: 18 runtime values, then 50 type definitions
│   ├── env.ts               # LmdbEnv: lifecycle, register/sub, transactions, migrations, CDC
│   ├── sub.ts               # LmdbEnvSub + MAX_MATERIALIZE: the typed handle
│   ├── sub-manager.ts       # LmdbEnvSubManager: the sub-database registry (internal)
│   ├── schema.ts            # LmdbSchema + the t builders + ValueOf/KeyOf
│   ├── transaction.ts       # LmdbTransaction: commit, abort, release, lifecycle
│   ├── errors.ts            # LmdbError: the single error class
│   ├── queue.ts             # LmdbQueue: FIFO over a dedicated sub-database
│   ├── job-run.ts           # JobRunSchema + LmdbJobRun: restart-safe scheduling
│   ├── backup.ts            # LmdbBackup: directories, archives, S3, pruning, restore
│   ├── reader.ts            # LmdbReader: read-only attach
│   ├── search.ts            # LmdbSearch: tokenize and fingerprintPk
│   ├── sync.ts              # LmdbSyncStream: differential sync
│   ├── codec.ts             # RecordCodec: positional row storage
│   ├── cdc/
│   │   ├── index.ts         # Cdc: the per-env facade
│   │   ├── hub.ts           # CdcHub: the subscriber hub
│   │   └── store.ts         # CdcStore: the durable outbox
│   └── types/               # 17 internal type modules, one per source module
├── test/                    # 43 bun:test files + test-helpers.ts
├── example/                 # 23 runnable examples, one per feature area
├── bench/                   # 11 bench files + shared setup
├── AGENTS.md                # Package conventions and architecture facts
├── tsup.config.ts           # Bundler: cjs + esm, dts
└── package.json             # name: @gramstax/lmdb · license: Apache-2.0
```

`src/types/` is internal. The barrel re-exports only part of it, and the rest
reach you indirectly because their owning module re-exports them. Import types
from the package root, never from `dist/src/types/...`.

This package is one of four in the repository; `gramstax`, `create-gramstax`
and `@gramstax/worker-thread` are siblings under
[`packages/`](https://github.com/gramstax/gramstax/tree/main/packages).

## 🔧 Configuration

### Constructor options

`LmdbEnv` forwards every option to LMDB's own `open()`.

| Option | Default | Meaning |
| :----- | :------ | :------ |
| `path` | **required** | The data directory |
| `maxDbs` | `128` | The number of sub-database slots |
| `mapSize` | 4 GB | The virtual address space ceiling |
| `compression` | _none_ | LZ4 compression, or `ICompressionOptions` for `{threshold?, dictionary?}` |
| `encoding` | `msgpack` | `msgpack` · `json` · `cbor` · `string` · `binary` · `ordered-binary` |
| `readOnly` | `false` | Open the store read-only |
| `useVersions` | _none_ | Per-row versioning, which enables optimistic locking |
| `keyEncoding`, `dupSort`, `noSync`, `encryptionKey`, `commitDelay`, `pageSize`, `cache` | _none_ | Forwarded to LMDB unchanged |
| `onWarn` | _none_ | The diagnostics sink, attached at construction |

The encoding default is msgpack, which is fast and handles `Date`, `Map`,
`Set`, and `BigInt`. Use `encoding: "json"` when you want to read the file
with something else.

### Env members

| Member | Purpose |
| :----- | :------ |
| `register(SchemaClass)` | Validates the schema and returns the typed handle. The only registration path |
| `sub(SchemaClass)` | The cached handle for an already-registered schema. Throws `LmdbError` when it is not registered |
| `isRegistered(SchemaClass)` | Whether the schema class is registered |
| `transaction(fn)` / `transactionFast(fn)` / `readTransaction(fn)` | The three transaction shapes |
| `subscribe(filter, cb)` · `tailCdc(options?)` · `ackCdc(consumer, seq)` · `pruneCdc(keep?)` | The change-capture surface |
| `migrate(migrations)` · `getMigrationVersion()` | The migration surface |
| `backup(destPath, compact?)` | A direct copy, through lmdb-js. The destination directory must exist |
| `getMapSizeUsed()` | `{total, used, free, ratio}`, measured with `statSync` on the data file |
| `getDb(name, overrides?)` · `openDB(name, opts?)` | The low-level raw sub-database open. Reach for a typed `register` handle instead |
| `on` / `off('beforecommit' \| 'aftercommit', cb)` | Commit listeners. `close()` detaches them all |
| `onWarn(fn)` · `offWarn(fn)` · `emitWarn(message)` | The diagnostics surface |
| `rootGetEntry` · `rootPut` · `rootPutSync` · `rootGetRange` · `rootGetKeys` · `rootGetCount` · `rootDoesExist` | The raw root-database surface, for untyped access |
| `rootTransactionSync(action, flags?)` | A synchronous transaction on the root database. The queue's `enqueue` and `dequeue` run inside one |
| `readerList()` | A debugging description of the current reader locks |
| `getWriteTxnId()` | The current write-transaction id, callable inside a transaction callback |
| `resetReadTxn()` | Renews the shared read snapshot so a long-lived reader sees new writes |
| `close()` | Closes the store, clears the sub cache and listeners, and purges this env's handles from lmdb-js's `allDbs` registry. Every operation throws afterwards |

`rootPut` has three forms: `rootPut(id, value)`, the optimistic-locking
`rootPut(id, value, version, ifVersion?)` (which requires `useVersions`), and
`rootPut(id, value, options)` for native put options. There is no `update` and
no `compareAndSet` method.

`env.on('beforecommit' | 'aftercommit', cb)` attaches a commit listener, and
`env.off(...)` detaches it. `close()` detaches them all.

## 🏗️ Architecture

### One declaration path

There is exactly one way to declare storage: extend `LmdbSchema`, set `db`,
`key`, and `value`, and register it. The older escape hatches, where a
repository class carried `static dbName`, `static indexes`, `static codec`, or
`static ttlMs`, are gone, and so are `LmdbRepository`, `LmdbCollection`, and
`RepoOf`.

That is what makes the type helpers possible. `ValueOf`, `KeyOf`, and
`SchemaIndexesOf` read the builder generics, so the row type, the key type,
and the accepted index queries all come from the same declaration.

### Storage and logic are separate

Domain methods do not live on the schema, and they do not live on the handle.
Keep the schema for storage and put the logic in a service class that holds
the typed handle:

```ts
class UserService {
  constructor(private db: Db) {
    this.db.users = this.db.register(UserSchema)
  }

  async create(userId: number, title: string) {
    return this.db.owner.transaction(async (tx) => {
      const id = await this.nextId(userId)
      await this.db.users.put(id, {id, userId, title}, tx)
      return id
    })
  }
}
```

### Indexes are part of the write

An index is not a view. It is a second sub-database, and it is written inside
the same transaction as the primary row. That is why a unique conflict can
roll back both, and why an update that frees the old index value cannot leave
a stale entry behind.

### Guardrails worth knowing

- **Do not wrap `LmdbEnv` in a delegation layer.** Extend it directly.
- **Do not use prefix-encoded keys for namespacing.** Use one sub-database per
  entity type.
- **Do not skip a transaction for a read-then-write pattern.** That is a race.
- **Do not put domain methods on the schema or the handle.** Use a service
  layer.
- **Do not add `unique` or `index` to the `key` column.** The key is the
  primary key.
- **Do not use `increment`, `decrement`, or `putBinary` on an indexed
  sub-database.** They are rejected with `LmdbError`.
- **Do not write to `console` from `src/`.** Report through
  `env.emitWarn(message)` and let the host decide where diagnostics go.

## 📚 API Reference

The package exports **68 names**: 18 runtime values and 50 type definitions.

| Module | What it gives you | Key exports |
| :----- | :---------------- | :---------- |
| `./env` | The root database class | `LmdbEnv` |
| `./sub` | The typed handle | `LmdbEnvSub`, `MAX_MATERIALIZE` |
| `./schema` | The declaration path | `LmdbSchema`, `t`, `ValueOf`, `KeyOf` |
| `./transaction` | The transaction wrapper | `LmdbTransaction` |
| `./errors` | The single error class | `LmdbError` |
| `./queue` | FIFO over a sub-database | `LmdbQueue`, `IQueueSchema` |
| `./job-run` | Restart-safe scheduling | `LmdbJobRun`, `JobRunSchema` |
| `./backup` | Backups, archives, S3 | `LmdbBackup` |
| `./reader` | Read-only attach | `LmdbReader` |
| `./search` | Full-text primitives | `LmdbSearch` |
| `./sync` | Differential sync | `LmdbSyncStream` |
| `./codec` | Positional row storage | `RecordCodec` |
| `./cdc` | Change data capture | `Cdc`, `CdcHub`, `CdcStore` |

### `./schema`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `t` | `const` | The column builders |
| `LmdbSchema` | `class` | The abstract base every schema extends. Abstract in the type system, concrete at runtime |
| `ValueOf<S>` | `type` | The row shape of schema class `S`, with `.optional()` and `.default()` columns reflected in requiredness |
| `KeyOf<S>` | `type` | The key type of `S`, intersected with what LMDB accepts, so an impossible key is a compile error |
| `ISchemaIndexesOf<D>` | `type` | The index-name map for a schema, keyed by the declared `unique`/`index`/composite literals. This is what narrows `findByIndex` |
| `IColumnBuilder` | `type` | One column builder: `kind` · `isUnique` · `indexName` · `indexFlag` · `compositeColumns` · `isSearchable` · `isOptional` · `enumValues` · `defaultValue` · `hasDefault` · `defaultFn`, plus the chain methods `unique()` · `index(name?)` · `search()` · `optional()` · `default(v)` · `$defaultFn(f)` |
| `IColumnKind` | `type` | The literal union of column kinds: `string` · `number` · `bigint` · `boolean` · `object` · `array` · `date` · `buffer` · `any` · `map` · `set` |
| `IColumnIndexFlag` | `type` | The literal union of index markers: `none` · `index` · `unique`. Carried as a generic so index names stay literal in `ISchemaIndexesOf` |
| `IInferSchemaValue<D>` | `type` | Walks a column map into the row object type |
| `IInferSchemaKey<C>` | `type` | Resolves one key builder into its LMDB key type (a `bigint` key degrades to `never`) |
| `IAnyColumnBuilder` | `type` | The erased `IColumnBuilder`, so a generic column map can be stored and passed without losing assignability |
| `IAnyShapeParam` | `type` | The union a shape argument may take: one builder, an array of builders, or a `{key, value}` record |
| `IShapeValueOf<S>` | `type` | The value type of a `t.object({...})` shape |
| `IShapeElementOf<S>` | `type` | The element type of a `t.array(...)` or `t.set(...)` shape, whether it came from a builder, an array, or a record |
| `IShapeMapOf<S>` | `type` | The `Map<K, V>` type of a `t.map({key, value})` shape |

`LmdbSchema` statics:

| Static | What it is |
| :------ | :--------- |
| `db` | Sub-database name. Required, non-empty, unique per env |
| `key` | The primary key builder. Required, and it must not carry `unique()` or `.index()` |
| `value` | A map of column builders (row shape) or a single builder (scalar sub). Required |
| `dupSort?` | One key to many ordered values. Requires a scalar `value` |
| `useVersions?` | Per-schema record versioning; defaults to the env setting. Enables `rootPut(id, value, version, ifVersion)` |
| `encoding?` | Per-sub-database value encoding, overriding the env default |
| `hookBeforeWrite?` | Transforms a row before LMDB serializes it. Must be declared together with `hookBeforeRead` |
| `hookBeforeRead?` | Transforms a decoded value back into a row. Must be declared together with `hookBeforeWrite` |
| `ttl?` | Repository-wide default expiry in ms. `0` materializes the TTL sub with no default |
| `version?` | Integer row-shape version, checked against a migration transform's `schemaVersion` |
| `_schemaBrand` | Runtime discriminator inherited by every subclass; what lets `register` recognize a schema class. Never read by your code |
| `validate(schemaClass)` | The registration-time rule check |
| `deriveIndexes(columns)` | Turns the `unique()` and `.index(...)` columns of a `value` map into resolved index descriptors |
| `deriveSearch(columns)` | Returns the column names carrying `.search()` |
| `deriveRecordColumns(columns)` | Returns the ordered column list used by the positional record codec |
| `compositeTuple(value, parts)` | Builds the ordered key tuple for a composite index, or `null` when a component is absent |
| `isColumnBuilder(value)` | Type guard: is this `static value` a single builder (scalar sub) rather than a column map? |
| `makeBuilder(...)` | The builder factory behind every `t.*` function and every chain method. Each call returns a fresh immutable builder |

### `./sub`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbEnvSub<S>` | `class` | The typed handle `register()` returns, bound to one schema. Self-contained: it owns its sub-database state, so `env.register(S) === env.sub(S)` |
| `MAX_MATERIALIZE` | `const` | `100_000`. The hard cap on a materializing range read. `keys` · `values` · `entries` · `like` · `findByPrefix` · `deleteByPrefix` throw `LmdbError` past it; `iterate()` is lazy and never guarded |

### `./transaction`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbTransaction` | `class` | The lifecycle wrapper handed to your `transaction`, `transactionFast`, or `readTransaction` callback. You never construct it |
| `ITransactionLifecycle` | `type` | `active` · `committed` · `aborted` · `released`. A read transaction that finishes normally reports `released`, not `aborted` |
| `IRawReadTransaction` | `type` | The underlying LMDB read transaction, exposed as `LmdbTransaction.raw` for low-level escape hatches |

`LmdbTransaction` members: `lifecycle` · `done` · `isAborted` · `isCommitted` ·
`abortRejected` (getters) · `raw` (the wrapped read transaction) · `commit()` ·
`abort()` · `release()`.

- `commit()` sets the flag so LMDB commits when the wrapper callback returns.
  It is a no-op for read transactions, which release automatically.
- `abort()` rolls back a write transaction. Inside `transactionFast` it
  **throws** `LmdbError`, because that path commits through lmdb-js even when
  the callback throws: pretending to roll back would be worse than saying so.
- `release()` marks a read transaction finished without reporting an abort.
  `readTransaction` calls it for you.

### `./errors`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbError` | `class` | The only error class this package throws. `name` is fixed to `LmdbError`; `cause` is set when an original error is wrapped. Catch it to handle any failure from the package |

### `./queue`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbQueue<S>` | `class` | FIFO queue over one sub-database. `new LmdbQueue(env, Schema)`. Enqueue bumps a monotonic counter and stores the payload in one synchronous transaction; dequeue reads the head and deletes it in one |
| `IQueueSchema` | `type` | The schema constraint `LmdbQueue` requires: a schema class whose `key` is string-kind (`t.string()`, `t.string('a','b')`, or `t.enum('a','b')`). A structural check, not a base class to extend |

`LmdbQueue<S>` members: `enqueue(job)` (async) returns the generated
zero-padded id · `dequeue()` (async) returns `[id, job] | undefined` ·
`peek()` (sync) returns `[id, job] | undefined` · `size()` (sync) returns
`number` · `clear()` (async).

### `./job-run`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbJobRun` | `class` | Restart-safe cron scheduling. Owns both halves: croner decides *when* to fire, this class persists *that a run happened*, so the next boot can tell whether the job is due |
| `JobRunSchema` | `class` | The schema behind the stamps: `db: '__job_run'`, `key: t.string()`, `value: {at: t.number()}`. Registered rather than reached through a raw handle, so rows are typed and readable via `env.sub(JobRunSchema)` |
| `LmdbJobRunHandle` | `type` | What `LmdbJobRun.start` returns: `stop()` · `runNow()` · `lastRun()` · `nextRun()` · `label()` |
| `LmdbJobRunScheduleOptions` | `type` | `{pattern, task, timezone?, runOnStart?, catchUp?, onError?, persist?}`. `pattern` and `task` are required |
| `LmdbJobRunMissedOptions` | `type` | `{pattern, timezone?, now?}` for the standalone missed-boundary check |

`LmdbJobRun` members: `sub` (the `__job_run` handle) · `lastRun(key)` (sync)
returns epoch ms or `undefined` · `recordRun(key, at?)` (async, call it only
after the work succeeded) · `clear(key)` returns `Promise<boolean>` ·
`missed(key, opts)` returns `boolean` · `start(key, opts)` returns
`LmdbJobRunHandle`.

### `./backup`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbBackup` | `class` | Timestamped backup lifecycle: directory backups, `tar.gz` archives, S3 upload, pruning, restore, and scheduling. Only `backup-*` entries are ever listed or pruned, so foreign files in the directory are left alone |
| `LmdbBackupStartOptions` | `type` | `{dir, pattern, keep?, s3Keep?, timezone?, runOnStart?, format?, compact?, s3?, onError?, persist?, persistKey?}`. `dir` and `pattern` are required |
| `LmdbBackupHandle` | `type` | What `start` returns: `stop()` · `runNow()` · `lastRun()` · `nextRun()` · `label()` |
| `LmdbBackupSnapshotOptions` | `type` | The same shape minus `pattern`, `timezone`, `runOnStart`, `persist`, and `persistKey` |
| `LmdbBackupSnapshotResult` | `type` | `{path, ...}` from `snapshot`: the archive path (or backup directory) plus the remote key when uploaded |
| `LmdbBackupEntry` | `type` | One directory backup from `list`: `name` (`backup-<stamp>`), absolute `path`, and `mtimeMs` (the directory mtime, the prune order key) |
| `LmdbBackupArchiveEntry` | `type` | One `tar.gz` archive from `listArchives`: `name` (`backup-<stamp>.tar.gz`), absolute `path`, `mtimeMs`, and `sizeBytes` |
| `LmdbBackupS3Options` | `type` | `{bucket, accessKeyId?, secretAccessKey?, client?, prefix?, endpoint?, region?, forcePathStyle?}`. Supply `client` for a preconfigured `S3Client`; it wins over the fields |

`LmdbBackup` statics:

| Static | Returns | What it does |
| :----- | :------ | :----------- |
| `backup(env, baseDir, keep?, compact?)` | the backup directory name | Copies the env into `backup-<stamp>` under `baseDir`, creating it first, then prunes |
| `list(baseDir)` | `LmdbBackupEntry[]` | Directory backups, oldest first |
| `prune(baseDir, keep?)` | `{kept, removed}` | Drops the oldest directory backups beyond `keep`; a non-positive `keep` falls back to `3` |
| `restore(backupPath, destPath, {overwrite?})` | the restored path | Validates `data.mdb` in the source before copying out |
| `snapshot(env, opts)` | `LmdbBackupSnapshotResult` | One-shot `dir` or `tar.gz` copy, optional S3 upload, local and remote pruning |
| `listArchives(baseDir)` | `LmdbBackupArchiveEntry[]` | `tar.gz` archives, oldest first |
| `pruneArchives(baseDir, keep?)` | `{kept, removed}` | Drops the oldest archives beyond `keep` |
| `restoreArchive(archivePath, destParent, destName)` | the restored path | Extracts an archive into a named directory under `destParent` |
| `uploadToS3(archivePath, s3, keep?)` | the remote key | PUTs the archive and verifies it landed before pruning the remote |
| `pruneS3Archives(s3, keep?)` | `{removed}` | Drops the oldest remote archives beyond `keep` |
| `downloadFromS3(s3, key, destDir, fileName)` | the local path | Downloads to a randomly suffixed `.part` sibling, so parallel downloads cannot interleave |
| `clearStaleStaging(dir)` | `void` | Removes orphaned staging leftovers from a crashed run |
| `start(env, opts)` | `LmdbBackupHandle` | A thin wrapper that supplies the snapshot task and delegates every scheduling decision to `LmdbJobRun.start` |

### `./reader`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbReader` | `class` | Read-only replica helper. `LmdbReader.open(path, {maxDbs?, pollMs?})` returns a `readOnly` `LmdbEnv` you must `close()`. `maxDbs` defaults to `10`; `pollMs` periodically calls `resetReadTxn` so a long-lived reader sees new writes, and `close()` is patched to clear that timer |

This is a same-machine, same-file attach, not replication: LMDB gives a
consistent snapshot per read transaction, so the reader sees whatever the
writer has flushed.

### `./cdc`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `Cdc` | `class` | Per-env change-capture entry point, all statics. `Cdc.for(env)` returns the cached `{store, hub}` pair from a `WeakMap`, so a closed env drops its entry with no manual cleanup. Never construct it |
| `CdcHub` | `class` | In-process subscriber hub, one per env. `active` · `activate()` · `subscribe(filter, cb)` returns an unsubscribe · `drain()` · `tail(options?)` · `ack(consumer, seq)`. The `aftercommit` hook attaches on the first `subscribe` and detaches when the last one leaves |
| `CdcStore` | `class` | The durable outbox. `ensure()` · `append(db, event, mode)` · `maxSeq()` · `scan(floor, limit?)` · `getAck(consumer)` · `setAck(consumer, seq)` · `prune(keep?)`. Backed by `__cdc_log` and `__cdc_meta` |
| `ICdcEvent` | `type` | `{type, key, value}`. `type` is `put` · `delete` · `clear`; a delete is key-only and a clear has neither key nor value |
| `ICdcRecord` | `type` | `ICdcEvent` plus the gapless per-env outbox `seq` and the source `db`, appended in the same writer transaction as the write |
| `ICdcFilter` | `type` | `string` (a sub-database name) or `{db, op?}` to narrow to `put` · `delete` · `clear` |
| `ICdcCallback` | `type` | `(event: ICdcEvent) => void`, invoked post-commit on the `aftercommit` tail |
| `ICdcTailOptions` | `type` | `{consumer?, from?, limit?}` for `tailCdc`. A named consumer auto-registers on first tail and resumes past its persisted ack |

You reach all of this through `LmdbEnv`: `subscribe`, `tailCdc`, `ackCdc`,
`pruneCdc`.

### `./sync`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbSyncStream<S>` | `class` | One differential-sync run, constructed with `(source, dest, options?)` and single-use |
| `ISyncOptions<S>` | `type` | `{name?, checkpoint?, limit?, verify?}`. `name` defaults to the destination database name; an explicit `checkpoint` runs one-shot without touching the stored cursor; `verify` defaults to `true` |
| `ISyncResult<S>` | `type` | `{copied, checkpoint, verified}`. A truncated run reports `verified: false` |

Members: `run()` returns `Promise<ISyncResult<S>>` (it throws on self-sync and
on verify divergence) · `LmdbSyncStream.hashRowValue(value)` returns an
unsigned 32-bit hash over a canonicalized row, used for the verify
spot-checks.

### `./search`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `LmdbSearch` | `class` | Full-text search primitives, all statics. Tokenization is deliberately minimal: lowercase plus a split on `[^a-z0-9]+`, no stemming, so non-ASCII letters act as separators |

- `LmdbSearch.tokenize(text)` returns lowercase alphanumeric terms, and `[]`
  for empty or punctuation-only input.
- `LmdbSearch.tokenizeField(value)` returns the same for a field value;
  non-strings contribute no terms, mirroring how `null` extracts skip embedded
  indexes.
- `LmdbSearch.fingerprintPk(pk)` returns a stable string encoding of a key's
  *value*, so array and buffer primary keys still map to the same score-map
  entry across reads (a `Map` key would compare by reference identity).

### `./codec`

| Export | Kind | What it is |
| :----- | :--- | :--------- |
| `RecordCodec` | `class` | The positional row codec installed automatically on hook-free, non-TTL, row-shaped schemas. Rows encode as arrays in column declaration order (field names never reach disk) and decode back to row objects. Implements `ICodec<unknown>` |

Members: `constructor(columns)` (the column order is the codec's configuration)
· `columns` (readonly) · `hookBeforeWrite(value)` returns the positional cell
array · `hookBeforeRead(raw)` returns the rebuilt row, with `undefined` cells
left absent. Statics `RecordCodec.getPath(row, column)` and
`RecordCodec.setPath(row, column, cell)` walk and rebuild dotted paths such as
`"profile.email"`; `getPath` returns `undefined` for an absent path rather
than throwing. Non-array stored values decode through untouched, so rows
written before the codec (or raw bytes from `putBinary`) still read.

### Type-only exports

Not exported at runtime; import them with `import type` or under
`verbatimModuleSyntax`.

| Export | What it is |
| :----- | :--------- |
| `ILmdbEnvOptions` | The constructor options object. `path` is required; every other LMDB `open()` parameter is available and forwarded |
| `ILmdbEncoding` | `msgpack` · `json` · `cbor` · `string` · `binary` · `ordered-binary` |
| `ICompressionOptions` | `{threshold?, dictionary?}` for the LZ4 settings, as an alternative to the `compression` boolean |
| `ILmdbEnvState` | `closed` · `opening` · `open` · `closing`, what `LmdbEnv.state` returns |
| `ILmdbKey` | Anything LMDB accepts as a key, re-exported from `lmdb` as `Key`: `string` · `number` · `boolean` · `symbol` · `Uint8Array` · arrays of primitives. The array form is what makes `["tenant-a", 42]` composite keys sort lexicographically |
| `IIndexDef<T, K>` | One declarative index: `extractor?` · `unique?` · `dbName?` · `composite?`. An extractor returning `undefined` or `null` skips the entry |
| `IIndexDefs<T>` | The index map, `Record<string, IIndexDef<T, ILmdbKey>>`, keyed by declared index name |
| `IndexQueryValue<T, P, D>` | What a query accepts for one index: the indexed field's type when the name is a field path on `T`, else `ILmdbKey`, or `ILmdbKey \| ICompositeRange` for a composite |
| `IIndexQuery<T, I>` | The object query `findByIndex` accepts. Every supplied key is ANDed; the intersection term makes `{}` a compile error |
| `IIndexResult<T, I, Q>` | The return type: `T \| undefined` when every queried index is unique, `T[]` when any is not. Without `as const` on the index map the check widens and every query degrades to `T[]` |
| `ICompositeRange` | `{start?, end?}` of key tuples for a composite range seek; `start` inclusive, `end` exclusive, either may be open-ended |
| `IndexDescriptor` | One index as resolved at registration: `name` · `extractor` · `unique` · `state` · `autoResolved` · `composite` |
| `IRangeOptions` | Bounds for a range read: `start?` (inclusive) · `end?` (exclusive) · `inclusiveEnd?` · `exclusiveStart?` · `limit?` · `offset?` · `reverse?`. Omitting both bounds walks the whole key space in lexicographic order |
| `ISearchTable` | One attached posting table: the searched `column` name plus the `{db}:search:{column}` dupSort `state` holding term to primary-key rows |
| `ICodec<T>` | The write/read hook pair: `hookBeforeWrite(value: T): unknown` and `hookBeforeRead(raw: unknown): T`. Both run at the repository boundary, before and after LMDB's native encoding |
| `LmdbSubState` | Per-sub-database state the env's sub manager keeps: `dbName` · `env` · `codec?` · `hookBeforeRead` · `indexes` · `indexByName` · `searchTables` · `keyType?` · `opts` · `isTtl` · `ttlMs?`. It is `@internal`: reachable from the barrel so `ISearchTable` and `IndexDescriptor` can reference it, not part of the surface you code against |

`IRangeOptions` also carries a `transaction?` field, but it is `@internal`:
`LmdbEnv` fills it in when you pass a transaction to a sub read, and you never
set it yourself.

The `IMigration` and `ITransformStep` shapes that `migrate()` consumes live in
`src/types/env.ts` but are not re-exported from the barrel; annotate your
migrations inline.

### Live documentation

**https://gramstax.mintlify.site/**

The [storage guide](https://github.com/gramstax/gramstax/blob/main/docs-site/guides/storage-lmdb.md)
is the narrative version of this page. It covers the same surface in prose
form, alongside the framework guides that use this package.

### Agent skills

The repository ships three rule-based skills consumed by coding agents, with
`references/` holding one file per rule:

- [`skills/lmdb-best-practices/`](https://github.com/gramstax/gramstax/blob/main/skills/lmdb-best-practices/SKILL.md):
  query patterns, index declaration and maintenance, env sizing, schema
  design, transactions and queues, full-text search, change capture,
  migrations, differential sync, and mitata bench conventions.
- [`skills/gramstax-best-practices/`](https://github.com/gramstax/gramstax/blob/main/skills/gramstax-best-practices/SKILL.md)
  and [`skills/worker-thread-best-practices/`](https://github.com/gramstax/gramstax/blob/main/skills/worker-thread-best-practices/SKILL.md)
  for the sibling packages.

### Examples

Twenty-three runnable files under
[`packages/lmdb/example/`](https://github.com/gramstax/gramstax/tree/main/packages/lmdb/example),
one per feature area:

| File | Demonstrates |
| :--- | :----------- |
| `basic.ts` | The shortest path: open, register, read, write |
| `schema.ts` | Column builders, defaults, enums, hooks |
| `all-features.ts` | Many features in one scenario |
| `atomic-counter.ts` | `increment` and `decrement` on a scalar sub-database |
| `backup-s3-tar.ts` | `tar.gz` snapshots with an S3 upload |
| `binary-helpers.ts` | `putBinary`, `getBinary`, `getBinaryFast` |
| `bulk-operations.ts` | `putMany`, `importJSONL`, `exportJSONL` |
| `cbor-encoding.ts` | The CBOR encoding option |
| `composite-keys.ts` | Composite primary keys and composite indexes |
| `conditional-writes.ts` | `putIfNotExists` and versioned writes |
| `custom-codec.ts` | `hookBeforeWrite` and `hookBeforeRead` |
| `dupsort.ts` | One key to many ordered values |
| `embedded-indexes.ts` | `.unique()` and `.index()` |
| `hybrid.ts` | Mixing several features in one schema |
| `job-run.ts` | Restart-safe scheduling |
| `migrations.ts` | Versioned steps and row transforms |
| `queue.ts` | FIFO enqueue and dequeue |
| `range-query.ts` | Range reads and keyset pagination |
| `reader-backup.ts` | A read-only attach plus a backup |
| `search-cdc-demo.ts` | Full-text search plus change capture |
| `transaction.ts` | Transactional read-then-write |
| `transaction-fast.ts` | The no-rollback transaction |
| `ttl-repository.ts` | A TTL sub-database |

```bash
bun packages/lmdb/example/basic.ts
```

### Domain docs

[`CONTEXT-MAP.md`](https://github.com/gramstax/gramstax/blob/main/CONTEXT-MAP.md)
points at one `CONTEXT.md` per context. [`AGENTS.md`](https://github.com/gramstax/gramstax/blob/main/packages/lmdb/AGENTS.md)
is the package's own conventions and architecture facts.

## 🚀 Deployment

- **`mapSize` is virtual, not RAM.** Size it 10 to 50 times your expected data;
  breaching it throws.
- **One writer per data directory.** Two processes writing the same path fight
  over the LMDB writer lock; readers are fine.
- **Keep the backup directory dedicated.** Pruning counts everything inside it,
  and a stray file can be removed.
- **A backup carries the previous run's stamp**, because the stamp lands after
  the copy resolves. Restoring one rolls the schedule back, so the app
  snapshots once soon after, which is the right response to a rollback.
- **`__`-prefixed sub-databases are engine bookkeeping**: `__job_run`,
  `__queue_meta`, `__cdc_log`, `__cdc_meta`, and `__sync_state` stay out of
  your change stream on purpose.

## 🩺 Troubleshooting

| Symptom | Likely cause | Fix |
| :------ | :----------- | :-- |
| `MDB_MAP_FULL` | `mapSize` too small for the dataset | Raise it; it is virtual, not reserved memory |
| Lock errors on start | A stale reader, or a second writer | One writer per directory; close readers cleanly |
| `register` throws | Duplicate class, or two schemas sharing `db` | One schema per sub-database name |
| Index read returns nothing | A `null` or `undefined` indexed field | Those rows skip the index: query them by primary key |
| Bulk read throws | Over `MAX_MATERIALIZE` | Add `{limit}` below the cap, or stream with `iterate()` |
| `transactionFast` aborts | It has no rollback path | Use `transaction()` when the outcome depends on a mid-way throw |
| Backup directory pruned oddly | Something else lives there | Point it at a directory that belongs to backups alone |

## 🧰 Tech Stack

- [lmdb](https://www.npmjs.com/package/lmdb) : the LMDB native binding
- [croner](https://www.npmjs.com/package/croner) : cron scheduling for `LmdbBackup.start` and `LmdbJobRun`
- Optional peers: [tar](https://www.npmjs.com/package/tar) for `tar.gz`,
  [@aws-sdk/client-s3](https://www.npmjs.com/package/@aws-sdk/client-s3) for
  uploads, [cbor-x](https://www.npmjs.com/package/cbor-x) for CBOR encoding
- [mitata](https://github.com/benoitgrelard/mitata) : benchmarks
- [tsup](https://tsup.egoist.dev) : bundler
- TypeScript in strict mode (`noUncheckedIndexedAccess`)
- [LMDB](https://www.npmjs.com/package/lmdb) : the storage engine this package wraps

## ❤️ Donate

If this project saves you time, you can support its development:

**Donate:** [Sociabuzz](https://sociabuzz.com/damarts/donate) · [Damarts](https://damarts.vercel.app/donate)

## 📄 License

Apache-2.0: Copyright (c) 2026 Gramstax. See [LICENSE](./LICENSE).

The published history is part of the record and is not rewritten. Every version
from `0.9.0` through `5.0.0` (24 releases, June to October 2026) was published
under proprietary terms. Everything from `6.0.0` onward is Apache-2.0.
