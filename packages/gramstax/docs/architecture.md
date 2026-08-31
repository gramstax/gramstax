# Architecture

> How `gramstax` is structured and why.

## System Overview

`gramstax` wraps a grammY `Bot` and routes every Telegram update through a **page** (a `Ctx` subclass) whose static `template` is compiled once by the **TemplateEngine** and cached by the **TemplateManager**. Sessions and keyboards live in a **CacheExternal** (keyv) store. Incoming updates are matched by convention to `handle*` methods on the resolved page.

```text
Telegram ── update ──▶ Gramstax (core/bot.ts)
                                │
                 ┌──────────────┴───────────────┐
                 │  PageManager                  WebhookQueue │
                 │  (discover src/pages)        (backpressure)│
                 └──────────────┬───────────────┘
                                │ resolve route → Ctx subclass
                                ▼
                 ┌──────────────────────────────────────┐
                 │ Ctx (core/ctx.ts)                        │
                 │  handleText / handleCallbackData / …     │
                 │  reply / edit / broadcast / session       │
                 └───────┬───────────────────────┬──────┘
                         │ renders                  │ reads/writes
                         ▼                          ▼
                 TemplateManager ──▶ TemplateEngine   CacheExternal (keyv:
                 (watch+cache)   (parse/compile/        memory | redis |
                                      validate)           | custom)
                         ▲
                         │ BlockGKeyboard + LabelGKeyboard build <g-keyboard>
```

## Components

### Gramstax (bot core)

| Attribute | Value |
|-----------|-------|
| **Location** | `src/core/bot.ts` (`Gramstax` class, line 61) |
| **Responsibility** | Orchestration, lifecycle, routing, deploy-mode startup, plugin/hook registration. |
| **Depends On** | `Ctx`, `TemplateManager`, `CacheExternal`, `WebhookQueue`, `PageManager`, `E2eHelper` (when `deploy:"test"`). |
| **Depended On By** | Application entry points and `create-gramstax` scaffolds. |

The constructor (`bot.ts:275`) reads `ITGramstaxParams`, selects a deploy mode (`bot.ts:323-342`): `polling` → `_runPolling`, `webhook:<url>` → `_runWebhook`, `serverless:<adapter>` → `_runServerless`, `test` → E2E mode. Hooks (`hookBeforeStart`, `hookBeforeRoute`, `hookAfterStart`, `onCatch`, `hookErrorPage`, `hookNotFoundPage`) are invoked at the documented lifecycle points (`bot.ts:499` notes `hookBeforeRoute` only fires when set to return `true` or unset).

### Ctx (page/context base)

| Attribute | Value |
|-----------|-------|
| **Location** | `src/core/ctx.ts` (4006 lines) |
| **Responsibility** | Per-update context: template rendering, reply/edit/broadcast, session get/set/clear, routing helpers, keyboard builders. |
| **Depends On** | `TemplateManager`, `CacheExternal`, grammY `InlineKeyboard`/`Keyboard`/`InputMediaBuilder`. |
| **Depended On By** | Every user page class. |

Handler methods follow a naming convention (all optional, all `async`): `handleCallbackData`, `handleArgsCallbackData`, `handleText`, `handleArgsText`, `handleCommandText`, `handleCommandArgsText`, `handleFreeText`, plus `handle*Session*`, `handle*Caption*` (photo/video/audio/document), `handleFree*` variants (`ctx.ts:2711-3180+`). Reply surface includes `reply`, `replyRich`, `replyMedia`, `replyPhoto/Video/Audio/Document/Animation/Voice/VideoNote/Sticker/Location/Contact`, `replyMediaGroup`, `edit`, `editMedia`, `broadcast`, `broadcastMedia` (`ctx.ts:1037-2153`). Keyboard builders: `bottomKeyboardT` (`ctx.ts:2467`), `inlineKeyboardT` (`ctx.ts:2505`), `buildData` for route config (`ctx.ts:2340-2367`).

### TemplateEngine

| Attribute | Value |
|-----------|-------|
| **Location** | `src/template/engine.ts` (3386 lines) |
| **Responsibility** | Parse, compile, and validate the `<g-*>` DSL and Telegram Rich HTML. |
| **Depends On** | Nothing external (pure string→function compilation via `new Function()`). |
| **Depended On By** | `TemplateManager`. |

Compiles blocks with `_compileToFunction` using `new Function("data", body)` (`engine.ts:1284`, `:1287`). Processes base/message/keyboard/media/description/import/map/script/switch/div/space/names blocks and resolves scopes/interpolation (`_processScope*`, `_processG*Blocks`). Validation is two-layer (see below).

### TemplateManager

| Attribute | Value |
|-----------|-------|
| **Location** | `src/template/manager.ts` (1012 lines) |
| **Responsibility** | Load templates from `.html`/`.ts`/`.js`, compile via `TemplateEngine`, cache compiled results in `_map`, and hot-reload via `chokidar`. |
| **Depends On** | `TemplateEngine`, `PageManager`, `chokidar`. |
| **Depended On By** | `Gramstax`, `Ctx`, `E2eHelper`. |

`_supportedExtensions = {".html",".ts",".js"}` (`manager.ts:87`). `enableWatch` drives `_initializeWatcher` (`chokidar.watch`). Public getters: `getMessage`, `getKeyboard`, `getGMedia`, `getGDescription` (used by `E2eHelper.gmsg/gkb/gmedia`).

### PageManager

| Attribute | Value |
|-----------|-------|
| **Location** | `src/page/manager.ts` (194 lines) |
| **Responsibility** | Discover page modules under `src/pages` (`getFilePath()` → `join(cwd,"src","pages")`) and extract the **first named export** (no default export). |
| **Depends On** | `node:fs`, `node:module` (`createRequire`). |
| **Depended On By** | `TemplateManager`, `Gramstax`. |

`_getFile` throws if `mod[0]` is undefined — i.e. a page file must `export class` (not `export default`) (`manager.ts:56-63`).

### CacheExternal

| Attribute | Value |
|-----------|-------|
| **Location** | `src/cache/external.ts` (111 lines) |
| **Responsibility** | Unified cache/session store extending `keyv`. Modes: `memory` (default `Map`), `redis://…` (`@keyv/redis`), or `forceStore` custom. |
| **Depends On** | `keyv`, `@keyv/redis`. |
| **Depended On By** | `Gramstax.cacheSession`, `Ctx`, template keyboard cache. |

### WebhookQueue

| Attribute | Value |
|-----------|-------|
| **Location** | `src/webhook/queue.ts` (97 lines) |
| **Responsibility** | In-memory bounded FIFO. `enqueue` blocks when full; `dequeue` blocks when empty; exposes `getStats()`. |
| **Depends On** | Nothing. |
| **Depended On By** | `Gramstax` (webhook/serverless modes). |

### Keyboard builders (blocks + labels)

| Attribute | Value |
|-----------|-------|
| **Location** | `src/blocks/g-keyboard.ts` (`BlockGKeyboard`), `src/labels/g-keyboard.ts` (`LabelGKeyboard`) |
| **Responsibility** | `LabelGKeyboard` holds multilingual button label maps; `BlockGKeyboard._build(key, lang?, type?, reverse?)` emits `<g-keyboard type="inline\|bottom" lang="…">…</g-keyboard>` strings. |
| **Depends On** | Each other (`blocks` imports `labels`). |
| **Depended On By** | Page templates (via `this.kbk.*()` helpers). |

### E2eHelper + MockTelegramServer

| Attribute | Value |
|-----------|-------|
| **Location** | `src/e2e/helper.ts` (`E2eHelper`, 567 lines), `src/mock/telegram-server.ts` |
| **Responsibility** | `E2eHelper` (active when `deploy:"test"`) intercepts outbound Bot API calls via `bot.api.config.use(...)` and captures them in `calls`; provides `sendText`/`sendPhoto`/`sendCallbackQuery`/… simulators. `MockTelegramServer` is an HTTP mock for integration tests. |
| **Depends On** | `Gramstax` instance. |
| **Depended On By** | Test suites (`test/*`). |

## Data Flow

1. **Startup** — `new Gramstax(params)` (`bot.ts:275`) selects a deploy mode and calls `bot.init()`. `TemplateManager` loads + compiles all page templates once and starts the `chokidar` watcher if `enableWatch`.
2. **Incoming update** — grammY hands the update to `Gramstax`. `PageManager` resolves the target `Ctx` subclass by route/intent; `WebhookQueue` (webhook mode) serializes the update.
3. **Handler** — The matched `handle*` method on the page runs. It calls `reply`/`edit`/`broadcast`, which pull the compiled `<g-base>` message/keyboard/media from `TemplateManager` (keyed by `AGBaseId` + language), interpolate `{{data}}`, and send via grammY.
4. **State** — `Ctx.session` reads/writes user state through `CacheExternal` (keyv → memory or Redis). Keyboard layouts are cached per language in `cacheKeyboard`.
5. **Hot reload** — If a template file changes, `chokidar` triggers recompile in `TemplateManager._map`; no restart needed.

## Key Interfaces

| Interface | Location | Purpose |
|-----------|----------|---------|
| `ITGramstaxParams` | `src/types/t.bot.ts:111` | Constructor options (`token`, `deploy`, `log`, `botConfig`, `webhookQueue`, `cacheSession`, `cacheKeyboard`, `templateManager`, `optionsPage`). |
| `ITWebhookQueueConfig` | `src/types/t.bot.ts:26` | `enabled`, `maxQueueSize`, `workerCount`, `perChatConcurrency`, `blockWhenFull`. |
| `ITTemplateOptions` | `src/types/t.template.ts:41` | `path[]`, `enableWatch?`, `watchOptions?`. |
| `ITCompiledTemplate` | `src/types/t.template.ts:12` | Cached compiled `media`/`message`/`keyboard`/`description`. |
| `ITPageData` | `src/types/t.ctx.ts:375` | Route metadata: `name`, `callbackData`, `intentText`, `intentCommandText`, `intentCallbackData`. |
| `Ctx` handler signatures | `src/core/ctx.ts:2711+` | `handleText`, `handleCallbackData`, `handleFree*`, `handleSession*`, `handle*Caption*`. |

## External Dependencies

| Dependency | Purpose | Why This Choice |
|------------|---------|-----------------|
| `grammy` | Underlying Telegram Bot API client + `Bot`/`Context`/`InlineKeyboard`/`InputMediaBuilder`. | Mature, typed Telegram framework; `gramstax` extends it rather than reimplementing transport. |
| `keyv` + `@keyv/redis` | Session/keyboard cache abstraction with memory and Redis backends. | One interface for in-memory dev and Redis-backed production sessions. |
| `chokidar` | Filesystem watcher for template hot-reload. | Robust cross-platform file watching without polling. |
| `logging-pretty` | Structured logging (`LoggingHelper` extends `LoggingPretty`). | Consistent prefixed R/W/E logs plus timing helpers. |
| `tsup` / `nx` / `api-extractor` / `api-documenter` | Build (dual ESM/CJS + d.ts), monorepo orchestration, and API reference generation. | Standard Bun/Nx toolchain for a published TS library. |

## Design Decisions

Key architectural choices and their rationale:

1. **Extend grammY instead of wrapping raw Bot API** — see [ADR-0001](adr/0001-build-on-grammy.md).
2. **Template DSL compiled with `new Function()`** — see [ADR-0002](adr/0002-template-dsl-new-function.md).
3. **Unified keyv/Redis cache (`CacheExternal`)** — see [ADR-0003](adr/0003-keyv-redis-cache.md).
4. **Convention-based routing via page class names + `handle*` methods** — see [ADR-0004](adr/0004-convention-routing.md).
5. **Hot-reload templates with `chokidar`** — see [ADR-0005](adr/0005-hot-reload-chokidar.md).
6. **In-process E2E testing (`deploy:"test"`)** — see [ADR-0006](adr/0006-in-process-e2e.md).
7. **Bun + tsup + Nx + API-Extractor toolchain** — see [ADR-0007](adr/0007-bun-tsup-nx-toolchain.md).
8. **No `@ts-ignore`, named exports only, minimal deps** — see [ADR-0008](adr/0008-lint-export-dep-conventions.md).

## Related Documentation

- [Overview](overview.md) - Project purpose and scope
- [Glossary](glossary.md) - Domain terminology used here
- [Decisions](adr/README.md) - Architecture Decision Records
