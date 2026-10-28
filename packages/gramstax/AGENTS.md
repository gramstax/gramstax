# GRAMSTAX — Core Library

Declarative Telegram bot framework with template-driven page routing, session management, inline keyboards, caching, and mock server for testing.

## Source Layout

```
packages/gramstax/src/
├── core/bot.ts         Gramstax main class (orchestration, lifecycle, routing)
├── core/ctx.ts         Ctx base class (reply/edit/broadcast/session/route)
├── template/engine.ts  TemplateEngine (parser, compiler, validator)
├── template/manager.ts TemplateManager (watcher, loader, compiler)
├── page/manager.ts     PageManager (module loader/discovery)
├── blocks/g-keyboard.ts  BlockGKeyboard builder
├── labels/g-keyboard.ts  LabelGKeyboard utilities
├── cache/external.ts   CacheExternal (Keyv/Redis adapter)
├── helpers/log.ts      LoggingHelper (extends LoggingPretty)
├── update/queue.ts     UpdateQueue (bounded concurrent queue; `WebhookQueue` deprecated alias)
├── update/dispatcher.ts UpdateDispatcher (worker pool + per-chat gate)
├── update/gate.ts      UpdateGate (per-chat concurrency gate)
├── update/gate-key.ts  per-chat concurrency key derivation
├── mock/telegram-server.ts MockTelegramServer
├── e2e/helper.ts        E2eHelper (in-process test harness)
├── cli/                 `gramstax` bin: config loader + start/build + serverless targets
├── types/              bot.ts, ctx.ts, template.ts, e2e.ts, config.ts, cli.ts, manifest.ts, mock.ts, cache.ts, session-lock.ts, metrics.ts
└── index.ts            Public barrel (runtime exports, then types with `// type` separator)
```

```
security-poc/           Standalone numbered TemplateEngine PoCs (breakout/injection/RCE) — run via `bun run packages/gramstax/security-poc/<file>.ts`, excluded from lint/format/publish, covered by package tsc
```

## Where to Look

| Task                                         | File                                       |
| -------------------------------------------- | ------------------------------------------ |
| Bot lifecycle, routing, plugin registration  | `core/bot.ts`                              |
| Page/context handler base class              | `core/ctx.ts`                              |
| Template syntax, parsing, validation         | `template/engine.ts`                       |
| Template file watching, loading, compilation | `template/manager.ts`                      |
| Page module auto-discovery                   | `page/manager.ts`                          |
| Keyboard block/label builders                | `blocks/g-keyboard.ts`, `labels/g-keyboard.ts` |
| Session/keyboard caching (Keyv/Redis)        | `cache/external.ts`                        |
| Update queuing (both modes)               | `update/queue.ts`, `update/dispatcher.ts`   |
| Mock Telegram API for tests                  | `mock/telegram-server.ts`                  |
| E2E test helpers                             | `e2e/helper.ts`                            |
| Public TypeScript types                      | `types/*.ts` (11 files)                        |

## Exports

Barrel (`src/index.ts`) re-exports all public symbols. No default exports. Add new public exports here.

## Key Classes

- **Gramstax** (`core/bot.ts`) — main app class wrapping grammy `Bot`. Composes `TemplateManager`, `CacheExternal`, `UpdateQueue`, `PageManager`.
- **Ctx** (`core/ctx.ts`) — base class for page handlers. Handles reply, edit, broadcast, session, routing.
- **TemplateEngine** (`template/engine.ts`) — template parser/compiler/validator for Telegram Rich HTML + PAGE blocks.
- **TemplateManager** (`template/manager.ts`) — template file watcher, loader, compiler integration.
- **PageManager** (`page/manager.ts`) — auto-discovers page modules; loads first named export (no default exports).
- **GramstaxConfig** — the config-file type (`src/types/config.ts`), a thin alias of `IGramstaxConfig`. Every field optional. This is what `gramstax.config.ts` is annotated with, and it holds **refs/plain data**, not instances (`cacheSession: {store, ttlMs?, namespace?}`, `log: {override: {module, export?, args?}}`).
- **IGramstaxParams** — the **constructor** input to `new Gramstax(params)`. Carries *instances* (`CacheExternal`, `TemplateManager`, `LoggingHelper`) plus `manifest?: IAppManifest`, which is **not** a config field (putting it in `gramstax.config.ts` throws `unknown field`). `token` and `deploy` are required here, optional on the config type.

## Boot (v2.2.0)

Config-driven. There is no `src/index.ts` and no hand-written `new Gramstax({...})` entry.

- `gramstax start [--deploy <mode>] [--watch]` reads `gramstax.config.ts` from the project root (default export, annotated `: GramstaxConfig`), discovers the `Gramstax` subclass at `src/core/bot.ts`, materializes each ref slot, then constructs it — construction *is* boot, no `.run()`. Bun is required, but the published bin has a Bun shebang; no `bun --bun` prefix is needed. The CLI loads project-root `.env*` files automatically.
- `gramstax build [--target cloudflare-mod|aws-lambda-async] [--bundle] [--dry-run] [--raw]` freezes `src/pages` into `.gramstax/` (`routes.json`, `manifest.js`, AOT `gen/`, plus `server/` entries per target). AOT always runs — no `--aot` flag.
- `deploy` selects the mode; `optionsDeploy` carries per-mode settings in **nested branches** with at most one branch non-empty, and that branch must equal `deploy`. `webhook` requires `url` + `secretToken`; `serverless` is keyed by adapter and requires `url` + `secretToken`. The legacy `webhook:<url>` / `serverless:<adapter>` colon grammar throws.
- Only `serverless` auto-loads `.gramstax/`; `polling`/`webhook`/`test` boot from the filesystem.
- `optionsDeploy.polling.queue` and `optionsDeploy.webhook.queue` configure the **same** class, `UpdateQueue` (`src/update/queue.ts`), each mode keeping its own instance. The queue is **opt-in** (`enabled` defaults to `false`): with it absent, `deploy: "polling"` drains sequentially exactly as it did before the queue existed. Turning it on is neutral funder saturation: see `bench/bench.ts`. At a 600 users/s target the sequential drain fell to 377 users/s at p95 1828 ms, while the queue sustained 601 users/s at p95 124 ms. `WebhookQueue` / `IWebhookQueueConfig` remain as deprecated aliases in the barrel — never delete them. Live state: `getWebhookQueueStats()` / `getPollingQueueStats()`, both `null` while their queue is disabled.
- e2e is the one exception to config-driven boot — `e2e/setup.ts` constructs `BotCore` directly to inject `deploy: "test"`, `token: "test"`, `stream`, `autoRetry`, `log: false`.

Docs: `docs-site/guides/gramstax-start.md`, `docs-site/guides/gramstax-build.md`, `docs-site/guides/serverless-deploy.md`, `docs-site/guides/aot-contract.md`. Agent skill: `skills/gramstax-best-practices/`. App superplan: `skills/gramstax-superplan/`. Framework superplan: `skills/gramstax-repo-superplan/`.

## Patterns

- Template-driven bot with filesystem page discovery.
- Convention-based routing: `handle*`, `handleSession*`, `handleFree*`, intent/callback naming.
- Template pipeline is regex/parser-based with `new Function()` compilation.
- Supports hot-reload for template files via chokidar.
- Test mode via `deploy: "test"` + `MockTelegramServer`.
- Raw mode: pass `deploy: "raw"` to get a bare grammY `Bot` (no pages, no templates, no Gramstax routing, no auto-start). Write raw grammY handlers on `bot.bot` and start it yourself. The legacy `templateManager: {} as any` exception was removed — using it in a non-raw mode now throws.
- Manifest boot (fs-less): pass `manifest: IAppManifest` to skip directory scanning — same routing tables via `_pageLoadsFromManifest`. Generate with `bun run build:manifest -- <pagesDir> <outFile>` (static imports + embedded `.html`; class-inline templates ride the classes). Regenerate after every pages/templates change. Limits: no watcher, no LMDB/timers, external sessions on isolates. See `example/11-cloudflare-worker/`.

## Complexity Hotspots

Line counts are `wc -l` (2026-10-19) — a stale table here is how a 181-line
`_runWebhook` survives review.

| File                  | Lines | Risk                                                              |
| --------------------- | ----- | ----------------------------------------------------------------- |
| `core/ctx.ts`         | 10384 | Multipurpose — split candidates: reply, broadcast, session, route |
| `template/engine.ts`  | 6710  | Parser + compiler + validator in one file                         |
| `core/bot.ts`         | 3435  | Lifecycle + routing + webhook/polling + plugins                   |
| `template/manager.ts` | 1518  | Watcher + loader + compiler glue                                  |

Make surgical changes only in these files.

## Build & Test

```
nx build gramstax          # tsup → dist/src/{index.js,index.mjs,index.d.ts}
bun test packages/gramstax/test/
bun test --filter "TemplateEngine"
```

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues (github.com/gramstax/gramstax) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Context docs: `CONTEXT.md` + ADRs in `docs-site/guides/adr/`; map + consumer rules in root `CONTEXT-MAP.md` / `docs/agents/domain.md`.

### Superplan

- **Framework repo:** use `skills/gramstax-repo-superplan/SKILL.md` for plan creation, revision, review, resume, reconciliation, and superbuild handoff.
- **Apps built on Gramstax:** use `skills/gramstax-superplan/SKILL.md`; copy that directory into the app's `skills/` directory. It plans greenfield `create-gramstax` scaffolds and routes to the matching best-practice skill.

## Anti-Patterns

- Do not add `@ts-ignore` / `@ts-expect-error` for hide error you must be fix it!.
- Do not use vitest or jest.
- Type suppression in tests (`as any`) is acceptable.
- Avoid adding new dependencies; prefer grammy, keyv, logging-pretty.
- No default exports — always named exports.
