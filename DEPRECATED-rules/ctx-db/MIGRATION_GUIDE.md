# Migration Guide

Two migrations, in order:

1. **Class-style repositories → schema + service** (v1.x breaking change — the class-style statics no longer compile)
2. **Raw `lmdb` → `@gramstax/lmdb`** (for projects still on the raw driver)

---

## Part 1: Class-style Repositories → Schema + Service

`@gramstax/lmdb` is schema-only since v1.x. The old class-style path — `class X extends LmdbRepository { static dbName; static indexes; static codec }` registered via `env.register(RepoClass)` — was **removed**. The statics `dbName`, `indexes`, `codec`, `serialize`/`deserialize`, `dupSort`, `useVersions`, `ttlMs` no longer exist on `LmdbRepository`, and `LmdbCodec` was deleted.

### Step 1: Replace the repository class with a schema class

**Before (removed):**

```typescript
class UserRepo extends LmdbRepository<IVUser, number> {
  static dbName = `user`;
  static indexes = {
    username: {unique: true},
    email: {}
  } as const;
}
```

**After:**

```typescript
class UserSchema extends LmdbSchema {
  static db = `user`;
  static key = t.number(); // was the K generic
  static value = {
    id: t.number(),
    username: t.string().unique(), // was static indexes {username: {unique: true}}
    email: t.string().index(),     // was static indexes {email: {}}
    createdAt: t.number()
  };
}
```

| Old class static   | New schema static / builder                                    |
| ------------------ | -------------------------------------------------------------- |
| `static dbName`    | `static db`                                                     |
| — (K generic)      | `static key = t.number()` / `t.string()` / `t.boolean()` / `t.buffer()` |
| — (T generic)      | `static value` map of `t` builders (`ValueOf<typeof X>` is the row type) |
| `static indexes`   | `.unique()` / `.index(name?)` on the value column builders      |
| `static codec = LmdbCodec.create(...)` | `static hookBeforeWrite` + `static hookBeforeRead` (declared together) |
| `static serialize` / `static deserialize` | `static hookBeforeWrite` / `static hookBeforeRead`                   |
| `static dupSort`   | internal only — construct via `env._createRepo(name, {dupSort})` (not for user code) |
| `static ttlMs`     | `static ttl` (ms) on the schema                                 |

### Step 2: Move domain methods into a service class

**Before (removed):**

```typescript
class UserRepo extends LmdbRepository<IVUser, number> {
  static dbName = `user`;

  async findOrCreate(id: number, name: string) {
    const existing = await this.get(id);
    ...
  }
}
```

**After:**

```typescript
class UserService {
  constructor(private readonly repo: RepoOf<typeof UserSchema>) {}

  async findOrCreate(id: number, name: string) {
    const existing = this.repo.get(id); // get/has/count are SYNC now
    ...
  }
}
```

Method renames: `set` → `put`; `get`/`has`/`count` are now **synchronous** (drop the `await`); everything else keeps its name.

### Step 3: Update registration and cross-repo access

**Before (removed):**

```typescript
class Db extends LmdbEnv {
  users!: UserRepo;
  constructor(path: string) {
    super({path});
    this.users = this.register(UserRepo);
  }
}

// inside another repo:
this.env.getRepository(SequenceRepo)
```

**After:**

```typescript
class Db extends LmdbEnv {
  users!: UserService;
  constructor(path: string) {
    super({path});
    this.users = new UserService(this.register(UserSchema));
  }
}

// in a service — schema-keyed lookup still works:
this.repo.env.getRepository(SequenceSchema)
// or inject the SequenceService in the constructor (recommended)
```

### Step 4: Reconcile the row type

The schema's inferred row type (`ValueOf<typeof X>`) is looser than a hand-written interface — every column resolves to `T | undefined`. The service layer is the seam that narrows it:

```typescript
async fetch(id: number): Promise<IVUser | undefined> {
  return this.repo.get(id) as IVUser | undefined;
}
```

### Step 5: Remove `LmdbCodec` imports

`LmdbCodec` and `LmdbCodecConfigurable` are deleted. Custom transforms are schema `static hookBeforeWrite`/`static hookBeforeRead`:

**Before:**

```typescript
class DateRepo extends LmdbRepository<Date, string> {
  static dbName = `dates`;
  static codec = LmdbCodec.create<Date, number>((d) => d.getTime(), (n) => new Date(n));
}
```

**After:**

```typescript
class DateSchema extends LmdbSchema {
  static db = `dates`;
  static key = t.string();
  static value = {at: t.date()};
  static hookBeforeWrite = (row: unknown): unknown => ({at: (row as {at: Date}).at.getTime()});
  static hookBeforeRead = (raw: unknown): unknown => ({at: new Date((raw as {at: number}).at)});
}
```

---

## Part 2: Raw `lmdb` → `@gramstax/lmdb`

### Replace Dependency

```bash
npm uninstall lmdb
npm install @gramstax/lmdb
```

### Replace Direct `open()` with `LmdbEnv`

**Before:**

```typescript
import {open} from "lmdb";
const db = open(`./data`, {compression: true});
```

**After:**

```typescript
import {LmdbEnv} from "@gramstax/lmdb";
const env = new LmdbEnv({path: `./data`, compression: true}); // opens synchronously
```

### Replace Prefix Keys with Sub-Databases

**Before:** One big database with prefixed keys to avoid collisions.

```typescript
await db.put(`user:${id}`, user);
await db.put(`session:${sid}`, session);
await db.put(`config:${key}`, configValue);
```

**After:** Each schema gets its own sub-database. Keys are natural identifiers.

```typescript
class UserSchema extends LmdbSchema {
  static db = `user`; // ← sub-database name, not a key prefix
  static key = t.number();
  static value = {id: t.number(), name: t.string()};
}
class SessionSchema extends LmdbSchema {
  static db = `session`;
  static key = t.string();
  static value = {sid: t.string(), token: t.string()};
}
class ConfigSchema extends LmdbSchema {
  static db = `config`;
  static key = t.string();
  static value = {key: t.string(), value: t.string()};
}

// Register with env
const users = env.register(UserSchema);
const sessions = env.register(SessionSchema);
const config = env.register(ConfigSchema);

// Use — no prefixes needed
await users.put(id, user);
await sessions.put(sid, session);
await config.put(key, value);
```

### Add Transactions for Atomic Writes

**Before:** No atomicity between dependent writes.

```typescript
await db.put(`item:${id}`, item);
await db.put(`count:${userId}`, count + 1); // if this fails, count is stale
```

**After:** Use `env.transaction()` to batch writes atomically (in the service layer).

```typescript
async create(userId: number, title: string) {
  return this.repo.env.transaction(async () => {
    const id = await this.seq.nextId(userId);
    await this.repo.put(`${userId}:${id}`, {id, title, createdAt: Date.now()});
    await this.seq.incrCount(userId);
    return id;
  });
}
```

All writes inside the callback succeed or fail together.

### Replace Manual Counters

**Before:** Manually tracking counts with separate keys.

```typescript
const countKey = `count:subscribers`;
let count = db.get(countKey) || 0;
await db.put(countKey, count + 1);
```

**After:** Use `count()` for total entry count (O(1), LMDB-maintained).

```typescript
const total = repo.count(); // O(1), sync
```

For per-group counters, keep a dedicated schema with `get`/`put` (O(1)) updated inside the same transaction as the write.

### Replace Sync `get()` with the Typed Repository API

**Before:** Raw `lmdb` returns values synchronously from `get()`.

```typescript
const val = db.get(key); // sync
await db.put(key, val + 1); // but put is async
```

**After:** `@gramstax/lmdb` reads are sync (`get`/`has`/`count`), writes are async — always `await` writes and range queries.

```typescript
const val = repo.get(key); // sync — no await needed
await repo.put(key, val + 1); // async — always await
```

### Leverage Typed Repository Methods

**Before — raw operations:**

```typescript
const keys = db.getKeys({start: `user:`, end: `user:\uffff`}).asArray;
for (const {key, value} of db.getRange({start: `user:`, end: `user:\uffff`})) {
  console.log(key, value);
}
```

**After — typed repository methods:**

```typescript
const entries = await repo.entries({start: `user:`, end: `user:\uffff`});
for (const [key, value] of entries) {
  console.log(key, value); // value is typed
}
```

## Quick Reference

| Raw `lmdb`                  | `@gramstax/lmdb` (schema-only)              |
| --------------------------- | ------------------------------------------- |
| `open(path, opts)`          | `new LmdbEnv({path, ...})` (opens in ctor)  |
| `db.put(key, val)`          | `await repo.put(key, val)`                  |
| `db.get(key)`               | `repo.get(key)` (sync)                      |
| `db.remove(key)`            | `await repo.delete(key)`                    |
| `db.doesExist(key)`         | `repo.has(key)` (sync)                      |
| `db.getKeys(opts).asArray`  | `await repo.keys(opts)`                     |
| `db.getRange(opts).asArray` | `await repo.entries(opts)`                  |
| —                           | `env.transaction(fn)` for atomic writes     |
| `db.close()`                | `await env.close()`                         |

| Old class-style (removed)         | New schema + service                         |
| --------------------------------- | -------------------------------------------- |
| `static dbName`                   | `static db`                                  |
| `static indexes`                  | `.unique()` / `.index()` on value columns    |
| `static codec` / `LmdbCodec`      | `static hookBeforeWrite` + `static hookBeforeRead` |
| `static ttlMs`                    | `static ttl`                                 |
| domain methods on the repo class  | service class holding `RepoOf<typeof XSchema>` |
| `this.set(key, value)`            | `this.repo.put(key, value)`                  |
| `await this.get(key)`             | `this.repo.get(key)` (sync)                  |
| `this.env.getRepository(OtherRepo)` | `this.repo.env.getRepository(OtherSchema)`  |
