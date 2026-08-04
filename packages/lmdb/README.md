# @gramstax/lmdb

LMDB-backed key-value database with isolated sub-database namespaces per entity type. Multi-runtime (Bun, Node.js >=18).

## Why @gramstax/lmdb?

This package is a thin opinionated layer over lmdb-js — the Node/Bun binding for the LMDB embedded database. It does not abstract away LMDB's semantics; it codifies them into a consistent typed pattern. The value is in what you stop needing to do on every project:

**No sub-DB bookkeeping.** Raw lmdb-js requires you to call `root.openDB(name, opts)` for every sub-database, pass handles around manually, and remember to forward `encoding`, `compression`, and `cache` options every time. This package binds a repository class to a sub-DB at registration time — declare a static identifier, and the wiring is automatic. Env-level options propagate to every sub-DB without repetition.

**No prefix-encoded keys.** Without sub-DBs, the established pattern is prefix-encoded keys (`"user:1"`, `"session:1"`) with manual inclusive-start / exclusive-end bounds for range queries. Each repository here owns a dedicated sub-DB — keys are intrinsically isolated, `count()` is O(1) per entity, and range scans never cross boundaries.

**Zero-overhead reads.** The underlying LMDB C calls for point lookups, existence checks, and cardinality are synchronous. Wrapping them in Promises would add a microtask with no benefit. `get()`, `has()`, and `count()` return values directly. Writes remain asynchronous — lmdb-js queues them and flushes in a batch on the next microtask, providing natural batching for single-key writes without explicit transactions.

**Cross-entity atomicity without ceremony.** Raw lmdb-js transactions are callback-based with manual error plumbing. This package lets you group reads and writes across any repositories inside a single `env.transaction()` call — one native LMDB write transaction, atomic commit or full rollback, no two-phase commit overhead.

**Consistent snapshot reads.** `env.readTransaction()` pins a read transaction at open time, giving a frozen point-in-time view that concurrent writers cannot affect. Useful for batch reports, exports, or queries that need consistency without blocking writes.

**Per-instance env isolation.** Each `LmdbEnv` opens its own LMDB environment. Multiple envs in the same process — read-only replicas, shards, or test fixtures — never share sub-DB handle caches. A problem that surfaces when lmdb-js caches `openDB` results on a shared prototype across `openAsClass` instances.

**Constructor-ready lifecycle.** The LMDB environment opens synchronously during `new LmdbEnv(...)`. No `await env.open()`, no deferred initialization point. The first read or write is safe immediately after construction.

## Runtime Support

| Runtime | Status       | Notes               |
| ------- | ------------ | ------------------- |
| Bun     | ✅ Supported | `>= 1.0.0` — native |
| Node.js | ✅ Supported | `>= 18`             |

**Dependencies**: One runtime dep — [`lmdb`](https://www.npmjs.com/package/lmdb) — for the LMDB native binding via Node-API.

## Install

```bash
bun add @gramstax/lmdb
# or
npm install @gramstax/lmdb
```

## Quick Start

```typescript
import { LmdbEnv, LmdbRepository } from "@gramstax/lmdb";

// 1. Define a repository
type IVUser = {
  id: number;
  name: string;
  age: number;
};

class UserRepo extends LmdbRepository<IVUser, number> {
  static dbName = `user`;
}

// 2. Root class extends LmdbEnv with direct repo properties
class Db extends LmdbEnv {
  users!: UserRepo;

  constructor(storePath: string) {
    super({ path: storePath, maxDbs: 10, compression: true, encoding: `json` });
    this.users = this.register(UserRepo);
  }
}

// 3. Use it — env opens on construction, `get()` is synchronous
const db = new Db(`./data`);

await db.users.set(1, { id: 1, name: `Alice`, age: 30 });
const alice = db.users.get(1); // sync — no await!
//    ^? IVUser | undefined

console.log(db.users.count()); // sync — 1

await db.close();
```

## Lifecycle

The native LMDB environment opens during construction — the `open()` system call happens synchronously inside `new LmdbEnv(...)`. No explicit `await env.open()` is needed. Closing flushes pending writes and releases the memory-mapped region, and also purges this env's handles from lmdb-js's internal `allDbs` registry so repeated open/close cycles do not accumulate process-lifetime references.

```typescript
// 1. Construct — LMDB env opens synchronously
const db = new Db(`./data`);

// 2. Use — env is immediately operational
await db.users.set(1, { id: 1, name: `Alice` });
const user = db.users.get(1); // synchronous read

// 3. Close — flush + release mmap
await db.close();
```

After `close()` every entry point throws `LmdbEnvClosedError` (repository reads/writes, env-level data ops, transactions) instead of surfacing raw lmdb native errors.

## Sub-Database Isolation

Each entity type maps to one LMDB sub-database (`mdb_dbi`). Sub-DBs share the same physical file and memory-mapped region but maintain independent B+ trees. This gives:

- **Cursor isolation** — a range query over the `"user"` sub-DB cannot see `"session"` keys. No prefix filtering needed.
- **O(1) cardinality** — `mdb_env_stat` reports exact entry count per sub-DB at zero marginal cost.
- **Zero key collisions** — keys are scoped to the sub-DB namespace. `"1"` in `"user"` and `"1"` in `"session"` are distinct entries.

```mermaid
flowchart TB
    subgraph Env["LmdbEnv (one LMDB env, one mmap file)"]
        direction TB
        Root["Root Database (metadata only)"]
        Users["user (sub-DB)"]
        Sessions["session (sub-DB)"]
        Config["config (sub-DB)"]
    end

    UserRepo -->|register/get| Users
    SessionRepo -->|register/get| Sessions
    ConfigRepo -->|register/get| Config
```

## Transaction Model

### Write Transactions

Every LMDB write transaction has exclusive writer lock semantics — a single writer is active at any time. Multiple writes queued in the same event turn are batched into one native transaction by lmdb-js before the next microtask boundary.

`env.transaction()` wraps the native callback-based transaction. **Use a sync callback whenever possible** — both sync and async callbacks are atomic (the native write transaction stays open until the callback settles), but a sync callback commits in the same event turn and avoids promise overhead. Repository methods are non-async, making sync callbacks natural:

```typescript
// ✅ Recommended: sync callback — all writes batched atomically
const result = await env.transaction(() => {
  userRepo.set(`u1`, user);
  sessionRepo.set(`s1`, session);
  return { ok: true };
});

// ⚠️  Works atomically too, but slower: async callback
await env.transaction(async (tx) => {
  await userRepo.set(`u1`, user);
  await sessionRepo.set(`s1`, session);
  tx.abort(); // also rolls back correctly after an await
});
```

### Read Transactions

`env.readTransaction()` acquires an LMDB read transaction that pins a consistent snapshot. The raw read transaction is released when the callback completes. Inside the callback, repository `get()`/`has()`/`keys()`/`values()`/`entries()` see a frozen view regardless of concurrent writes.

### Atomicity Rules

| Pattern                                                | Safe? | Reason                                                |
| ------------------------------------------------------ | ----- | ----------------------------------------------------- |
| Single `set` or `delete`                               | ✅    | lmdb async writes are atomic per-key                  |
| `get` then `set` (no tx)                               | ❌    | Interleaving writer can modify between read and write |
| `get` then `set` (inside `env.transaction`)            | ✅    | Exclusive write lock covers both operations           |
| Multiple `set` across repos (inside `env.transaction`) | ✅    | Single native LMDB write transaction                  |
| Multiple `get` (inside `env.readTransaction`)          | ✅    | Snapshot isolation from pinned read transaction       |

## API

### `LmdbEnv` Constructor Options

Every option maps directly to lmdb-js `open()` parameters:

| Option              | Type             | Default          | Description                                             |
| ------------------- | ---------------- | ---------------- | ------------------------------------------------------- |
| `path`              | string           | **required**     | Filesystem path for data files                          |
| `maxDbs`            | number           | `10`             | Max sub-databases                                       |
| `encoding`          | string           | `msgpack`        | `msgpack`, `json`, `binary`, `string`, `ordered-binary` |
| `compression`       | boolean / object | `false`          | LZ4 compression (off-thread)                            |
| `readOnly`          | boolean          | `false`          | Open in read-only mode                                  |
| `mapSize`           | number           | `256 MB`         | Virtual memory mapping in bytes                         |
| `cache`             | boolean / object | `false`          | In-memory read cache                                    |
| `useVersions`       | boolean          | `false`          | Optimistic locking via version numbers                  |
| `keyEncoding`       | string           | `ordered-binary` | `uint32`, `binary`, `ordered-binary`                    |
| `dupSort`           | boolean          | `false`          | Allow duplicate entries per key                         |
| `noSync`            | boolean          | `false`          | Skip fsync (faster, crash-unsafe)                       |
| `encryptionKey`     | string / Buffer  | —                | ChaCha8 encryption (32 bytes)                           |
| `maxReaders`        | number           | `126`            | Max concurrent readers                                  |
| `pageSize`          | number           | OS default       | DB page size (4096/8192/16384)                          |
| `commitDelay`       | number (ms)      | `0`              | Batch writes before committing                          |
| `eventTurnBatching` | boolean          | `true`           | Batch writes in same event turn                         |

Sub-DB options (`compression`, `cache`, `encoding`, `useVersions`, `keyEncoding`, `dupSort`, `strictAsyncOrder`) are automatically forwarded from the env constructor to every sub-database — no need to repeat them per repository.

### `LmdbRepository` Dispatch Model

Repository methods dispatch to one of two LMDB code paths depending on whether the underlying C function is synchronous or returns a Future:

**Synchronous** (calls lmdb `Database.get` / `doesExist` / `getCount` directly — returns value in the same call frame):

```
repo.get(key)          → T | undefined       // mdb_get, sync
repo.getStrict(key, tx?) → T                  // like get, throws LmdbKeyNotFoundError
repo.has(key)          → boolean             // mdb_get existence probe, sync
repo.count()           → number              // mdb_env_stat entry count, sync
```

**Asynchronous** (returns a Promise — write operations queue through lmdb-js async batching, range materialization drains a lazy `RangeIterable`):

```
await repo.set(key, value)       → void           // queued put
await repo.delete(key)           → boolean        // queued remove
await repo.clear()               → void           // queued clearAsync
await repo.drop()                → void           // queued sub-DB drop
await repo.prefetch(keys)        → void           // async page-fault

await repo.keys(options)         → K[]            // RangeIterable.asArray
await repo.values(options)       → T[]            // RangeIterable.asArray
await repo.entries(options)      → [K, T][]       // RangeIterable.asArray
await repo.first()               → [K, T] | undefined
await repo.last()                → [K, T] | undefined
await repo.getMany(keys)         → (T | undefined)[]

await repo.like(pattern)         → [K, T][]
await repo.findByPrefix(prefix)  → [K, T][]
await repo.countByPrefix(prefix) → Promise<number>
await repo.deleteByPrefix(prefix)→ number     // rejects LmdbEmptyPrefixError on empty prefix

for await (const [k, v] of repo.iterate(options))  // lazy async generator
```

The `env` property is public, giving subclasses access to transaction boundaries:

```
this.env.transaction(fn)
this.env.getRepository(OtherRepo)
this.env.readOnly
```

### `LmdbTransaction` Lifecycle

```
tx.lifecycle      → 'active' | 'committed' | 'aborted' | 'released'
tx.done           → boolean (true when lifecycle !== 'active')
tx.isCommitted    → boolean
tx.isAborted      → boolean  // read txns that finished normally report false
tx.raw            → underlying LMDB Transaction (read-tx only)
tx.commit()       → marks wrapper committed (auto-commits on callback return)
tx.abort()        → rolls back the native transaction
```

## Encoding Architecture

LMDB natively serializes values using one of five encoders set per sub-DB at `openDB()` time. The encoding is NOT inherited from the root env — the wrapper explicitly forwards it to each sub-DB.

| Encoder             | Serializer                 | Use case                                        |
| ------------------- | -------------------------- | ----------------------------------------------- |
| `msgpack` (default) | msgpackr (binary)          | Default — fastest, supports Date/Map/Set/BigInt |
| `json`              | `JSON.stringify` / `parse` | Human-readable, V8-optimized for small objects  |
| `binary`            | Raw `Buffer`               | Already-encoded binary payloads                 |
| `string`            | UTF-8 string               | String-only values                              |
| `ordered-binary`    | Same encoding as keys      | `dupSort` index values                          |

A Codec layer can be stacked on top of LMDB encoding for custom transforms (`Date → number`, encryption, compression) that run before the native serializer.

## Custom Codecs

Custom codecs run before LMDB encoding. They transform typed values to an intermediate representation that the native encoder then serializes. Use for types LMDB cannot represent natively.

```typescript
import { LmdbRepository, LmdbCodec } from "@gramstax/lmdb";

class DateRepo extends LmdbRepository<Date, string> {
  static dbName = `dates`;
  static codec = LmdbCodec.create<Date, number>(
    (d) => d.getTime(),
    (n) => new Date(n),
  );
}
```

## Range Query Model

Range queries use LMDB cursors exposed through lmdb-js's lazy `RangeIterable`. The iterator is created synchronously (no data read yet), and materialization via `.asArray` drains it asynchronously in a microtask. This means `keys()`/`values()`/`entries()`/`first()`/`last()`/`like()`/`findByPrefix()` all return Promises even though cursor creation is synchronous.

Prefix patterns (`"admin:*"`) are optimized into bounded range scans `[prefix, prefixEnd)` — the `start` and `end` bounds are computed from the literal prefix portion of the glob. Non-prefix patterns fall back to full scans with JavaScript regex filtering on the key.

```typescript
// Bounded range cursor → [start, end) exclusive
await repo.entries({ start: `user:`, end: `user:\uffff`, limit: 50 });

// Prefix scan — same cursor bounds, no regex
await repo.findByPrefix(`admin:`);

// Glob patterns — prefix shape optimized, otherwise full scan
await repo.like(`admin:*`); // range scan
await repo.like(`*partial*`); // full scan + regex filter
```

The `\uffff` sentinel produces the first key that sorts after any prefix — it is the exclusive upper bound for a prefix range scan.

## License

Proprietary — Copyright (c) 2026 Gramstax. See [LICENSE](./LICENSE).
