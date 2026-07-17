# Development Guide

> How to contribute to `gramstax`.

## Repository Structure

This package lives inside an Nx + Bun monorepo. `packages/gramstax` is the core library; `packages/create-gramstax`, `packages/lmdb`, and `packages/worker-thread` are siblings.

```text
packages/gramstax/
├── src/
│   ├── core/bot.ts          Gramstax main class (orchestration, lifecycle, routing)
│   ├── core/ctx.ts          Ctx base class (reply/edit/broadcast/session/route)
│   ├── template/engine.ts    TemplateEngine (parser, compiler, validator)
│   ├── template/manager.ts   TemplateManager (watcher, loader, compiler)
│   ├── page/manager.ts       PageManager (module loader/discovery)
│   ├── blocks/keyboard.ts    BlockKeyboard builder
│   ├── labels/keyboard.ts    LabelKeyboard utilities
│   ├── cache/external.ts     CacheExternal (keyv/Redis adapter)
│   ├── helpers/log.ts         LoggingHelper (extends LoggingPretty)
│   ├── webhook/queue.ts      WebhookQueue (bounded concurrent queue)
│   ├── mock/telegram-server.ts  MockTelegramServer
│   ├── e2e/helper.ts        E2eHelper (in-process test harness)
│   ├── types/               t.bot.ts, t.ctx.ts, t.template.ts, t.e2e.ts
│   └── index.ts             Public barrel (runtime exports, then `// type` separator)
├── test/                    Bun unit tests
├── docs/                    This superdocs set + generated API reference (markdown/, yaml/, extractor/)
├── tsup.config.ts          Build config (dual ESM/CJS + d.ts)
├── tsconfig.json            Extends ../../tsconfig.json, adds `~/*` → src/*
├── tsconfig.build.json      Build-only tsconfig (no comments in dist)
├── project.json             Nx project target (build → tsup)
└── package.json            package metadata + scripts
```

| Directory                    | Purpose                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/core/`                  | Bot lifecycle (`bot.ts`) and per-update context (`ctx.ts`).                                    |
| `src/template/`              | The `<g-*>` DSL parser/compiler/validator (`engine.ts`) and its loader/watcher (`manager.ts`). |
| `src/page/`                  | Page module discovery.                                                                         |
| `src/blocks/`, `src/labels/` | Keyboard template builders.                                                                    |
| `src/cache/`, `src/webhook/` | Session/cache and webhook backpressure.                                                        |
| `src/mock/`, `src/e2e/`      | Test doubles and the in-process E2E harness.                                                   |
| `src/types/`                 | Public TypeScript type definitions.                                                            |

## Development Workflow

### Making Changes

1. Branch from `main`. The repo uses **conventional commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `build:`, `ci:`, `perf:`, `style:`, `revert:`, `asset:`) — see `nx.json` `conventionalCommits` for the semver mapping.
2. Edit source under `src/`. Add/Adjust tests under `test/`.
3. Keep changes **surgical** in the complexity hotspots: `core/ctx.ts` (4006 lines), `template/engine.ts` (3386), `core/bot.ts` (1612), `template/manager.ts` (1012). Per `AGENTS.md`, do not add `@ts-ignore`/`@ts-expect-error` to hide errors — fix them.
4. Open a PR; the only CI gate (`.github/workflows/release.yml`, on push to `main`) runs `ci:test:packages` + `build:all` and then releases.

### Code Style

| Aspect     | Convention                                                                                                                                                         | Enforced By                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Formatting | 2-space indent, **no semicolons**, backtick strings, `arrowParens: always`, `trailingComma: none`, `printWidth: 300` (TS), `200` (JSON).                           | `.prettierrc` (run `bun run lint:fix`) |
| Linting    | `typescript-eslint` recommended + custom: `quotes: backtick` (warn), `no-explicit-any: off`, `no-unused-vars: error` (ignore `_*`), `object-curly-spacing: never`. | `eslint.config.ts`                     |
| Imports    | ESM, `node:` prefix for builtins, `import type` for types, `~/*` alias → `src/*`, relative for same-folder. Named exports only — **no default exports**.           | `tsconfig.json` paths, `AGENTS.md`     |
| Types      | `strict: true`, `noUncheckedIndexedAccess: true`. Public boundaries get explicit types; `any` allowed but discouraged.                                             | root `tsconfig.json`                   |

```bash
# Format + lint a package
bun run lint:packages          # root: eslint ./packages
bun run lint:fix             # auto-fix

# Type-check everything (the CI gate)
bun run ci:check:packages   # tsc --noEmit && bun run lint:packages
```

## Testing

Tests use **`bun:test`** (no jest/vitest — per `AGENTS.md`). Test files live in `test/`.

| Type         | Location                           | Command                              |
| ------------ | ---------------------------------- | ------------------------------------ |
| Unit         | `packages/gramstax/test/*.test.ts` | `bun test ./packages/gramstax/test`  |
| Filtered     | `test/*.test.ts`                   | `bun test --filter "TemplateEngine"` |
| All packages | `packages/*`                       | `bun run test:packages`              |

```bash
# Run a single test file
bun test packages/gramstax/test/templateengine.test.ts

# Run the whole package suite
bun test ./packages/gramstax/test

# Filter by suite name (e.g. TemplateManager)
bun test --filter "TemplateManager"
```

The in-process E2E harness (`E2eHelper`, active with `deploy:"test"`) lets tests assert on captured Bot API calls (`e2e.calls`, `e2e.lastCall("sendMessage")`, `e2e.extractText`, `e2e.extractButtonLabels`) without any HTTP server.

## Building

```bash
# Build just this package (tsup → dist/src/{index.js,index.mjs,index.d.ts})
bun run build:gramstax        # nx build gramstax

# Build all packages
bun run build:all             # nx run-many -t build --parallel=1
```

`tsup.config.ts` outputs to `./dist/src` with `format: ["cjs","esm"]`, `dts: true`, `minify: true`, `platform: node`, `target: esnext`, and keeps `bun` external. `package.json` points `main`/`module`/`types` at `dist/src/index.{js,mjs,d.ts}`.

### Generating API reference docs

The repo also ships API-Extractor-generated reference docs (the `docs/markdown/*` and `docs/yaml/*` files). Regenerate them with:

```bash
bun run build:docs   # tsup dts-only → api-extractor → api-documenter (markdown + yaml)
```

> The `docs/markdown` and `docs/yaml` directories are **generated artifacts**; they are not hand-written and should not be edited directly. The narrative docs in this `docs/` set (`overview.md`, `architecture.md`, etc.) are the maintained source.

## CI/CD

| Stage             | Trigger                                            | What It Does                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release           | `push` to `main` (`.github/workflows/release.yml`) | checkout → setup Node (LTS) + Bun → `bun install` → `bun run ci:test:packages && bun run build:all` → `bun run dry-run` → `bun run release` (Nx release, conventional-commits versioning, git tag `v{version}`, GitHub release). |
| Revert on failure | `if: failure()`                                    | If the npm publish succeeded but a later step failed, it **skips** rollback (avoids an orphaned npm package); otherwise it deletes the GitHub release + tag and force-resets `main` to the prior commit.                         |

`nx.json` defines `release.projects: ["packages/*"]`, semver bumps from conventional commits, and a GitHub changelog. Release runs `nx release publish` per package.

## Related Documentation

- [Getting Started](getting-started.md) - Initial setup
- [Architecture](architecture.md) - System design context
- [Glossary](glossary.md) - Terminology
- [Decisions](adr/README.md) - Why these conventions exist
