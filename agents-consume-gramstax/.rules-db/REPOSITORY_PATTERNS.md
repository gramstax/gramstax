# Repository Patterns & Transactions

## Defining a Repository

Every repository extends `LmdbRepository<T, K>` with a `static dbName`:

```typescript
import { LmdbRepository } from "@gramstax/lmdb";

type IKUser = number;
type IVUser = {
  id: number;
  name: string;
  email: string;
  createdAt: number;
  updatedAt: number;
};

export class UserRepo extends LmdbRepository<IVUser, IKUser> {
  static dbName = `user`;
}
```

**Key points:**

- `dbName` must be unique within an `LmdbEnv`.
- The key type `K` must be one of `string | number | Buffer`.
- The key is the natural identifier for your entity.
- Each repository gets its own isolated sub-database — keys between repositories never collide.

## Repository File Organization

Place each repository in a dedicated file, typically under `src/db/repositories/`:

```
src/db/
├── db.ts                  ← LmdbEnv subclass
└── repositories/
    ├── user.ts
    ├── session.ts
    └── item.ts
```

## Inherited CRUD Methods

| Method          | Signature                               | Description         | Complexity   |
| --------------- | --------------------------------------- | ------------------- | ------------ |
| `get`           | `(key) => Promise<T \| undefined>`      | Read by key         | O(1)         |
| `set`           | `(key, value, tx?) => Promise<void>`    | Write (upsert)      | O(1)         |
| `has`           | `(key) => Promise<boolean>`             | Check existence     | O(1)         |
| `delete`        | `(key, tx?) => Promise<boolean>`        | Remove by key       | O(1)         |
| `count`         | `(tx?) => Promise<number>`              | Total entries       | O(1)         |
| `clear`         | `(tx?) => Promise<void>`                | Remove all entries  | O(N)         |
| `getMany`       | `(keys) => Promise<(T \| undefined)[]>` | Batch read          | O(M)         |
| `entries`       | `(range?) => Promise<[K, T][]>`         | Range query         | O(log N + M) |
| `keys`          | `(range?) => Promise<K[]>`              | Range keys          | O(log N + M) |
| `values`        | `(range?) => Promise<T[]>`              | Range values        | O(log N + M) |
| `findByPrefix`  | `(prefix, opts?) => Promise<[K, T][]>`  | Prefix scan         | O(log N + M) |
| `countByPrefix` | `(prefix) => Promise<number>`           | Count by prefix     | O(log N + M) |
| `iterate`       | `(range?) => AsyncIterable<[K, T]>`     | Streaming iteration | O(N)         |
| `first`         | `() => Promise<[K, T] \| undefined>`    | First key order     | O(log N)     |
| `last`          | `() => Promise<[K, T] \| undefined>`    | Last key order      | O(log N)     |

## Custom Domain Methods

Add domain-specific methods directly to your repository subclass:

```typescript
class UserRepo extends LmdbRepository<IVUser, number> {
  static dbName = `user`;

  async findByEmail(email: string): Promise<IVUser | undefined> {
    const entries = await this.entries();
    return entries.find(([_, v]) => v.email === email)?.[1];
  }
}
```

**Note:** `findByEmail` scans all entries — O(N). For production, consider an index repository or storing email as part of the key.

## Transactions (Read-then-Write Atomicity)

Any method that reads a value and then writes based on that read **must** use `env.transaction()`:

```typescript
// ✅ CORRECT: atomic read-then-write
async findOrCreate(id: number, name: string) {
  return this.env.transaction(async () => {
    const existing = await this.get(id)
    if (existing) {
      const updated = {...existing, name, updatedAt: Date.now()}
      await this.set(id, updated)
      return {user: updated, created: false}
    }
    const user: IVUser = {id, name, createdAt: Date.now(), updatedAt: Date.now()}
    await this.set(id, user)
    return {user, created: true}
  })
}
```

```typescript
// ❌ WRONG: race condition — concurrent calls can interleave
async findOrCreate(id: number, name: string) {
  const existing = await this.get(id)        // read
  if (existing) {
    await this.set(id, {...existing, name})   // write — may overwrite concurrent change
  }
}
```

**When transactions are NOT needed:**

- Single writes: `this.set(key, value)` — already atomic at LMDB level.
- Read-only operations: `this.get()`, `this.has()`, `this.count()`.
- Write-only operations that don't depend on a previous read.

## Cross-Repository Access

Use `this.env.getRepository(OtherRepo)` to access other repositories inside a transaction:

```typescript
class ItemRepo extends LmdbRepository<IVItem, string> {
  static dbName = `items`;

  async create(userId: number, title: string) {
    const seq = this.env.getRepository(SequenceRepo);
    return this.env.transaction(async () => {
      const id = await seq.nextId(userId);
      const item: IVItem = { id, title, createdAt: Date.now() };
      await this.set(`${userId}:${id}`, item);
      await seq.incrCount(userId);
      return item;
    });
  }
}
```

**Rules:**

- Call `getRepository()` inside the method (not in the constructor or a property getter).
- The target repository must be registered in the same `LmdbEnv` before use.
- Multiple `getRepository()` calls inside one `transaction()` are safe and efficient.

## Key Design

Each repository has its own sub-database — there's no need for namespace prefixes in keys:

```typescript
// ✅ CORRECT: natural key in an isolated sub-db
class UserRepo extends LmdbRepository<IVUser, number> {
  static dbName = `user`;
}
await userRepo.set(123, user); // key 123 in "user" sub-db

// ❌ WRONG: redundant namespace prefix
await userRepo.set(`user:123`, user); // "user" prefix is meaningless — sub-db is already "user"
```

For entities scoped by a parent (e.g., items belonging to a user), use a compound key with a private helper:

```typescript
class ItemRepo extends LmdbRepository<IVItem, string> {
  static dbName = `items`;
  private key(userId: number, id: string) {
    return `${userId}:${id}`;
  }
  private keyPrefix(userId: number) {
    return `${userId}:`;
  }

  async list(userId: number) {
    const end = `${this.keyPrefix(userId)}\uffff`;
    const entries = await this.entries({ start: this.keyPrefix(userId), end });
    return entries.map(([_, v]) => v);
  }
}
```

## Error Handling

The package exports typed error classes:

```typescript
import {
  LmdbError,
  LmdbReadOnlyError,
  LmdbTransactionError,
  LmdbEnvClosedError,
  LmdbRepositoryNotRegisteredError,
} from "@gramstax/lmdb";

try {
  await repo.set(key, value);
} catch (err) {
  if (err instanceof LmdbReadOnlyError) {
    console.error(`Cannot write: env is read-only`);
  } else if (err instanceof LmdbTransactionError) {
    console.error(`Transaction failed`, err.cause);
  }
}
```

## Encodings

Set encoding at the `LmdbEnv` level — all sub-databases inherit it:

```typescript
const env = new LmdbEnv({ path: `./data`, encoding: `json` });
```

| Encoding            | Read Speed          | Size     | Use Case                  |
| ------------------- | ------------------- | -------- | ------------------------- |
| `msgpack` (default) | Fast                | Smallest | Production, large values  |
| `json`              | Fastest (V8 native) | Larger   | Debugging, human-readable |

For custom per-repository encoding, use `static codec`:

```typescript
class DateRepo extends LmdbRepository<Date, string> {
  static dbName = `dates`;
  static codec = LmdbCodec.create<Date, number>(
    (d) => d.getTime(),
    (n) => new Date(n),
  );
}
```
