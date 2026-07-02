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
  async init() {
    await this.open();
    this.users = this.register(UserRepo);
  }
}
```

- **Root class**: `class Db extends LmdbEnv` — subclass, do not wrap.
- **Repository**: extend `LmdbRepository<T,K>` with `static dbName` for each sub-DB.
- **Atomic writes**: `env.transaction()` for every read-then-write pattern.
- **Cross-repo access**: `this.env.getRepository(OtherRepo)` inside transactions.
- **Key design**: natural key per repo — no namespace prefixes.
- **Counting**: `repo.count()` = O(1) — prefer over manual counters.
- **Encoding**: default msgpack (fast, Date/Map/Set/BigInt); `encoding: "json"` for human-readable.

## API

| Method                          | Description              |
| ------------------------------- | ------------------------ |
| `set(key, value, tx?)`          | Upsert                   |
| `get(key, tx?)`                 | Read (T \| undefined)    |
| `has(key)`                      | Existence check          |
| `delete(key)`                   | Delete (returns boolean) |
| `clear()`                       | Remove all               |
| `count()`                       | O(1) count               |
| `keys/values/entries(options?)` | Range queries            |
| `iterate(options?)`             | Async streaming          |
| `first()`, `last()`             | Edge reads               |
| `findByPrefix(prefix)`          | Prefix scan              |
| `like(pattern)`                 | Glob-style filter        |
| `prefetch(keys)`                | Warm page cache          |
| `getMany(keys)`                 | Parallel reads           |

Constructor options: `path`, `maxDbs`, `compression`, `encoding`, `readOnly`, `mapSize`.

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
