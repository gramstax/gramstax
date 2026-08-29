# @gramstax/lmdb — Database Layer Guide

`@gramstax/lmdb` is a schema-first key-value database library built on LMDB (Lightning Memory-Mapped Database). You declare collections as `LmdbSchema` classes (static `db`/`key`/`value`), register them on an `LmdbEnv`, and put domain logic in a thin service class holding the typed repository. It provides typed CRUD per sub-database, atomic cross-repository transactions, and snapshot reads.

**Installation:**

```bash
npm install @gramstax/lmdb
# or
bun add @gramstax/lmdb
```

## Guide Index

- `./DB_ARCHITECTURE.md`: Root `LmdbEnv`, extending it vs wrapping it, schema registration, initialization lifecycle
- `./REPOSITORY_PATTERNS.md`: Schema declarations, service layers, typed CRUD, atomic transactions, cross-repo access
- `./PERFORMANCE.md`: Complexity table, O(1) operations, range query efficiency, batch reads
- `./MIGRATION_GUIDE.md`: Migrating class-style repositories to schema + service, and raw `lmdb` to `@gramstax/lmdb`

## Quick Reference

```typescript
import {LmdbEnv, LmdbSchema, t} from "@gramstax/lmdb";
import {LmdbEnv, LmdbSchema, t} from "@gramstax/lmdb";

// 1. Declare a collection as a schema class
class UserSchema extends LmdbSchema {
  static db = `user`;
  static key = t.number(); // primary key
  static value = {
    id: t.number(),
    name: t.string(),
    email: t.string()
  };
}

// 2. Service layer — domain methods over the typed repository
class UserService {
  constructor(private readonly db: Db) { db.register(UserSchema) }

  async touch(id: number, name: string) {
    await this.users.put(id, {id, name, email: `${id}@x.io`});
  }
}

// 3. Root env class registers the schema and wires the service
class Db extends LmdbEnv {
  users!: UserService;

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 10, compression: true});
    this.users = new UserService(this.register(UserSchema));
  }
}

// 4. Use it — reads are synchronous, writes async
const db = new Db(`./data`);
const alice = db.users; // service
await db.users.touch(1, `Alice`);
await db.close();
```

| Concept       | Guideline                                                          |
| ------------- | ------------------------------------------------------------------ |
| Root class    | `class Db extends LmdbEnv` — subclass, don't wrap                   |
| Collection    | `class XSchema extends LmdbSchema` with `static db`/`key`/`value`   |
| Business logic| Service class receiving the `Db` env — `db.put(XSchema, ...)` — schema stays declarative |
| Atomic writes | `env.transaction()` for any read-then-write pattern                 |
| Cross-repo    | Inject the other schema's service, or `env.getRepository(OtherSchema)` |
| Key design    | Natural key per schema — no namespace prefixes                      |
| Counting      | `db.count(Schema)` = O(1) — prefer over manual counters              |
