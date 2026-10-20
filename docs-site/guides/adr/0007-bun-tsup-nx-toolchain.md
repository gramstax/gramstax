---
title: "ADR-0007: Bun, tsup, Nx, and API-Extractor Toolchain"
description: Why the monorepo standardizes on Bun for runtime and tests, tsup for the dual build, Nx for orchestration, and API-Extractor for docs.
icon: wrench
---

# ADR-0007: Bun + tsup + Nx + API-Extractor toolchain

<Info>
  **Status:** Accepted

  **Date:** 2025 (inferred from package history)
</Info>

## Context

`gramstax` is a published TypeScript library inside a multi-package monorepo (`packages/*`, `example/*`). It needs: a fast runtime + test runner, a dual ESM/CJS build with type declarations, monorepo task orchestration, and generated API reference docs. The toolchain should be consistent across every package in the repo.

## Decision

Standardize on the **Bun + tsup + Nx + API-Extractor** stack:

- **Runtime / tests**: `bun` (`bun:test`, `Bun.serve` for webhooks). `package.json` scripts use `bun test`, `bun run lint`, etc.
- **Build**: `tsup` (`tsup.config.ts`) emits to `dist/src` as `cjs` + `esm` with `dts: true`, `minify: true`, `platform: node`, `target: esnext`, keeping `bun` external. `project.json` wires Nx `build` → `tsup` in `packages/gramstax`.
- **Orchestration**: Nx (`nx.json`) defines `build`/`lint`/`test` target defaults (cache, `dependsOn: ^build`, production inputs) and a `release` config (conventional-commits versioning, git tag `v{version}`, GitHub changelog, `packages/*` projects).
- **API docs**: `api-extractor` + `api-documenter` (the root `build:docs` script, `api-extractor.json`) generate `docs-site/reference/*` (markdown) and `docs/yaml/*` from the emitted `.d.ts`. Each package stages into `packages/*/docs/{markdown,yaml}`; `scripts/mintlify/merge-reference.mjs` folds the staged pages into `docs-site/reference/`.

<Warning>
  `docs-site/reference` and `docs/yaml` are generated artifacts and must not be
  hand-edited. Change the source and regenerate with
  `bun run build:docs` from the repository root.
</Warning>

## Consequences

### Benefits

- One `bun` command surface for test/lint/build across the monorepo.
- Dual ESM/CJS + d.ts means both current and legacy bundlers can consume the library.
- Nx gives caching and proper build ordering (`^build`) and drives `nx release`.
- API reference is generated, not hand-maintained.

### Trade-offs

- `tsup` + Nx + API-Extractor is a heavier setup than a single `tsc` build.
- Generated docs (`docs-site/reference`, `docs/yaml`) are artifacts that must not be hand-edited.

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| `tsc` only | No bundling/minify, no dual CJS/ESM-with-dts ergonomics, no task graph. |
| `vitest`/`jest` | Repo explicitly bans them (`AGENTS.md`); `bun:test` is the standard. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Config | `tsup.config.ts`: `outDir: ./dist/src`, `format:["cjs","esm"]`, `dts:true`, `minify:true`, `platform:node` |
| Config | `project.json`: `"build": {"executor":"nx:run-commands","command":"tsup"}` |
| Config | `nx.json`: `targetDefaults` (build/lint/test), `release` (conventional-commits, tag `v{version}`) |
| Config | `api-extractor.json`, `tsconfig.build.docs.json`: API doc generation |
| Scripts | `package.json` (root): `build`, `build:gramstax`, `ci:test:*`, `release:*`, `dry-run` |
| CI | `.github/workflows/release.yml`: per-package test matrix → `lint:packages` + `build:packages` → `dry-run` → `release` |

## Related

- [Development](../development.md): build/test/lint commands
- [ADR-0008](/guides/adr/0008-lint-export-dep-conventions.md): lint/export rules the toolchain enforces
