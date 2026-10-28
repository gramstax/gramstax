# AGENTS

## Purpose

- Provide commands and style guidance for agents working in this repo.
- Monorepo note: core library code lives in `packages/gramstax`.
- Assume a Bun + TypeScript + Nx monorepo workflow.
- Run commands from repository root unless noted.
- Keep changes focused and consistent with existing patterns.

## Repository Layout

- `packages/gramstax`: core library package (tsup build).
- `packages/create-gramstax`: CLI scaffolding tool (tsup build).
- `packages/lmdb`: LMDB-backed database with schema-declared repositories (separate npm package `@gramstax/lmdb`).
- `packages/worker-thread`: worker thread lifecycle + RPC + Unix-socket gateway (separate npm package `@gramstax/worker-thread`).
- `packages/*/src`: TypeScript sources.
- `packages/*/test`: Bun unit tests (currently only in `gramstax`, `lmdb`, `worker-thread`).
- `packages/create-gramstax/src/templates`: template project files for the CLI.
- `example/`: sample projects (1-complex through 10-http-request, ordinally named).
- `skills/`: repository-level agent skills (`gramstax-best-practices`, `lmdb-best-practices`, `worker-thread-best-practices` rule routers, plus `gramstax-superplan` for apps built on Gramstax and `gramstax-repo-superplan` for this framework repo; each a router + `references/`).
- `docs/`: documentation and API reference.
- `docs/AGENTS.md`: API reference; not repo-wide agent guidance.
- `real-projects/`: standalone (non-workspace) sample apps — currently `production-vip-content-bot` (own `bun.lock`).
- `plans/`: numbered implementation plans (`plans/NNN-feature-slug/plan.md`, gitignored; see `skills/gramstax-repo-superplan` for framework work and `skills/gramstax-superplan` for app work).
- `prompts/`: AI agent prompt templates (`PROMPT.md`, `PROMPT_WITH_VALUE.md`) — consume the gramstax skill router.
- `scripts/`: root e2e-mirror tooling (`generate-e2e-structure.ts`, `check-e2e-mirror.ts`); mirrored into create-gramstax templates.
- `biome.json`, `tsconfig.json`, `nx.json`: global tooling config.
- `bunfig.toml`: Bun runtime config.
- `packages/gramstax/security-poc/`: standalone numbered security PoC scripts (template-engine breakout/injection/RCE).
- `skill/`: legacy custom tooling scripts (some deprecated).

## AGENTS.md Hierarchy

Deep per-area guidance lives in child files — read the one matching your task in addition to this root:

- `packages/gramstax/AGENTS.md`, `packages/lmdb/AGENTS.md`, `packages/worker-thread/AGENTS.md`, `packages/create-gramstax/AGENTS.md` — package internals, patterns, build/test commands, anti-patterns.
- `example/AGENTS.md` — sample projects: didactic progression, shared `src/` skeleton, e2e harness, build-before-run rule.
- `skills/gramstax-best-practices/SKILL.md` — rule sets governing generated Gramstax projects (pages, e2e, deploy, guards, cache).
- `skills/gramstax-superplan/SKILL.md` — portable plan lifecycle for apps that consume the Gramstax ecosystem, including greenfield `create-gramstax` scaffolds; routes to the best-practice skills; copy it into the app's `skills/` directory.
- `skills/gramstax-repo-superplan/SKILL.md` — plan lifecycle for the Gramstax framework monorepo: packages, docs-site, generated docs, and repo commands.
- `real-projects/AGENTS.md` — standalone, non-workspace sample apps.
- `docs/AGENTS.md` — API reference (production params, endpoints, lifecycle).

## Toolchain

- Package manager/runtime: `bun` (see `bun.lock`).
- Build orchestrator: `nx`.
- Bundler: `tsup` (invoked via `nx build` targets).
- Tests: `bun:test`.
- Linting + Formatting: **Biome** (see `biome.json`). Backticks are a convention only — `biome.json` sets `plugins: []`, and nothing enforces string style.
- Type checking: `tsc --noEmit` via `bun run ci:check`.

## Install

- `bun install`

## Build Commands

- `bun run build`
- `bun run build:gramstax`
- `bun run build:create-gramstax`
- `nx build gramstax`
- `nx build create-gramstax`
- `nx build worker-thread`

## Lint & Format Commands

- `bun run lint` (`biome lint`)
- `bun run lint:fix` (`biome lint --write --unsafe`)
- `bun run lint:packages` (lint only `./packages`)
- `bun run lint:example` (lint only `./example`)
- `bun run format` (`biome format --write ./example ./packages` — note the scoping; the repo root and `real-projects/` are not covered)
- `bun run format:packages` (format only `./packages`)

There is no backtick/quote lint script. `lint:quotes` and the `biome-backtick.grit` GritQL plugin are referenced in older docs but were never added — `biome lint` is the only style gate.

## Typecheck + Lint Commands (ci:check)

- `bun run ci:check` (tsc for the repo root plus `gramstax`, `create-gramstax`, `lmdb`, `worker-thread`, then `biome lint`)
- `bun run ci:check:packages` (tsc for `./packages` + `biome lint ./packages`)
- `bun run ci:check:example` (`biome lint ./example`)

None of these run a format check or a backtick check — `biome lint` only.

## Test Commands

- `bun run test`
- `bun run test:packages` (test only `./packages`)
- `bun run test:example` (test only `./example`)
- `bun test packages/gramstax/test/<file>.ts` (single test file)
- `bun test --filter "TemplateEngine"` (single test by name)
- `bun test packages/gramstax/test/core.bot.test.ts`
- `bun test packages/gramstax/test/template.engine.test.ts`
- `bun test --filter "TemplateManager"`
- `bun test --watch` (optional local dev)

## CI / Pre-push

- `bun run ci:test` (typecheck + lint + all tests)
- `bun run ci:test:packages` (typecheck + lint + tests for `./packages`)
- `bun run ci:test:example` (lint + tests for `./example`)
- `bun run prepush` (ci + build + safety echo)

## Release Commands (when asked)

- `bun run release`
- `bun run release:patch`
- `bun run release:minor`
- `bun run release:major`
- `bun run dry-run`
- `bun run publish:all`

## Formatting & Linting Rules

- **Formatter**: Biome (see `biome.json`).
- 2-space indentation; `useTabs: false`.
- No semicolons (`semicolons: asNeeded`).
- `lineWidth`: 300 for TS/JS, 200 for JSON.
- `trailingComma: none`.
- `bracketSameLine: false`.
- `bracketSpacing: false` (no spaces inside `{}`).
- `arrowParens: always`.
- Prefer backticks for all strings — **convention, not enforced**. `biome.json` sets `quoteStyle: "double"` and `plugins: []`, so no rule fails on a non-backtick string. Match the surrounding file.

## Lint Rules (highlights)

- Follow biome.json

## Imports

- Use ESM `import`/`export` (repo is `type: module`).
- Use `node:` prefixes for built-in modules (`node:fs`, `node:path`).
- Use `import type` for type-only imports.
- `~/*` path alias is available inside packages for `src` imports.
- Prefer relative imports for same-folder modules.
- Group imports by source (builtins, third-party, internal).
- Keep ordering consistent within each file.
- Remove unused imports; lint treats unused vars as errors.
- Prefer named exports over default exports unless a file already uses default.

## Types and TS Practices

- `strict: true` and `noUncheckedIndexedAccess: true` are enforced.
- Prefer explicit types at public boundaries (exports, callbacks, params).
- Add return types for exported functions when clarity helps.
- `any` is allowed but discouraged; use `unknown` or precise types.
- Use `type` aliases for unions and helper types; interfaces for public shapes.
- Keep generics focused and avoid overly broad constraints.
- Use `as` casts only when necessary; keep the cast narrow.
- Use `const` for values that do not change.
- Prefer `async`/`await` over raw promise chains.

## Naming Conventions

- Files and folders: lowercase or kebab-case (e.g., `worker-thread`).
- Classes, types, interfaces: PascalCase.
- Functions, variables, params: camelCase.
- Constants: `UPPER_SNAKE_CASE` or `__PKG_VERSION__` style for module-level constants.
- Keep public API names descriptive and concise.

## Error Handling and Logging

- Validate inputs early and throw `Error` with clear messages.
- Wrap IO/network work in `try/catch`.
- Prefer `log` or `LoggingPretty` for user-visible errors.
- Use `String(error)` when logging unknown error types.
- Avoid swallowing errors; return `null`/`undefined` only when expected.
- Favor early returns to keep control flow clear.

## Runtime and Build Notes

- Target runtime is `esnext` with bundler module resolution.
- Packages build into `packages/*/dist/src`.
- `bun` is required for tests, app boot, the CLI, and Bun-API paths (e.g., the webhook server via `Bun.serve`).
- Keep `node:` builtin imports where code is shared with `@gramstax/lmdb` / `@gramstax/worker-thread`; those standalone packages have their own runtime support, while the `gramstax` app runtime is Bun-only.

## Application Boot (v2.2.0)

Applications are **config-driven**. There is no `src/index.ts` and no hand-written `new Gramstax({...})` entry.

- Every project has a `gramstax.config.ts` at its root: default export, annotated `: GramstaxConfig` (a thin alias of `IGramstaxConfig`, all fields optional). This is the single composition point for token, deploy mode, caches, and runtime tuning.
- `gramstax start [--deploy <mode>] [--watch]` loads it, discovers the `Gramstax` subclass at `src/core/bot.ts`, materializes each ref slot (`instanceof`-checked), then constructs it — construction *is* boot, no `.run()`. Run it as `gramstax start`; the published bin has a Bun shebang and loads project-root `.env*` files automatically. Bun resolves the TS paths and the `~` alias.
- `gramstax build` freezes `src/pages` into `.gramstax/` (`routes.json`, `manifest.js`, AOT `gen/`, `server/` per target). Only `serverless` auto-loads it; other deploys run from the filesystem.
- `deploy` selects the mode; `optionsDeploy` holds per-mode settings in **nested branches** — at most one non-empty branch, and it must equal `deploy`. `webhook` requires `url` + `secretToken`; `serverless` is keyed by adapter (`cloudflare-mod` | `aws-lambda-async`) and requires `url` + `secretToken`. The legacy `webhook:<url>` colon grammar throws.
- Config files hold **refs and plain data, not instances**: `cacheSession: {store, ttlMs?, namespace?}`, `log: {override: {module, export?, args?}}`. A bare `{module}` ref without the `override` wrapper is rejected. `manifest` is a constructor param, not a config field.
- E2E is the one exception — `e2e/setup.ts` constructs `BotCore` directly to inject `deploy: "test"`, `token: "test"`, `stream`, `autoRetry`, `log: false`.
- `GramstaxConfig` (config file) ≠ `IGramstaxParams` (constructor). Only the latter carries instances and `manifest`.
- Full detail: `docs-site/guides/gramstax-start.md`, `docs-site/guides/gramstax-build.md`, `docs-site/guides/serverless-deploy.md`, `docs-site/guides/aot-contract.md`.

## Testing Conventions

- Tests use `bun:test` (`describe`, `it`, `expect`).
- Keep tests under `packages/gramstax/test`.
- Use backticks in test strings to satisfy lint.
- Prefer deterministic inputs; avoid timers unless required.

## Template Guidelines

- When multiple `<g-base>` blocks share identical `<g-keyboard>` content, define it once in the default `<g-base>` (no `id`) and omit duplicates in other bases.
- Reuse the default keyboard by calling the inline/bottom keyboard builder without a `AGBaseId`.

## Template Filter Pipes

The `{{}}` scope supports post-processing pipes compiled at compile-time into chained calls (zero per-render parsing; unknown filters render empty + one-time `console.warn` — whitelist only, no arbitrary code execution):

- `{{name|upper}}`, `{{name|lower}}`
- `{{price|number:2}}` — decimal places (default 0)
- `{{createdAt|date:YYYY-MM-DD}}` — UTC tokens `YYYY MM DD HH mm ss`
- `{{count|plural:item:items}}` — `1` → first arg, else second
- `{{name|upper|default:N/A}}` — chained left-to-right; `default` applies when the value is undefined/null/empty
- Works with dotted paths (`{{user.name|upper}}`) and the raw scope (`{{{var|filter}}}`, no HTML escaping); escaping still applies after filters in `{{}}`.

## Runtime Features (Tier 2)

- **Rate limiting (in)** — `rateLimit: {windowMs, max}` param mounts `@grammyjs/ratelimiter` (`timeFrame` in ms). Behavior via class hooks: `hookRateLimited(ctx)` (default: update silently dropped; receives a fully constructed page context — the `render*` helpers are available, but the context is not bound to a page, so a template-backed render has no template behind it) and `hookKeyGenerator(ctx)` (default: sender user id; must be synchronous).
- **Outgoing throttling (out)** — `throttle: {global?, group?, out?}` param mounts `@grammyjs/transformer-throttler` (`apiThrottler`, Bottleneck buckets) via `api.config.use`, composing with `autoRetry`.
- **File download** — `@grammyjs/files` (`hydrateFiles`) mounted by default; `ctx.download(path?)` saves the current message's file (temp path when omitted).

## Runtime Features (Tier 3)

- **Prometheus metrics** — `GET /metrics` on the status/webhook server returns Prometheus exposition text (per-listener counters, cumulative totals, latency avg/max, uptime, optional queue stats). Optional `hookTrace(span)` override fires an OTel-style span after every routed update.
- **Distributed session lock (Redis-only)** — `sessionLock` param (default off) acquires an atomic `SET NX PX` lease on the session key via the `@keyv/redis` store's underlying client. The lock is held for the entire update dispatch (handler-level, not per cache op) — actually serializes concurrent updates for the same user across instances. Memory store → auto-disabled with warning. Contention modes: `skip` (drop, counted in `metrics.blocked`), `wait` (retry), `serialize` (queue per key).

## Telegram Rich HTML

Templates support 54 HTML/tg-\* tags passed through to the message `html` field, in 5 categories:

- _Inline (15):_ `a`, `b`, `code`, `del`, `em`, `i`, `ins`, `mark`, `s`, `strike`, `strong`, `sub`, `sup`, `tg-spoiler`, `u`
- _Block/structural (24):_ `aside`, `blockquote`, `blockquote expandable`, `br`, `caption`, `details`, `footer`, `h1`-`h6`, `hr`, `li`, `ol`, `p`, `pre`, `summary`, `table`, `td`, `th`, `tr`, `ul`
- _Telegram-specific (8):_ `tg-collage`, `tg-emoji`, `tg-map`, `tg-math`, `tg-math-block`, `tg-reference`, `tg-slideshow`, `tg-time`
- _Media (6):_ `audio`, `cite`, `figcaption`, `figure`, `img`, `video`
- _Forms (1):_ `input`

**Format rules:**

- Void elements must be self-closing: `<hr/>`, `<img/>`, `<input/>`, `<br/>`, `<tg-map/>`. Content tags are not format-checked (both `<b>x</b>` and `<b/>` accepted).
- Enforced by `validateFormatBlock` in the same way as `<g-space/>` and `<g-import/>`.

**Attribute validation** (three layers, all wired into `validateTemplate` as steps 5–7):

- **Required attributes** — `TemplateEngine._TELEGRAM_REQUIRED_ATTRS` + `validateTelegramAttributesBlock`: e.g. `<a>` needs `href` or `name`; `<img>`/`<video>`/`<audio>` need `src`; `<tg-emoji>` needs `emoji-id`; `<tg-time>` needs `unix` (`format` is optional); `<tg-map>` needs `lat` + `long` + `zoom`; `<tg-reference>` needs `name`; `<input>` needs `type`.
- **Value formats** — `TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS` + `validateTelegramAttributeValuesBlock`: e.g. `<tg-time unix>` must be a positive integer, `<tg-time format>` must match `r|w?[dD]?[tT]?`; `<tg-map lat>` ∈ [-90, 90], `<tg-map long>` ∈ [-180, 180], `<tg-map zoom>` ∈ [13, 20]; `<tg-emoji emoji-id>` must be numeric; media `src` (`img`/`video`/`audio`) must be `http(s)://` or a `tg://emoji|photo|video|audio|document?id=` reference; `<a href>` must use `http(s)://`, `mailto:`, `tel:`, `tg://user?id=`, or `#` scheme; `<input type>` must be `checkbox` (the only Telegram-supported input); block attrs: `<ol start/type>` (int / `1|a|A|i|I`), `<li value/type>` (int / `1|a|A|i|I|checkbox`), `<td colspan/rowspan/align/valign>`, `<th colspan/rowspan/align/valign>`, `<blockquote cite>`/`<aside cite>` (http(s)), `<code class>` (`language-*`). Boolean attrs (`reversed`, `bordered`, `striped`, `is_compact`, `expandable`, `open`, `checked`, `tg-spoiler`) are presence-validated via `() => null` entries.
- **Unknown attributes** — `TemplateEngine._TELEGRAM_ALLOWED_ATTRS` (per-tag allowlist, 54 tags) + `validateTelegramUnknownAttributesBlock`: any attribute name outside the tag's allowlist is rejected (`<table ngasal="x">` → error listing allowed attrs). Tags with an empty allowlist (`b`, `i`, `br`, …) reject every attribute; `{{placeholder}}` is valid as a VALUE but rejected as an attribute NAME.

Validation follows the Telegram Bot API 10.3 Rich Message Formatting Options spec (`TemplateEngine.BOT_API_VERSION` = `10.3`). `{{placeholder}}` attribute values skip value validation. Coverage is locked by `packages/gramstax/test/telegram-rich-coverage.test.ts` (guard iterating all 54 tags — fails when any tag lacks a validator or registry entry) and `packages/gramstax/test/telegram-rich-matrix.test.ts` (exhaustive tag × attribute valid/invalid matrix, plus per-tag unknown-attribute rejection). Text passthrough patterns (`#hashtag`, `$USD`, `+phone`, `card:`, `https://`, `t.me`, `a@t.me`, `/command`, `@username`) need no markup and are not in the tag list.

## PAGE Attribute Validation

`<g-*>` PAGE blocks follow the same two-layer validation pattern as Telegram Rich HTML, mirrored through the centralized specs `TemplateEngine._PAGE_REQUIRED_ATTRS` and `TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS`. Both layers are wired into `validateTemplate` as steps 32 and 33 (the per-block `validateBlockG*Attributes` methods at steps 8–31 stay for granular access and also delegate to the same value spec).

- **`_PAGE_REQUIRED_ATTRS`** — currently empty. PAGE block attributes are mostly optional; this spec is reserved for future context-dependent requirements.
- **`_PAGE_ATTR_VALUE_VALIDATORS`** — centralizes format checks for:
  - `<g-base id>` — must not be empty
  - `<g-keyboard type>` — must be `inline` or `bottom`
  - `<g-media type>` — must be one of: photo, video, audio, document, animation, voice, video_note, sticker, location, contact
  - `<g-media shared>` — must be `true` or `false`

Boolean attributes (without `=value`, e.g. `<g-media type="photo" src="x" shared>`) are intentionally skipped — they do not trigger the empty-string check. Per-block `validateBlockG*Attributes` methods have been refactored to read from `_PAGE_ATTR_VALUE_VALIDATORS`, so there is a single source of truth for value formats.

To add a new PAGE value validator: extend `_PAGE_ATTR_VALUE_VALIDATORS[tagName]` and the corresponding per-block method picks it up automatically. To add a new required-attr rule: extend `_PAGE_REQUIRED_ATTRS` and `validatePageAttributesBlock` will start enforcing it.

## Package: gramstax

- Source root is `packages/gramstax/src`; update `packages/gramstax/src/index.ts` when adding exports.
- Path alias `~/*` maps to `packages/gramstax/src/*` (from `packages/gramstax/tsconfig.json`).
- Build with `nx build gramstax` (tsup config in `packages/gramstax/tsup.config.ts`).
- Output artifacts live in `packages/gramstax/dist/src`.
- Run a single test with `bun test packages/gramstax/test/<file>.ts` or filter via `bun test --filter "Name"`.

## Package: lmdb

- Published as `@gramstax/lmdb`.
- Source root is `packages/lmdb/src`; flat module structure (env, sub-manager, sub, schema, transaction, errors, types, replica).
- Core pattern: extend `LmdbEnv` for the root DB class; declare each sub-DB as an `LmdbSchema` subclass (`static db`/`static key`/`static value`) and `env.register(SchemaClass)` materializes a typed `LmdbEnvSub` handle.
- Build with `nx build` (tsup).

## Package: worker-thread

- Published as `@gramstax/worker-thread`.
- Source root is `packages/worker-thread/src`; flat module structure (launch, init, pool, rpc, gateway-\*, export).
- Core pattern: `WorkerThreadInit` subclass in the worker, `WorkerThreadLaunch` on the main thread, optional Unix-socket gateway for inter-worker comms.
- Build with `nx build` (tsup).

## Template Project (create-gramstax)

- `packages/create-gramstax/src/templates` holds files copied into generated projects.
- Template directory has its own standalone `tsconfig.json` + `biome.json` (`root: true`). Biome-only — no ESLint/Prettier configs are shipped.
- When editing templates, keep formatting consistent with template rules.
- Updates to templates should be mirrored in CLI behavior if needed.

## Generated Artifacts

- Build output lives in `packages/*/dist`.
- Do not edit files in `dist`; update source and rebuild instead.
- Avoid committing generated build output unless explicitly required.
- Note: `tsconfig.tsbuildinfo` and API-extractor temp outputs in `docs/extractor/temp/` are committed despite being build artifacts.

## Non-Standard Layout

The repo has a broader scope than a typical 2-package Bun/Nx monorepo:

- **Extra top-level dirs**: `skill/` (tooling, some deprecated), `.omo/` (tool metadata), `plans/` (numbered implementation plans), `prompts/` (agent prompt templates), `scripts/` (e2e-mirror tooling), `z-experiment/` (empty scratch), `real-projects/` (standalone apps, not workspace members).
- **Extra packages**: `lmdb/` and `worker-thread/` are independently published npm packages.
- **Example workspaces**: `example/1-complex` through `example/10-http-request` are ordinally named and included in the root workspace.
- **Checked-in artifacts**: `tsconfig.tsbuildinfo`, API-extractor temp output, and generated docs/yaml/markdown trees are versioned.

## Complexity Hotspots

Line counts are `wc -l` (2026-10-19), a dated snapshot rather than an invariant.

- `packages/gramstax/src/core/ctx.ts` — 10384 lines (multipurpose context/reply/edit/broadcast/session/route).
- `packages/gramstax/src/template/engine.ts` — 6710 lines (parser/compiler/validator).
- `packages/gramstax/src/core/bot.ts` — 3435 lines (orchestration/routing/lifecycle).
- `packages/gramstax/src/template/manager.ts` — 1518 lines (watcher/loader/compiler).
- These files are prime refactor candidates; make surgical changes only.

## CI Notes

- Two workflows, both on push to `main`: `.github/workflows/release.yml` and `.github/workflows/docs.yml`.
- Release job runs `ci:test:packages` + `build`, then `nx release`.
- Failure handler is unusual: checks npm for existing version, may delete tag/release and force-push.
- Root `prepush` script does `ci:test` + `build` + a manual safety echo.
- **The API reference is generated in CI, never by hand.** `docs.yml` runs the root `build:docs`, then `mintlify validate` + `mintlify broken-links --check-anchors`, then commits `docs-site/` with `[skip ci]`. Validation runs *before* the commit, so a failed generation produces no commit and Git sync has nothing to deploy.
- Mintlify has no deploy command — deployment is Git sync only, so the generated corpus must stay committed in `docs-site/reference/`. `docs.yml` owns that directory; do not hand-edit or hand-commit it.
- `build:docs` lives at the repo root and covers all three published packages: each package's own `build:docs` only stages into `packages/*/docs/{markdown,yaml}`, then `scripts/mintlify/merge-reference.mjs` folds the staged pages into `docs-site/reference/` and `scripts/mintlify/build-site.mjs` sanitizes the corpus for MDX and regenerates `docs-site/config/navigation.json`. Run it locally only to preview your own TSDoc changes.

## Anti-Patterns (THIS PROJECT)

- **No `@ts-ignore` / `@ts-expect-error`** in source code you must be fix it!.
- **No `.editorconfig`** — formatting is Prettier-only.
- **No `vitest`/`jest`** — use `bun:test` exclusively.
- **No `Makefile`** or `Dockerfile`.
- **Type suppression in tests** is common (`as any`, `as unknown as`); acceptable in test files.
- **`deploy: "raw"`** is the official way to run a bare grammY bot (no pages, no templates, no Gramstax routing). The legacy `templateManager: {} as any` exception was removed — use `deploy: "raw"` instead.

### Superplan

- **Framework repo:** use `skills/gramstax-repo-superplan/SKILL.md` for plan creation, revision, review, resume, reconciliation, and superbuild handoff across `packages/*`, `example/*`, and `docs-site`.
- **Apps built on Gramstax:** use `skills/gramstax-superplan/SKILL.md`; copy that directory into the app's `skills/` directory and plan app-owned files only. It supports greenfield `create-gramstax` scaffolds and routes page/template/config work to `gramstax-best-practices`, LMDB work to `lmdb-best-practices`, and worker work to `worker-thread-best-practices`.

## Cursor/Copilot Rules

- No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` found.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues (github.com/gramstax/gramstax) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: root `CONTEXT-MAP.md` → per-context `CONTEXT.md` (gramstax, lmdb, worker-thread, create-gramstax); ADRs in `docs-site/guides/adr/`. See `docs/agents/domain.md`.
