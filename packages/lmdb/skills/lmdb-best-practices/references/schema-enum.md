# schema-enum

Declare closed value sets with `t.enum` — invalid writes fail loudly instead of rotting silently.

## Why

Stringly-typed status fields (`status: t.string()` + a comment saying "active|expired") let any typo persist forever — the reader finds `statuz: `actve`` months later in a range scan. Enum columns validate every write path (`put`/`putSync`/`putMany`/`putIfNotExists`/`addValue`, including enum keys) and throw `LmdbError`. Non-enum columns run zero checks. The failure mode is silent data rot: the write succeeds, the index builds on the typo, and the cleanup query must guess every misspelling ever stored.

## The three spellings

One validation engine, three declarations. All three store the allowed set as `enumValues` on the builder and reject out-of-set writes identically — pick by how much the type should say.

| Spelling | Kind | Example | Narrows to |
| --- | --- | --- | --- |
| `t.enum(`active`, `archived`)` | inferred from first value | `t.enum(1, 2)`, `t.enum(1n, 2n)` | ``active` \| `archived`` |
| `t.string(`active`, `archived`)` | string | literal params on the kind builder | ``active` \| `archived`` |
| `t.number(1, 2)` / `t.bigint(1n, 2n)` | number / bigint | literal params on the kind builder | `1 \| 2` / `1n \| 2n` |
| `t.string()` / `t.number()` (zero args) | wide | no params | `string` / `number` — no validation |

Rules shared by every spelling: the set must be homogen (all string, all number, or all bigint) — empty (`t.enum()`) and mixed (`t.enum(`a`, 1)`) throw `LmdbError` at declaration. Zero-arg calls stay wide and validate nothing. Literals ride the `V` generic, so `.optional()`, `.unique()`, `.index()`, and `static key` narrow automatically with no `as const`.

## Where validation fires

| Call site | Behavior |
| --- | --- |
| `put` / `putSync` | out-of-enum value throws `LmdbError`, write rejected |
| `putMany` | fail-fast: one bad row rejects the whole batch before the first chunk writes |
| `putIfNotExists` | out-of-enum value throws `LmdbError` like `put` |
| Enum `static key` | out-of-enum keys throw — the key column validates like any column |
| Declaration (`t.enum()` empty, mixed kinds) | throws `LmdbError` at schema definition, before `register()` |
| Non-enum columns | zero checks, zero cost — validation touches only columns carrying `enumValues` |

## Incorrect

```typescript
// wrong: open string — a typo'd write persists and no error fires anywhere
static value = {status: t.string()}
await subs.put(1, {status: `actve`} as any) // stored, found months later
```

```typescript
// wrong: mixed kinds throw at declaration — the schema never registers, and
// wrong: the empty call throws too, so there is no "enum of nothing"
static value = {status: t.enum(`a`, 1)} // throws: homogen values of one kind only
static value = {status: t.enum()} // throws: requires at least one value
```

```typescript
// wrong: zero-arg literal builder stays wide — this validates nothing despite
// the comment promising a closed set; the typo below persists silently
static value = {status: t.string()} // wide string, not an enum
await subs.put(1, {status: `archivedd`}) // stored, no LmdbError
```

## Correct

```typescript
// correct: t.enum infers kind from the first value and narrows the row type;
// correct: the typo'd write throws LmdbError instead of persisting
static value = {status: t.enum(`active`, `expired`)}
await subs.put(1, {status: `active`}) // ok
await subs.put(2, {status: `actve`} as any) // rejects: LmdbError
```

```typescript
// correct: literal params validate identically and chain with every modifier;
// correct: enum keys validate too — an out-of-set key throws like a value
class SubSchema extends LmdbSchema {
  static db = `subs`
  static key = t.enum(`free`, `pro`) // enum key: narrow type, validated writes
  static value = {
    status: t.string(`active`, `expired`).optional(), // literal params + optional
    tier: t.number(1, 2).index() // numeric enum under a non-unique index
  }
}
await subs.put(`free`, {status: `active`, tier: 1}) // ok
await subs.put(`enterprise` as any, {status: `active`, tier: 1}) // rejects: LmdbError
```

## Notes

- Homogen only, kind inferred from the first value: `t.enum(`a`, `b`)`, `t.enum(1, 2)`, `t.enum(1n, 2n)`. Empty (`t.enum()`) and mixed (`t.enum(`a`, 1)`) throw `LmdbError` at declaration. Literal params (`t.string(`a`, `b`)`) validate identically.
- `putMany` is fail-fast: one bad row rejects the whole batch before the first chunk writes.
- No `as const` on `static value` — the builder generics already carry the literal union into `ValueOf`/`KeyOf`/`SchemaIndexesOf`, so `findByIndex` on an enum-indexed column stays narrowed.
- Wide columns (`t.string()` with zero args) cost nothing and check nothing — reaching for an enum where the set is genuinely open is over-constraining; use the enum only for sets the domain actually closes.
- Structural, by construction (`packages/lmdb/test/schema.enum-validation.test.ts`, with literal-param coverage in `packages/lmdb/test/schema.enum-literals.test.ts`).
