# schema-enum

Declare closed value sets with `t.enum` — invalid writes fail loudly instead of rotting silently.

## Why

Stringly-typed status fields (`status: t.string()` + a comment saying "active|expired") let any typo persist forever — the reader finds `statuz: `actve`` months later in a range scan. Enum columns validate every write path (`put`/`putSync`/`putMany`/`putIfNotExists`/`addValue`, including enum keys) and throw `LmdbError`. Non-enum columns run zero checks.

## Incorrect

```typescript
// open string: a typo'd write persists, no error anywhere
static value = {status: t.string()}
await subs.put(1, {status: `actve`} as any) // stored, found months later
```

## Correct

```typescript
static value = {status: t.enum(`active`, `expired`)}
await subs.put(1, {status: `active`}) // ok
await subs.put(2, {status: `actve`} as any) // rejects: LmdbError
```

## Notes

- Homogen only, kind inferred from the first value: `t.enum(`a`, `b`)`, `t.enum(1, 2)`, `t.enum(1n, 2n)`. Empty (`t.enum()`) and mixed (`t.enum(`a`, 1)`) throw `LmdbError` at declaration. Literal params (`t.string(`a`, `b`)`) validate identically.
- `putMany` is fail-fast: one bad row rejects the whole batch before the first chunk writes.
- Structural, by construction (`packages/lmdb/test/schema.enum-validation.test.ts`).
