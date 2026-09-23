# schema-defaults

Columns are required by default — reach for `.optional()` to omit, `.default()` to fill.

## Why

Without declared defaults every writer repeats the same fallback (`status: input.status ?? `active``), and the fallbacks drift between call sites. A schema-level `.default()` fills once per write (before validation, envelope, and index maintenance), so readers always see a complete row. There is no `null`: missing means `undefined` (omitted or explicit), never stored as a value.

## Incorrect

```typescript
// fallback repeated at every call site; one writer forgets and stores undefined
static value = {status: t.string()}
await subs.put(1, {status: input.status ?? `active`})
await subs.put(2, {}) // type error today, undefined tomorrow
```

## Correct

```typescript
static value = {status: t.enum(`a`, `b`).default(`a`), n: t.number().$defaultFn(() => nextSeq())}
await subs.put(1, {}) // stored {status: `a`, n: 1001}
await subs.put(2, {status: `b`}) // explicit wins, default untouched
```

## Notes

- `.default(v)` / `.$defaultFn(fn)` imply `.optional()` (omit-able without declaring it). Last call wins between the two; wrong-kind (string/number/bigint/boolean columns) and out-of-enum static defaults throw `LmdbError` at declaration; `$defaultFn` output is enum-validated per write (non-enum kinds are not kind-checked per write).
- Indexed + omittable columns: omitting the key entirely throws the index extractor's `LmdbError` — pass explicit `undefined` (skips the index row) or give the column a default.
- Structural, by construction (`packages/lmdb/test/schema.defaults.test.ts`).
