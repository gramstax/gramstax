# Migration Guide: raw `lmdb` → `@gramstax/lmdb`

## Step 1: Replace Dependency

```bash
npm uninstall lmdb
npm install @gramstax/lmdb
```

**Before:**

```json
{
  "dependencies": {
    "lmdb": "^3.4.4"
  }
}
```

**After:**

```json
{
  "dependencies": {
    "@gramstax/lmdb": "^0.9.0"
  }
}
```

## Step 2: Replace Direct `open()` with `LmdbEnv`

**Before:**

```typescript
import { open } from "lmdb";

const db = open(`./data`, { compression: true });
```

**After:**

```typescript
import { LmdbEnv } from "@gramstax/lmdb";

const env = new LmdbEnv({ path: `./data`, compression: true });
await env.open();
```

## Step 3: Replace Prefix Keys with Sub-Databases

**Before:** One big database with prefixed keys to avoid collisions.

```typescript
await db.put(`user:${id}`, user);
await db.put(`session:${sid}`, session);
await db.put(`config:${key}`, configValue);
```

**After:** Each repository gets its own sub-database. Keys are natural identifiers.

```typescript
class UserRepo extends LmdbRepository<IUser, number> {
  static dbName = `user`; // ← sub-database name, not a key prefix
}
class SessionRepo extends LmdbRepository<ISession, string> {
  static dbName = `session`;
}
class ConfigRepo extends LmdbRepository<string, string> {
  static dbName = `config`;
}

// Register with env
const users = env.register(UserRepo);
const sessions = env.register(SessionRepo);
const config = env.register(ConfigRepo);

// Use — no prefixes needed
await users.set(id, user);
await sessions.set(sid, session);
await config.set(key, value);
```

## Step 4: Add Transactions for Atomic Writes

**Before:** No atomicity between dependent writes.

```typescript
await db.put(`item:${id}`, item);
await db.put(`count:${userId}`, count + 1); // if this fails, count is stale
```

**After:** Use `env.transaction()` to batch writes atomically.

```typescript
class ItemRepo extends LmdbRepository<IItem, string> {
  static dbName = `items`;

  async create(userId: number, title: string) {
    const counters = this.env.getRepository(CounterRepo);
    return this.env.transaction(async () => {
      const id = await counters.nextId(userId);
      const item = { id, title, createdAt: Date.now() };
      await this.set(`${userId}:${id}`, item);
      await counters.incr(userId);
      return item;
    });
  }
}
```

All writes inside the callback succeed or fail together.

## Step 5: Replace Manual Counters

**Before:** Manually tracking counts with separate keys.

```typescript
const countKey = `count:subscribers`;
let count = db.get(countKey) || 0;
await db.put(countKey, count + 1);
```

**After:** Use `count()` for total entry count (O(1), LMDB-maintained).

```typescript
const total = await subscriberRepo.count(); // O(1)
```

For per-group counters, use a dedicated counter repository with `get`/`set` (O(1)).

## Step 6: Replace Sync `get()` with Async

**Before:** Raw `lmdb` returns values synchronously from `get()`.

```typescript
const val = db.get(key); // sync
await db.put(key, val + 1); // but put is async
```

**After:** `@gramstax/lmdb` uses async consistently.

```typescript
const val = await repo.get(key); // async — always await
await repo.set(key, val + 1); // async
```

## Step 7: Leverage Typed Repository Methods

Replace raw LMDB operations with typed repository methods:

```typescript
// Before — raw operations
const keys = db.getKeys({ start: `user:`, end: `user:\uffff` }).asArray;
for (const { key, value } of db.getRange({
  start: `user:`,
  end: `user:\uffff`,
})) {
  console.log(key, value);
}

// After — typed repository methods
const entries = await userRepo.entries();
for (const [key, value] of entries) {
  console.log(key, value); // value is typed as IUser
}
```

## Quick Reference

| Raw `lmdb`                  | `@gramstax/lmdb`                                |
| --------------------------- | ----------------------------------------------- |
| `open(path, opts)`          | `new LmdbEnv({path, ...})` + `await env.open()` |
| `db.put(key, val)`          | `await repo.set(key, val)`                      |
| `db.get(key)`               | `await repo.get(key)`                           |
| `db.remove(key)`            | `await repo.delete(key)`                        |
| `db.doesExist(key)`         | `await repo.has(key)`                           |
| `db.getKeys(opts).asArray`  | `await repo.keys(opts)`                         |
| `db.getRange(opts).asArray` | `await repo.entries(opts)`                      |
| —                           | `env.transaction(fn)` for atomic writes         |
| `db.close()`                | `await env.close()`                             |
