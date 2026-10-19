---
title: "ADR-0008: No @ts-ignore, Named Exports Only, Minimal Deps"
description: The conventions every downstream bot inherits, no type suppression, named exports only, bun tests, and a deliberately small dependency set.
icon: scale
---

# ADR-0008: No `@ts-ignore`, named exports only, minimal deps

<Info>
  **Status:** Accepted

  **Date:** 2025 (inferred from package history)
</Info>

## Context

A framework library sets the conventions every downstream bot inherits. Permitting type-suppression, default exports, and dependency sprawl would degrade type-safety, break the barrel pattern, and bloat the install footprint. The project wants firm rules of thumb, most of them checked by the toolchain.

## Decision

Encode these conventions (from `AGENTS.md` "Anti-Patterns" and the lint config):

1. **No `@ts-ignore` / `@ts-expect-error` in source**: type errors must be *fixed*, not suppressed. This is a review rule rather than a lint rule (`biome.json` configures no check for it); `tsc` only reports an `@ts-expect-error` directive that suppresses nothing.
2. **Named exports only**: every public symbol is a named export; no `export default`. The barrel `src/index.ts` re-exports by name. Page loading takes `Object.values(mod)[0]`, so a default-only export does load, but a second export makes the first value arbitrary; the convention is one named class per page (`manager.ts:45-52`).
3. **Minimal dependencies**: prefer `grammy`, `keyv`, `logging-pretty`; avoid adding new packages.
4. **`vitest`/`jest` banned**: use `bun:test` exclusively.
5. **`any` allowed but discouraged** in source; type suppression is acceptable *only in tests* (`as any`).
6. **Formatting is enforced by Biome** (`biome.json`): 2-space indent, no semicolons, `lineWidth: 300` for TS and `200` for JSON, `trailingComma: "none"`, `bracketSpacing: false`. Backtick string literals are a convention only: `biome.json` sets `quoteStyle: "double"` and `plugins: []`, so no rule fails on a non-backtick string. Unused variables are an error (`noUnusedVariables`).

<Warning>
  Rule 1 is a review rule, not a gate: `biome.json` configures no `@ts-ignore`
  check, and `tsc` only reports an unused `@ts-expect-error` directive. Rule 2 has
  a sharp edge rather than a hard failure: `PageManager._getFile` takes
  `Object.values(mod)[0]`, so a module that exports nothing throws, while a
  default-only export loads. A page should export exactly one named class.
</Warning>

## Consequences

### Benefits

- Public API stays greppable and tree-shakeable via named exports + barrel.
- Type errors surface in CI (`ci:check`) rather than being silenced.
- Small, stable dependency surface (grammy/keyv/logging-pretty) eases auditing and updates.

### Trade-offs

- `any` is permitted, so reviews must still catch careless typing.
- Banning jest/vitest means tests are tied to the Bun runtime.

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| Allow `@ts-ignore` for "hard" errors | Hides root causes; CI would pass with broken types. |
| Default exports for pages | Works only while the default is the module's sole export; a second export makes the loaded value arbitrary. The barrel and every example use named exports. |
| Add helper libs as needed | Dependency creep; contradicts the minimal-dep stance. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Docs | `AGENTS.md`: "Anti-Patterns: Do not add `@ts-ignore`/`@ts-expect-error` … No default exports: always named exports … Avoid adding new dependencies; prefer grammy, keyv, logging-pretty … Do not use vitest or jest." |
| Config | `biome.json`: `lineWidth` 300 (TS)/200 (JSON), `semicolons: "asNeeded"`, `useTabs: false`, `trailingCommas: "none"`, `bracketSpacing: false` |
| Code | `src/index.ts`: named `export *` barrel with a `// type` separator |
| Code | `src/page/manager.ts:45-52`: `_getFile` takes `Object.values(mod)[0]` |

## Related

- [Development](../development.md): Code Style, Testing
- [ADR-0003](/guides/adr/0003-keyv-redis-cache.md): dependency-minimalism in practice
- [ADR-0007](/guides/adr/0007-bun-tsup-nx-toolchain.md): the lint/build stack that enforces these
