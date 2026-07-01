# DB Architecture

## Overview

`@gramstax/lmdb` has two core classes:

- **`LmdbEnv`** — a single LMDB environment (one file, one memory map). It manages sub-databases, transactions, and the lifecycle (open/close).
- **`LmdbRepository<T, K>`** — typed CRUD over a single sub-database. Each repository class declares a `static dbName` that becomes an isolated namespace inside the LMDB environment.

```
LmdbEnv (one file, one mmap)
├── sub-db "user"     ← UserRepo
├── sub-db "session"  ← SessionRepo
└── sub-db "config"   ← ConfigRepo
```

Never wrap `LmdbEnv` in a custom class — subclass it instead.

## Subclassing LmdbEnv (Recommended)

```typescript
import { LmdbEnv, LmdbRepository } from "@gramstax/lmdb";

class UserRepo extends LmdbRepository<{ name: string }, number> {
  static dbName = `user`;
}

class Db extends LmdbEnv {
  constructor(storePath: string) {
    super({ path: storePath, maxDbs: 10, compression: true });
  }
}

// Usage
const db = new Db(`./data`);
await db.open();
const users = db.register(UserRepo);
await users.set(1, { name: `Alice` });
await db.close();
```

**Why subclass?**

- All `LmdbEnv` methods (`open`, `close`, `register`, `transaction`, `getRepository`) are inherited.
- No delegation layer — `db.transaction(...)` works directly.
- Cleaner lifecycle management.

## Wrapping LmdbEnv (Not Recommended)

```typescript
// Avoid this pattern
class DbWrapper {
  private env: LmdbEnv;
  constructor(path: string) {
    this.env = new LmdbEnv({ path });
  }
  async open() {
    await this.env.open();
  }
  async close() {
    await this.env.close();
  }
}
```

Wrapping adds unnecessary indirection. Subclassing is simpler and gives you all env capabilities without re-exposing each method.

## Constructor Options

```typescript
const env = new LmdbEnv({
  path: `./data`, // required — directory for LMDB data files
  maxDbs: 10, // max number of sub-databases (repositories)
  compression: true, // LZ4 compression (off-thread, negligible CPU)
  encoding: `json`, // "msgpack" (default, smaller/faster) or "json" (readable)
  readOnly: false, // open in read-only mode
  mapSize: 256 * 1024 * 1024, // 256 MB virtual memory mapping
});
```

Only `path` is required. The defaults are tuned for typical bot use cases.

## Initialization Lifecycle

```typescript
class Db extends LmdbEnv {
  private _ready: Promise<void>;

  constructor(storePath: string) {
    super({ path: storePath, maxDbs: 10, compression: true });
    this._ready = this._init();
  }

  private async _init() {
    await this.open();
    this.register(UserRepo);
    this.register(SessionRepo);
  }

  async ready() {
    await this._ready;
  }
}
```

**Flow:**

1. Constructor starts async initialization
2. `_init()` calls `open()` (idempotent — safe to call multiple times)
3. Repositories are registered via `this.register()`
4. Callers `await db.ready()` before accessing repositories

The `ready()` guard is typically called once in a route guard or middleware — not on every request.

## Graceful Shutdown

```typescript
process.on(`SIGINT`, async () => {
  await db.close();
  process.exit(0);
});
```

`close()` flushes pending writes and releases the memory map. It's idempotent — calling it multiple times is safe.

## Repository Registration

```typescript
this.register(UserRepo); // returns UserRepo instance
this.register(SessionRepo);

// Retrieve later
const users = this.get(UserRepo);
const sessions = this.get(SessionRepo);
```

- `register()` throws if `static dbName` is missing or if a duplicate `dbName` is registered.
- Repositories are lazily bound — the sub-database is opened on first access.
- Registration must happen after `open()`.
