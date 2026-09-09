# schema-design

Schema class is the only declaration path — keep it boring and complete.

## Why

Every escape hatch (`_createRepo`, class-style repos, raw `dbName` overloads) was removed. One declaration shape means one code path to optimize, test, and reason about at millions of rows.

## Incorrect

```typescript
// class-style repos, manual openDB wiring, prefix-encoded keys — all removed
class Users extends LmdbRepository<User, string> {}
env.openDB(`user`) // manual handle passing
await users.put(`user:1`, row) // prefix-encoded: range scans cross boundaries
```

## Correct

```typescript
class UserSchema extends LmdbSchema {
  static db = `user`
  static key = t.number() // never .unique()/.index() on key
  static value = {
    id: t.number().unique(),
    username: t.string().index(),
    email: t.string(),
    tags: t.array<string>().nullable(),
    createdAt: t.date()
  }
}
class Db extends LmdbEnv {
  users!: LmdbEnvSub<typeof UserSchema>
  constructor(path: string) {
    super({path, maxDbs: 10})
    this.users = this.register(UserSchema) // cached: register === sub
  }
}
```

## Notes

- Key types that survive `KeyOf`: string, number, boolean, array (composite), buffer. `t.bigint()` keys degrade to `never`.
- `ValueOf` columns are nullable-by-default (`T | undefined`).
- Scalar `static value` (`t.number()`, `t.string()`) for counters/blobs; `static dupSort = true` for one-key-to-many tables.
