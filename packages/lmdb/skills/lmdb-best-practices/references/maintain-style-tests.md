# maintain-style-tests

Boring conventions that keep a database package reviewable.

## Why

Storage bugs corrupt data silently. Deterministic `bun:test` suites plus zero-tolerance style rules are the only cheap defense — and co-located docs keep behavior changes reviewable.

## Incorrect

```typescript
// @ts-ignore
const rows = await repo.values() as any // suppressed types hide decode-shape bugs
```

## Correct

```typescript
// tests: deterministic inputs, tmp dirs via test-helpers, no timers except TTL sleeps
// src: explicit public-boundary types, `unknown` over `any`, narrow `as` casts
// style: Biome (2-space, no semicolons, no `{ }` padding, backticks)
```

## Notes

- `as any` is acceptable in `test/` (fixtures, mocks), forbidden in `src/`.
- Env opens in the constructor; every test closes + removes its tmp dir (`createTestDir`/`rmWithRetry`).
- `files: ["dist"]` — bench/test/docs never publish.
- Behavior changes land with their test + a note in `AGENTS.md` next to the feature.
