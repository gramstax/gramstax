# @GRAMSTAX/LMDB — LMDB Database Wrapper

Multi-runtime (Bun, Node.js >=18) key-value database with OOP Repository pattern per sub-database.

## Source Layout

```
packages/lmdb/src/
├── env.ts          LmdbEnv — root DB class (lifecycle, repo registration, transactions)
├── repository.ts   LmdbRepository<T,K> — typed CRUD over one sub-DB
├── transaction.ts  LmdbTransaction — commit/abort/lifecycle
├── codec.ts        ICodec<T> — optional value transforms
├── errors.ts       LmdbError + typed subclasses
├── types.ts        Public interfaces and type aliases
└── index.ts        Barrel (re-exports all modules)
```

## Core Pattern

```typescript
class UserRepo extends LmdbRepository<{ name: string }, number> {
  static dbName = `user`;
}

class Db extends LmdbEnv {
  users!: UserRepo;
  constructor(path: string) {
    super({path, maxDbs: 10, compression: true});
    this.users = this.register(UserRepo);     // register in constructor
  }
}
```

- **Root class**: `class Db extends LmdbEnv` — subclass, do not wrap.
- **Repository**: extend `LmdbRepository<T,K>` with `static dbName` for each sub-DB.
- **Env opens on construction** — no explicit `open()` call. Defaults: `mapSize` = 4 GB (`4 << 30` bytes), `maxDbs` = 128.
- **Sync reads**: `get()`/`has()`/`count()` are synchronous (delegate to lmdb sync methods).
- **Atomic writes**: `env.transaction()` for every read-then-write pattern. Use a sync callback (non-async) — repository methods are non-async, and a sync callback keeps all writes in the same event turn for proper batching.
- **Cross-repo access**: `this.env.getRepository(OtherRepo)` inside transactions.
- **Key design**: natural key per repo — no namespace prefixes.
- **Counting**: `repo.count()` = O(1), synchronous — prefer over manual counters.
- **Encoding**: default msgpack (fast, Date/Map/Set/BigInt); `encoding: "json"` for human-readable.
- **Materialization guardrail**: `keys()`/`values()`/`entries()`/`like()`/`findByPrefix()`/`deleteByPrefix()` reject with `LmdbMaterializationError` when the result set would exceed `MAX_MATERIALIZE` (`100_000`). Pass `{limit}` below the cap or use `iterate()` (lazy, never guarded) for result sets larger than 100k.
- **Queue v2**: `LmdbQueue` enqueue/dequeue run in ONE synchronous transaction (`transactionSync`) — counter bump + payload write (enqueue) and read + delete (dequeue) commit atomically, FIFO preserved across processes.

## API

| Method                          | Return type              | Sync/Async |
| ------------------------------- | ------------------------ | ---------- |
| `get(key, tx?)`                 | `T \| undefined`         | sync       |
| `getStrict(key, tx?)`           | `T` (throws if absent)   | sync       |
| `has(key)`                      | `boolean`                | sync       |
| `count()`                       | `number`                 | sync       |
| `put(key, value, tx?)`          | `Promise<void>`          | async      |
| `delete(key)`                   | `Promise<boolean>`       | async      |
| `clear()`                       | `Promise<void>`          | async      |
| `drop()`                        | `Promise<void>`          | async      |
| `keys/values/entries(options?)` | `Promise<array>`         | async      |
| `iterate(options?)`             | `AsyncIterableIterator`  | async      |
| `first()`, `last()`             | `Promise<tuple\|undefined>` | async   |
| `findByPrefix(prefix)`          | `Promise<array>`         | async      |
| `like(pattern)`                 | `Promise<array>`         | async      |
| `countByPrefix(prefix)`         | `Promise<number>`        | async      |
| `deleteByPrefix(prefix)`        | `Promise<number>`        | async      |
| `prefetch(keys)`                | `Promise<void>`          | async      |
| `getMany(keys)`                 | `Promise<array>`         | async      |

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
