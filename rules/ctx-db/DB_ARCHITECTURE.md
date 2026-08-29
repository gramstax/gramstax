# DB Architecture

## Overview

`@gramstax/lmdb` has three core pieces:

- **`LmdbEnv`** — a single LMDB environment (one file, one memory map). It manages sub-databases, transactions, and the lifecycle (open/close).
- **`LmdbSchema`** — the declarative collection declaration. A schema class with `static db`, `static key` (a `t` builder) and `static value` (a map of `t` builders) is passed to `env.register(SchemaClass)`; the returned typed repository is bound to an isolated sub-database named by `static db`.
- **Collection operations** — all run on `LmdbEnv` methods with the schema class as first argument (`env.put(UserSchema, ...)`, `env.get(UserSchema, key)`) or a raw dbName (`env.get<V, K>(`dbName`, key)`). Schemas are declarative; a service class receives the `Db` env and calls these methods.

```
LmdbEnv (one file, one mmap)
├── sub-db "user"     ← UserSchema (registered)
├── sub-db "session"  ← SessionSchema
└── sub-db "config"   ← ConfigSchema
```

Never wrap `LmdbEnv` in a custom class — subclass it instead.

## Subclassing LmdbEnv (Recommended)

```typescript
import {LmdbEnv, LmdbSchema, t} from "@gramstax/lmdb";
import {LmdbEnv, LmdbSchema, t} from "@gramstax/lmdb";

class UserSchema extends LmdbSchema {
  static db = `user`;
  static key = t.number();
  static value = {
    id: t.number(),
    name: t.string()
  };
}

class UserService {
  constructor(private readonly db: Db) { db.register(UserSchema) }

  async touch(id: number, name: string) {
    await this.users.put(id, {id, name});
  }
}

class Db extends LmdbEnv {
  users!: UserService;

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true});
    this.users = new UserService(this.register(UserSchema));
  }
}

// Usage
const db = new Db(`./data`);
await db.users.touch(1, `Alice`);
await db.close();
```

**Why subclass?**

- All `LmdbEnv` methods (`close`, `register`, `transaction`, `getRepository`) are inherited.
- No delegation layer — `db.transaction(...)` works directly.
- Cleaner lifecycle management.

## Wrapping LmdbEnv (Not Recommended)

```typescript
// Avoid this pattern
class DbWrapper {
  private env: LmdbEnv;
  constructor(path: string) {
    this.env = new LmdbEnv({path});
  }
  close() {
    return this.env.close();
  }
}
```

Wrapping adds unnecessary indirection. Subclassing is simpler and gives you all env capabilities without re-exposing each method.

## Constructor Options

```typescript
const env = new LmdbEnv({
  path: `./data`, // required — directory for LMDB data files
  maxDbs: 10, // max number of sub-databases (schemas)
  compression: true, // LZ4 compression (off-thread, negligible CPU)
  encoding: `json`, // "msgpack" (default, smaller/faster) or "json" (readable)
  readOnly: false, // open in read-only mode
  mapSize: 256 * 1024 * 1024, // 256 MB virtual memory mapping
});
```

Only `path` is required. The defaults are tuned for typical bot use cases.

## Schema Registration

```typescript
class UserSchema extends LmdbSchema {
  static db = `user`;
  static key = t.number();
  static value = {id: t.number(), name: t.string()};
}

// Register once — operations via env.method(Schema, ...)
const users = this.register(UserSchema);

// Retrieve the same instance later by schema class
const usersAgain = this.get(UserSchema); // same instance
this.has(UserSchema); // true
```

- `static db` must be unique within the env — registering a duplicate `db` throws `LmdbDuplicateDbNameError`, and re-registering the same schema class throws `LmdbSchemaAlreadyRegisteredError`.
- `static key` is the primary key column (a single `t` builder) — it must NOT carry `unique`/`index`.
- `static value` columns with `.unique()` or `.index(name?)` become secondary indexes maintained atomically with primary writes.
- The schema's inferred row type is loose (every column is `T | undefined`); narrow it to a precise domain type in the service layer.

## Initialization Lifecycle

```typescript
class Db extends LmdbEnv {
  users!: UserService;

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true});
  }

  async init() {
    if (this.users) return; // idempotent — safe to call more than once
    this.users = new UserService(this.register(UserSchema));
    this.sessions = new SessionService(this.register(SessionSchema));
  }
}
```

**Flow:**

1. The env opens synchronously during construction — no `await env.open()`.
2. `init()` (or the constructor) registers schemas and wires services.
3. Callers `await db.init()` once from a route guard or middleware, then use the services.

## Graceful Shutdown

```typescript
process.on(`SIGINT`, async () => {
  await db.close();
  process.exit(0);
});
```

`close()` flushes pending writes and releases the memory map. It's idempotent — calling it multiple times is safe.

## Service Layer

Schemas stay declarative. All domain logic lives in service classes that receive the `Db` env and call `env.method(Schema, ...)`:

```typescript
class ItemService {
  constructor(
    private readonly db: Db,
    private readonly seq: SequenceService
  ) {}

  async create(userId: number, title: string) {
    return this.db.transaction(async () => {
      const id = await this.seq.nextId(userId);
      await this.db.put(ItemSchema, `${userId}:${id}`, {id, title});
      return id;
    });
  }
}
```

Services are the seam where the loose schema row type meets the precise domain type.
