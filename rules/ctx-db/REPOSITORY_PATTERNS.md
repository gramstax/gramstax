# Repository Patterns & Transactions

## Defining a Collection (Schema)

Every collection is a `LmdbSchema` subclass — `static db` names the sub-database, `static key` is the primary key column, `static value` maps columns to fields:

```typescript
import {LmdbSchema, t} from "@gramstax/lmdb";

type IVUser = {
  id: number;
  name: string;
  email: string;
  createdAt: number;
  updatedAt: number;
};

export class UserSchema extends LmdbSchema {
  static db = `user`;
  static key = t.number(); // primary key — never unique()/index()
  static value = {
    id: t.number(),
    name: t.string(),
    email: t.string().unique(), // SQL UNIQUE INDEX — duplicates throw LmdbUniqueConstraintError
    createdAt: t.number(),
    updatedAt: t.number()
  };
}
```

**Key points:**

- `static db` must be unique within an `LmdbEnv`.
- The key type is set by the `t` builder — `t.number()` for numeric ids, `t.string()` for string ids.
- The key is the natural identifier for your entity.
- Each schema gets its own isolated sub-database — keys between schemas never collide.
- `static value` columns use `t.string()`/`t.number()`/`t.boolean()`/`t.bigint()`/`t.object()`/`t.array()`/`t.date()`/`t.buffer()`; `.nullable()` widens with `| undefined`; `.unique()`/`.index(name?)` declare secondary indexes.

## Service Layer (Domain Methods)

Schemas stay declarative — business logic lives in a service class receiving the `Db` env:

```typescript
import {LmdbEnv, LmdbSchema, t} from "@gramstax/lmdb";

// no repo type — use `typeof UserSchema` directly

export class UserService {
  constructor(private readonly users: IUserRepo) {}

  async findById(id: number): Promise<IVUser | undefined> {
    return this.users.get(id) as IVUser | undefined;
  }

  async findByEmail(email: string): Promise<IVUser | undefined> {
    return (await this.users.findByIndex({email})) as IVUser | undefined; // O(log N) via unique index
  }
}
```

**Note:** the schema's inferred row type is loose (every column resolves to `T | undefined`); the service is the seam that narrows it to the precise domain type.

## Repository File Organization

Place each schema + service pair in a dedicated file, typically under `src/db/repositories/`:

```
src/db/
├── db.ts                  ← LmdbEnv subclass (registers schemas, wires services)
└── repositories/
    ├── user.ts            ← UserSchema + UserService
    ├── session.ts
    └── item.ts
```

## CRUD Methods (on the env, schema class as first arg)

| Method          | Signature                               | Description         | Complexity   |
| --------------- | --------------------------------------- | ------------------- | ------------ |
| `get`           | `(key) => T \| undefined`               | Read by key (SYNC)  | O(1)         |
| `has`           | `(key) => boolean`                      | Check existence (SYNC) | O(1)      |
| `count`         | `() => number`                          | Total entries (SYNC) | O(1)        |
| `put`           | `(key, value, tx?) => Promise<void>`    | Write (upsert)      | O(1)         |
| `delete`        | `(key, tx?) => Promise<boolean>`        | Remove by key       | O(1)         |
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
| `findByIndex`   | `(query) => Promise<T \| T[] \| undefined>` | Index lookup    | O(log N + M) |

**Sync vs async:** `get`/`has`/`count` return values directly (LMDB sync C calls) — do not `await` them. Writes and range queries are async.

## Transactions (Read-then-Write Atomicity)

Any method that reads a value and then writes based on that read **must** use `db.transaction()`:

```typescript
// ✅ CORRECT: atomic read-then-write (in a service)
async findOrCreate(id: number, name: string) {
  return this.users.env.transaction(async () => {
    const existing = this.users.get(id)
    if (existing) {
      const updated = {...existing, name, updatedAt: Date.now()}
      await this.users.put(id, updated)
      return {user: updated, created: false}
    }
    const user: IVUser = {id, name, createdAt: Date.now(), updatedAt: Date.now()}
    await this.users.put(id, user)
    return {user, created: true}
  })
}
```

```typescript
// ❌ WRONG: race condition — concurrent calls can interleave
async findOrCreate(id: number, name: string) {
  const existing = this.users.get(id)            // read
  if (existing) {
    await this.users.put(id, {...existing, name}) // write — may overwrite concurrent change
  }
}
```

**When transactions are NOT needed:**

- Single writes: `db.put(ItemSchema, key, value)` — already atomic at LMDB level.
- Read-only operations: `db.get(ItemSchema, key)`, `db.has(ItemSchema, key)`, `db.count(ItemSchema)`.
- Write-only operations that don't depend on a previous read.

## Cross-Repository Access

Prefer constructor-injected services — one service may depend on another's service:

```typescript
export class ItemService {
  constructor(
    private readonly db: Db,
    private readonly seq: SequenceService // injected — same env
  ) {}

  async create(userId: number, title: string) {
    return this.db.transaction(async () => {
      const id = await this.seq.nextId(userId);
      const item: IVItem = {id, title, createdAt: Date.now()};
      await this.db.put(ItemSchema, `${userId}:${id}`, item);
      await this.seq.incrCount(userId);
      return item;
    });
  }
}
```

Cross-collection access is direct: `db.put(OtherSchema, ...)` inside a transaction.

```typescript
const seq = this.db.get(SequenceSchema, key); // same env, registered instance
```

**Rules:**

- Services must share the same `LmdbEnv` instance.
- The target schema must be registered in that env before use (wire services in `db.init()` after registering).
- Nested `env.transaction()` calls inside a transaction are safe (child transactions).

## Key Design

Each schema has its own sub-database — there's no need for namespace prefixes in keys:

```typescript
// ✅ CORRECT: natural key in an isolated sub-db
class UserSchema extends LmdbSchema {
  static db = `user`;
  static key = t.number();
  static value = {id: t.number(), name: t.string()};
}
await userService.users.put(123, {id: 123, name: `x`}); // key 123 in "user" sub-db

// ❌ WRONG: redundant namespace prefix
await userService.users.put(`user:123`, user); // "user" prefix is meaningless — sub-db is already "user"
```

For entities scoped by a parent (e.g., items belonging to a user), use a compound key with a private helper in the service:

```typescript
class ItemService {
  constructor(private readonly db: Db) {
    db.register(ItemSchema)
  }

  private key(userId: number, id: string) {
    return `${userId}:${id}`;
  }
  private keyPrefix(userId: number) {
    return `${userId}:`;
  }

  async list(userId: number) {
    const end = `${this.keyPrefix(userId)}\uffff`;
    const entries = await this.db.entries(ItemSchema, {start: this.keyPrefix(userId), end});
    return entries.map(([, v]) => v);
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
  LmdbSchemaNotRegisteredError,
} from "@gramstax/lmdb";

try {
  await db.put(ItemSchema, key, value);
} catch (err) {
  if (err instanceof LmdbReadOnlyError) {
    console.error(`Cannot write: env is read-only`);
  } else if (err instanceof LmdbTransactionError) {
    console.error(`Transaction failed`, err.cause);
  }
}
```

## Encodings & Custom Transforms

Set encoding at the `LmdbEnv` level — all sub-databases inherit it:

```typescript
const env = new LmdbEnv({path: `./data`, encoding: `json`});
```

| Encoding            | Read Speed          | Size     | Use Case                  |
| ------------------- | ------------------- | -------- | ------------------------- |
| `msgpack` (default) | Fast                | Smallest | Production, large values  |
| `json`              | Fastest (V8 native) | Larger   | Debugging, human-readable |

For per-repository custom transforms (the former `static codec` / `LmdbCodec`), use a schema's `static hookBeforeWrite`/`static hookBeforeRead` pair — they run before LMDB serializes the value / after it deserializes it:

```typescript
class DateSchema extends LmdbSchema {
  static db = `dates`;
  static key = t.string();
  static value = {at: t.date()};
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as {at: Date}).at.getTime()});
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)});
}
```

`hookBeforeWrite` and `hookBeforeRead` must be declared together — registration throws `LmdbError` otherwise.
