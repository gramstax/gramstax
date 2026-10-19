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

A framework library sets the conventions every downstream bot inherits. Permitting type-suppression, default exports, and dependency sprawl would degrade type-safety, break the barrel pattern, and bloat the install footprint. The project wants firm, machine-checked rules of thumb.

## Decision

Encode these conventions (from `AGENTS.md` "Anti-Patterns" and the lint config):

1. **No `@ts-ignore` / `@ts-expect-error` in source**: type errors must be *fixed*, not suppressed. (`eslint`/`tsc` enforce; AGENTS.md: "Do not add `@ts-ignore` ... for hide error you must be fix it!")
2. **Named exports only**: every public symbol is a named export; no `export default`. The barrel `src/index.ts` re-exports by name, and `PageManager._getFile` *requires* a named (non-default) page export (`manager.ts:56-63`).
3. **Minimal dependencies**: prefer `grammy`, `keyv`, `logging-pretty`; avoid adding new packages.
4. **`vitest`/`jest` banned**: use `bun:test` exclusively.
5. **`any` allowed but discouraged** in source; type suppression is acceptable *only in tests* (`as any`).
6. **Formatting is enforced by Biome** (`biome.json`): 2-space indent, no semicolons, `printWidth: 300` for TS and `200` for JSON, `trailingComma: none`. Backtick string literals are a convention only: `biome.json` sets `quoteStyle: "double"` and `plugins: []`, so no rule fails on a non-backtick string.t-any: off`, `no-unused-vars: error` (ignore `_*`).

<Warning>
  Rule 1 is machine-checked: a `@ts-ignore` or `@ts-expect-error` in source fails
  the gate. Suppression is acceptable only in tests, as `as any`. Rule 2 is
  enforced at load time: `PageManager._getFile` requires a named page export, so
  a default export throws rather than falling back.
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
| Default exports for pages | Breaks `PageManager._getFile` and the barrel pattern. |
| Add helper libs as needed | Dependency creep; contradicts the minimal-dep stance. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Docs | `AGENTS.md`: "Anti-Patterns: Do not add `@ts-ignore`/`@ts-expect-error` … No default exports: always named exports … Avoid adding new dependencies; prefer grammy, keyv, logging-pretty … Do not use vitest or jest." |
| Config | `biome.json`: `lineWidth` 300 (TS)/200 (JSON), `semicolons: "asNeeded"`, `useTabs: false`, `trailingComma: "none"` | never` |
| Code | `src/index.ts:13-29`: named `export *` barrel with `// type` separator |
| Code | `src/page/manager.ts:56-63`: `_getFile` requires a non-default export |

## Related

- [Development](../development.md): Code Style, Testing
- [ADR-0003](/guides/adr/0003-keyv-redis-cache.md): dependency-minimalism in practice
- [ADR-0007](/guides/adr/0007-bun-tsup-nx-toolchain.md): the lint/build stack that enforces these
