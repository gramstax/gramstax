# schema-defaults

Columns are required by default — reach for `.optional()` to omit, `.default()` to fill.

## Why

Without declared defaults every writer repeats the same fallback (`status: input.status ?? `active``), and the fallbacks drift between call sites. A schema-level `.default()` fills once per write (before validation, envelope, and index maintenance), so readers always see a complete row. There is no `null`: missing means `undefined` (omitted or explicit), never stored as a value. The cost of scattering the fallback is a partial row the moment one writer forgets — and the reader that must then defend against it with `??` on every access.

## Required vs omit-able vs filled

Three declaration states, three read/write contracts. The table is ordered by how much the writer may leave out.

| Declaration | Writer may omit | Stored when omitted | Read type |
| --- | --- | --- | --- |
| `t.string()` (bare) | no — type error | n/a (write rejected) | `string` |
| `t.string().optional()` | yes | absent (never stored as a value) | `string \| undefined` — narrow with `?.` / `??` |
| `t.string().default(`a`)` | yes — implies `.optional()` | ``a`` filled at write time | `string \| undefined` at the type level, complete at runtime |
| `t.number().$defaultFn(() => nextSeq())` | yes — implies `.optional()` | fresh value per write | `number \| undefined` at the type level, complete at runtime |

Fill rules: defaults fill only when the field is `undefined` (omitted or explicit) — an explicit value always wins and the default is untouched. `.default(v)` stores one static value; `.$defaultFn(fn)` calls the factory per write, so sequences and timestamps stay fresh. Last call wins between the two — chaining both keeps only the later one.

## Declaration-time and write-time gates

| Gate | When | Behavior |
| --- | --- | --- |
| Wrong-kind static default (`.default(1)` on `t.string()`) | declaration | throws `LmdbError` — the kind must match string/number/bigint/boolean |
| Out-of-enum static default | declaration | throws `LmdbError` listing the allowed set |
| `$defaultFn` output on an enum column | per write | enum-validated like any written value |
| `$defaultFn` output on a non-enum column | per write | not kind-checked — the factory is trusted |
| Indexed + omit-able column, key omitted entirely | write | throws the index extractor's `LmdbError` |

The last row is the sharp edge: skipping an indexed column's key is not the same as marking it absent. Either pass explicit `undefined` (skips the index row) or give the column a default so the extractor always sees a value.

## Incorrect

```typescript
// wrong: fallback repeated at every call site — one writer forgets and the
// row goes out partial; readers must then ??-defend every access
static value = {status: t.string()}
await subs.put(1, {status: input.status ?? `active`})
await subs.put(2, {}) // type error today, undefined tomorrow
```

```typescript
// wrong: omitting an indexed column's key throws the extractor's LmdbError;
// wrong: the writer meant "no nickname" but the write never lands
static value = {nickname: t.string().optional().index()}
await subs.put(1, {}) // throws — the extractor sees no key at all
```

```typescript
// wrong: wrong-kind static default throws at declaration — the schema never
// registers, and neither does anything else in the same register() batch
static value = {n: t.number().default(`1`)} // throws: must be a number
```

## Correct

```typescript
// correct: schema-level fill — every writer gets the same row, no ?? at the
// call site; explicit values win and the default is untouched
static value = {status: t.enum(`a`, `b`).default(`a`), n: t.number().$defaultFn(() => nextSeq())}
await subs.put(1, {}) // stored {status: `a`, n: 1001}
await subs.put(2, {status: `b`}) // explicit wins, default untouched
```

```typescript
// correct: indexed + omit-able needs either explicit undefined (skips the
// index row, record stays findable by primary key) or a real default
static value = {nickname: t.string().optional().index()}
await subs.put(1, {nickname: undefined}) // ok — no index row, no throw
static value = {nickname: t.string().index().default(`anon`)}
await subs.put(2, {}) // ok — extractor sees `anon`, index row written
```

```typescript
// correct: reads narrow with ?./?? — optional without a default stays absent
// on disk (absent optional cells decode back to absent, never undefined)
static value = {bio: t.string().optional()}
const row = subs.get(1) // {bio?: string | undefined}
const bio = row?.bio ?? `no bio yet` // narrow at the read, once
```

## Notes

- `.default(v)` / `.$defaultFn(fn)` imply `.optional()` (omit-able without declaring it). Last call wins between the two; wrong-kind (string/number/bigint/boolean columns) and out-of-enum static defaults throw `LmdbError` at declaration; `$defaultFn` output is enum-validated per write (non-enum kinds are not kind-checked per write).
- Indexed + omittable columns: omitting the key entirely throws the index extractor's `LmdbError` — pass explicit `undefined` (skips the index row) or give the column a default.
- There is no `null` in this layer: missing means `undefined` (omitted or explicit), never stored as a value. Tests that need a "cleared" state should delete the key or write `undefined`, not a `null` sentinel.
- Defaults compose with enums and indexes (fill runs before validation and index maintenance), but defaults do NOT rescue a missing `static key` — the primary key is always required.
- Structural, by construction (`packages/lmdb/test/schema.defaults.test.ts`).
