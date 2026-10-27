# schema-design

Schema class is the only declaration path — keep it boring and complete.

## Why

Every escape hatch (`_createRepo`, class-style repos, raw `dbName` overloads) was removed. One declaration shape means one code path to optimize, test, and reason about at millions of rows. A schema that passes `register()` carries its key type, row type, index map, codec layout, and TTL behavior in one place — a hand-wired sub-DB spreads those same decisions across five call sites that drift independently.

## Column builders

Every `t.*` builder maps to one TypeScript type. Pick the narrowest builder that holds the data — the row type follows the builder, not the other way around.

| Builder | TS type | Notes |
| --- | --- | --- |
| `t.string()` | `string` | literal params narrow it — see `schema-enum.md` |
| `t.number()` | `number` | literal params narrow it — see `schema-enum.md` |
| `t.bigint()` | `bigint` | msgpack-native; never use as a `static key` |
| `t.boolean()` | `boolean` | valid key kind |
| `t.object<T>()` | `T` (default `Record<string, unknown>`) | generic carries the shape into `ValueOf` |
| `t.array<T>()` | `T[]` (default `unknown[]`) | composite keys use `t.array<string>()` |
| `t.date()` | `Date` | msgpack-native |
| `t.buffer()` | `Uint8Array` | blobs; valid key kind |
| `t.enum(...)` | literal union | homogen only — see `schema-enum.md` |
| `t.any()` | `unknown` | passthrough, no checks |
| `t.map<K, V>()` | `Map<K, V>` | generic or shape-inferred |
| `t.set<T>()` | `Set<T>` | generic or shape-inferred |

`.optional()`, `.unique()`, `.index()`, `.default()`, and `.$defaultFn()` compose on any builder above. `.search()` composes only on string columns in a row-shaped value.

## What shape do I need

`static value` takes three shapes. Choosing wrong buys either a missing API (`increment` on a row) or dead machinery (indexes on a counter nobody queries).

| Shape | Declaration | Use for |
| --- | --- | --- |
| Row | `static value = {id: t.number(), ...}` | entity tables; the only shape with indexes, search, defaults, and the record codec |
| Scalar counter | `static value = t.number()` | bare-number subs with `increment`/`decrement` |
| Scalar blob | `static value = t.string()` or `t.buffer()` | opaque values with no columns |
| dupSort set | scalar `static value` plus `static dupSort = true` | one-key-to-many-ordered-values (`addValue`/`getValues`/`getValuesCount`/`removeValue`, dupSort-only) |

`ValueOf<S>` resolves to the row type for maps and to the scalar type for single builders, so every sub method stays typed either way. Scalar values carry no derived indexes — `deriveIndexes` returns empty for them. `static dupSort = true` with a map value throws at register time.

## Key types

`register()` intersects the inferred key with the lmdb-js key union (`Key[] | string | symbol | number | boolean | Uint8Array`). Most builders survive the intersection — one does not.

| Key builder | Result |
| --- | --- |
| `t.string()`, `t.number()`, `t.boolean()` | narrow key type, use freely |
| `t.array<string>()` | composite key; runtime keys are arrays like `["tenant-a", "u1"]` |
| `t.buffer()` | valid key kind |
| `t.bigint()` | degrades to `never` at the TYPE level (runtime unchanged) — prefer number/string keys |

## Register-time validation

`LmdbSchema.validate` runs on every `register()` and throws `LmdbError` before any sub-DB opens. Failures are declaration bugs, never runtime races — fix the class, not the call site.

| Violation | Error |
| --- | --- |
| Missing or empty `static db` | `LmdbError` naming the class |
| `static key` missing | `LmdbError` naming the schema |
| Key carries `.unique()`/`.index()`/composite | `LmdbError` — the key is the primary key, never an index |
| `static value` missing, or an array instead of a map | `LmdbError` naming the schema |
| Only one of `hookBeforeWrite`/`hookBeforeRead` declared | `LmdbError` — the pair is atomic |
| Non-integer `static version` | `LmdbError` |
| `static dupSort = true` with a map value | `LmdbError` — dupSort needs a scalar |
| `.search()` on a non-string column or a scalar value | `LmdbError` |
| Composite with fewer than 2 columns or an unknown component | `LmdbError` |
| Two columns resolving to the same index name | `LmdbError` — rename or pass an explicit `.index(name)` |
| `unique`/`index`/`search`/composite buried in a `t.object`/`t.array` shape | `LmdbError` — nested markers would be silently ignored, so registration refuses; use a top-level dotted-path column |

## Incorrect

```typescript
// wrong: class-style repos were deleted — register() accepts schema classes only
class Users extends LmdbRepository<User, string> {}
```

```typescript
// wrong: manual openDB wiring bypasses validation, indexes, codec, and TTL;
// wrong: prefix-encoded keys let range scans cross entity boundaries
env.openDB(`user`) // manual handle passing
await users.put(`user:1`, row) // prefix-encoded: range scans cross boundaries
```

```typescript
// wrong: the key is the primary key — marking it indexed throws at register;
// wrong: the missing db means even the error message cannot name the sub
class BadSchema extends LmdbSchema {
  static key = t.number().unique() // throws: key must not be unique or indexed
  static value = {id: t.number()}
}
```

## Correct

```typescript
class UserSchema extends LmdbSchema {
  static db = `user` // required, unique per env — names the sub-DB
  static key = t.number() // primary key — never .unique()/.index() on key
  static value = {
    id: t.number().unique(), // SQL UNIQUE INDEX — duplicates throw LmdbError
    username: t.string().index(), // SQL INDEX — duplicates allowed
    email: t.string(), // plain column: stored, typed, unindexed
    tags: t.array<string>().optional(), // omit-able — reads narrow with ?./??
    createdAt: t.date() // msgpack-native Date
  } // no as const — builder generics carry the literal index markers
}
class Db extends LmdbEnv {
  users!: LmdbEnvSub<typeof UserSchema> // typed handle, schema pre-bound
  constructor(path: string) {
    super({path, maxDbs: 10})
    this.users = this.register(UserSchema) // cached: register === sub
  }
}
```

```typescript
// correct: scalar value for a counter — increment/decrement need the stored
// value itself to be a number, which no row shape provides
class CounterSchema extends LmdbSchema {
  static db = `counter`
  static key = t.string()
  static value = t.number() // scalar: ValueOf resolves to number
}
const counters = env.register(CounterSchema)
await counters.increment(`order-seq`) // 1
```

## Notes

- Key types that survive `KeyOf`: string, number, boolean, array (composite), buffer. `t.bigint()` keys degrade to `never`.
- Scalar `static value` (`t.number()`, `t.string()`) for counters/blobs; `static dupSort = true` for one-key-to-many tables (`addValue`/`getValues`/`getValuesCount`/`removeValue`, dupSort-only).
- Closed sets → `schema-enum.md`; omit-able fields and write-time fill → `schema-defaults.md`.
- Row schemas store positionally (record codec) with zero type change — custom-hook, TTL, and scalar-value schemas bypass it; see `schema-hooks-ttl.md`.
- Full-text columns → `search.md` (`.search()` marker); concatenated keys → `index-declaration.md` (`.index([a, b])`); shape versions for migrations → `migrate.md` (`static version`).
- Domain methods do NOT live on the schema — put business logic in a service class holding the env and call `env.sub(Schema)` from there.
- Deleted APIs stay deleted: `LmdbRepository`, `LmdbCollection`, `RepoOf`, `_createRepo`, `_createCollection`, `static dbName`/`indexes`/`codec`/`serialize`/`deserialize`/`ttlMs` — every one is a compile error or a register-time `LmdbError`, never a fallback.
- Builder shapes are covered by `packages/lmdb/test/schema.builders.test.ts`.
