---
title: Development Guide
description: Repository layout, the local development workflow, and the build, test, and lint commands needed to contribute to the gramstax monorepo.
icon: hammer
---

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
│   ├── blocks/g-keyboard.ts    BlockGKeyboard builder
│   ├── labels/g-keyboard.ts    LabelGKeyboard utilities
│   ├── cache/external.ts     CacheExternal (keyv/Redis adapter)
│   ├── helpers/log.ts         LoggingHelper (extends LoggingPretty)
│   ├── update/queue.ts      UpdateQueue (bounded concurrent queue)
│   ├── update/dispatcher.ts UpdateDispatcher (worker pool + per-chat gate)
│   ├── update/gate.ts       UpdateGate (per-chat concurrency gate)
│   ├── mock/telegram-server.ts  MockTelegramServer
│   ├── e2e/helper.ts        E2eHelper (in-process test harness)
│   ├── types/               bot.ts, ctx.ts, template.ts, config.ts, e2e.ts, …
│   └── index.ts             Public barrel (runtime exports, then `// type` separator)
├── test/                    Bun unit tests
├── docs/                    API Extractor output (extractor/) and generated yaml reference (yaml/)
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
| `src/cache/`, `src/update/` | Session/cache and update backpressure (queue, dispatcher, gate).                              |
| `src/mock/`, `src/e2e/`      | Test doubles and the in-process E2E harness.                                                   |
| `src/types/`                 | Public TypeScript type definitions.                                                            |

## Development Workflow

### Making Changes

<Steps>
  <Step title="Branch from main">
    The repo uses **conventional commits** (`feat:`, `fix:`, `chore:`,
    `refactor:`, `docs:`, `test:`, `build:`, `ci:`, `perf:`, `style:`,
    `revert:`, `asset:`): see `nx.json` `conventionalCommits` for the semver
    mapping.
  </Step>

  <Step title="Edit source and tests">
    Edit source under `src/`. Add/Adjust tests under `test/`.
  </Step>

  <Step title="Keep changes surgical">
    Stay surgical in the complexity hotspots: `core/ctx.ts`, `template/engine.ts`,
    `core/bot.ts` and `template/manager.ts`: the four largest files in the
    package, each several thousand lines and each a split candidate. Their exact
    size moves constantly, which is why the line counts in `AGENTS.md`'s
    Complexity Hotspots table are a dated snapshot. Treat the file list as the
    signal and re-measure before trusting a count.

    Per `AGENTS.md`, do not add `@ts-ignore`/`@ts-expect-error` to hide errors.
    Fix them.
  </Step>

  <Step title="Open a PR">
    Two workflows run on push to `main`: `release.yml` typechecks and tests each
    package in its own matrix job, then lints, builds, and releases; `docs.yml`
    audits the prose against the source, audits the template blocks in the code
    examples, regenerates the API reference, validates it with the Mintlify CLI
    plus an accessibility check, and commits the result. The docs workflow
    validates before it commits, so a failed run pushes nothing.
  </Step>
</Steps>

### Code Style

| Aspect     | Convention                                                                                                                                                         | Enforced By                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Formatting | 2-space indent, **no semicolons**, `arrowParens: always`, `trailingComma: none`, `printWidth: 300` (TS), `200` (JSON).                                          | `biome.json`                           |
| Linting    | Biome's recommended rules. Unused imports are errors; `no-explicit-any` is not enabled.                                                                            | `biome lint`                           |
| Imports    | ESM, `node:` prefix for builtins, `import type` for types, `~/*` alias → `src/*`, relative for same-folder. Named exports only: **no default exports**.           | `tsconfig.json` paths, `AGENTS.md`     |
| Types      | `strict: true`, `noUncheckedIndexedAccess: true`. Public boundaries get explicit types; `any` allowed but discouraged.                                             | root `tsconfig.json`                   |

<Note>
  Backtick string literals are a convention, not a rule. `biome.json` sets
  `quoteStyle: "double"` and `plugins: []`, so nothing fails on a non-backtick
  string: match the surrounding file.
</Note>

```bash
# Format + lint a package
bun run lint:packages          # root: biome lint ./packages
bun run lint:fix               # auto-fix

# Type-check everything (the CI gate)
bun run ci:check:packages      # tsc --noEmit && biome lint ./packages
```

## Testing

Tests use **`bun:test`** (no jest/vitest, per `AGENTS.md`). Test files live in `test/`.

| Type         | Location                           | Command                              |
| ------------ | ---------------------------------- | ------------------------------------ |
| Unit         | `packages/gramstax/test/*.test.ts` | `bun test ./packages/gramstax/test`  |
| Filtered     | `test/*.test.ts`                   | `bun test --filter "TemplateEngine"` |
| All packages | `packages/*`                       | `bun run test:packages`              |

```bash
# Run a single test file
bun test packages/gramstax/test/template.engine.test.ts

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
bun run build             # NX_DAEMON=false nx run-many -t build
```

`tsup.config.ts` outputs to `./dist/src` with `format: ["cjs","esm"]`, `dts: true`, `minify: true`, `platform: node`, `target: esnext`, and keeps `bun` external. `package.json` points `main`/`module`/`types` at `dist/src/index.{js,mjs,d.ts}`.

### Generating API reference docs

The API reference on this site is generated by API Extractor and API Documenter,
then normalized for MDX. Regenerate it with:

```bash
cd packages/gramstax && bun run build:docs   # dts-only build → api-extractor → api-documenter → sanitize + nav
```

It writes to `docs-site/reference/`, strips the HTML comments API Documenter uses
as autolink escape spacers, escapes prose that MDX would otherwise read as JSX,
derives each page's `title` from its own heading, and regenerates
`docs-site/config/navigation.json`.

Run it locally when you change TSDoc, to see the effect. The committed corpus is
owned by `.github/workflows/docs.yml`, which runs the same script on every push
to `main`. The sanitizer is idempotent, so a second run over the same corpus
changes nothing.

<Warning>
  `packages/gramstax/docs/yaml` and `docs-site/reference/` are **generated
  artifacts**; they are not hand-written and should not be edited directly. Both
  are regenerated from TSDoc by `docs.yml`.
</Warning>

## CI/CD

| Stage             | Trigger                                            | What It Does                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release           | `push` to `main` (`.github/workflows/release.yml`) | a `test` matrix job typechecks and tests each of the four packages; the `release` job then runs `lint:packages` + `build:packages`, decides whether a version is needed, runs `bun run dry-run`, upgrades npm for OIDC, and runs `bun run release` (Nx release, conventional-commits versioning, git tag `v{version}`, GitHub release). A manual `workflow_dispatch` with `publish_only` re-publishes the disk version without versioning. |
| Docs              | `push` to `main` (`.github/workflows/docs.yml`)   | Audits the prose against the source (`node scripts/docs/audit-docs.mjs`) and the template blocks in the code examples (`node scripts/docs/audit-templates.mjs`) before anything is generated, regenerates the API reference with `bun run build:docs`, validates it with `mintlify validate` and `mintlify broken-links --check-anchors`, checks accessibility with `mintlify a11y`, and then commits the regenerated corpus. Validation runs before the commit, so a failed run pushes nothing. |
| Revert on failure | `if: failure()`                                    | Deletes only the tag and GitHub release this run created, after proving the tag points at a commit made after the run started. It never rewrites history and never resets `main`; an already-published npm version is immutable and left for manual follow-up. |

`nx.json` defines `release.projects: ["packages/*"]`, semver bumps from conventional commits, and a GitHub changelog. Release runs `nx release publish` per package.

## Related Documentation

- [Getting Started](/guides/getting-started) - Initial setup
- [Architecture](/guides/architecture) - System design context
- [Glossary](/guides/glossary) - Terminology
- [Decisions](/guides/adr/index) - Why these conventions exist
