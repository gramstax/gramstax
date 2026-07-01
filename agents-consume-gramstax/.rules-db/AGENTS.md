# @gramstax/lmdb — Database Layer Guide

`@gramstax/lmdb` is a key-value database library built on LMDB (Lightning Memory-Mapped Database) with an OOP Repository pattern. It provides typed CRUD per sub-database, atomic cross-repository transactions, and snapshot reads.

**Installation:**

```bash
npm install @gramstax/lmdb
# or
bun add @gramstax/lmdb
```

## Guide Index

- [`DB_ARCHITECTURE.md`](./DB_ARCHITECTURE.md) — Root `LmdbEnv`, extending it vs wrapping it, initialization lifecycle
- [`REPOSITORY_PATTERNS.md`](./REPOSITORY_PATTERNS.md) — Defining repositories, typed CRUD, atomic transactions, cross-repo access
- [`PERFORMANCE.md`](./PERFORMANCE.md) — Complexity table, O(1) operations, range query efficiency, batch reads
- [`MIGRATION_GUIDE.md`](./MIGRATION_GUIDE.md) — Step-by-step migration from raw `lmdb` to `@gramstax/lmdb`

## Quick Reference

```typescript
import { LmdbEnv, LmdbRepository } from "@gramstax/lmdb";

// 1. Define a repository
class UserRepo extends LmdbRepository<{ name: string }, number> {
  static dbName = `user`;
}

// 2. Create the env and register
const env = new LmdbEnv({ path: `./data` });
await env.open();
const users = env.register(UserRepo);

// 3. Use it
await users.set(1, { name: `Alice` });
const alice = await users.get(1);
await env.close();
```

| Concept       | Guideline                                                       |
| ------------- | --------------------------------------------------------------- |
| Root class    | `class Db extends LmdbEnv` — subclass, don't wrap               |
| Repository    | `class XRepo extends LmdbRepository<T, K>` with `static dbName` |
| Atomic writes | `env.transaction()` for any read-then-write pattern             |
| Cross-repo    | `env.getRepository(OtherRepo)` inside transactions              |
| Key design    | Natural key per repo — no namespace prefixes                    |
| Counting      | `repo.count()` = O(1) — prefer over manual counters             |
