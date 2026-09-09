# maintain-style-tests.md

Verdict: backticks, no semicolons, `bun:test` only; per-package `tsc` green;
full suite green; no type suppression in source.

## Why

Biome enforces the style (`2-space`, `asNeeded` semicolons, backtick
strings); `bun:test` (`describe`/`it`/`expect`) is the only runner — no
vitest/jest. Every package typechecks through its own tsconfig
(`tsc --noEmit -p packages/worker-thread`), which is what `ci:check`
wires — the root `tsc --noEmit` alone sees almost nothing. Source forbids
`@ts-ignore`/`@ts-expect-error` (fix it instead); test files may use `as any`
sparingly.

## Incorrect

```typescript
// @ts-ignore
await worker.mtd_DoWork() // unprefixed, PascalCase: invisible to the mtd* contract
import {x} from 'node:y' // single quotes trip the backtick rule
```

## Correct

```typescript
await worker.request(`mtdDoWork`, []) // mtd* prefix, backticks, no suppression
bun test packages/worker-thread/test/ // 242 pass / 0 fail gate
bunx tsc --noEmit -p packages/worker-thread // per-package typecheck gate
```

## Notes

- `strict` + `noUncheckedIndexedAccess` are on — index access needs guards.
- `node:` prefixes for builtins; `import type` for type-only imports.
- Test every fix red→green; wrap thread/socket awaits in `withTimeout`
  (see `test/helpers.ts`) so the suite can never hang.
- Never commit unless asked; never leave the tree red.
