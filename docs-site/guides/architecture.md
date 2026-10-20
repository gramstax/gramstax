---
title: Architecture
description: How gramstax is put together, from update intake through routing, rendering, and cache, with the responsibilities and dependencies of each core class.
icon: layers
---

# Architecture

> How `gramstax` is structured and why.

## System Overview

`gramstax` owns the bot lifecycle and routes every Telegram update through a **page** (a `Ctx` subclass) whose static `template` is compiled once by the **TemplateEngine** and cached by the **TemplateManager**. Sessions and keyboards live in a **CacheExternal** (keyv) store. Incoming updates are matched by convention to `handle*` methods on the resolved page.

```text
Telegram ── update ──▶ Gramstax (core/bot.ts)
                                │
                 ┌──────────────┴───────────────┐
                 │ PageManager      UpdateQueue           │
                 │ (discover src/pages)  (backpressure)    │
                 └──────────────┬───────────────┘
                                │ resolve route → Ctx subclass
                                ▼
                 ┌──────────────────────────────────────┐
                 │ Ctx (core/ctx.ts)                        │
                 │  handleText / handleCallbackQueryData /…     │
                 │  render*() · session · keyboard       │
                 └───────┬───────────────────────┬──────┘
                         │ renders                  │ reads/writes
                         ▼                          ▼
                 TemplateManager ──▶ TemplateEngine   CacheExternal (keyv:
                 (watch+cache)   (parse/compile/        memory | redis |
                                      validate)           | custom)
                         ▲
                         │ BlockGKeyboard + LabelGKeyboard build <g-keyboard>
```

## Source Layout

Every component below is one file under `packages/gramstax/src`, which is where
the paths in the tables that follow point.

<Tree>

- `packages/gramstax/src/`
  - `core/`
    - `bot.ts` → `Gramstax`
    - `ctx.ts` → `Ctx`
  - `template/`
    - `engine.ts` → `TemplateEngine`
    - `manager.ts` → `TemplateManager`
  - `page/manager.ts` → `PageManager`
  - `cache/external.ts` → `CacheExternal`
  - `update/`
    - `queue.ts` → `UpdateQueue`
    - `dispatcher.ts` → `UpdateDispatcher`
    - `gate.ts`, `gate-key.ts`
  - `blocks/g-keyboard.ts` → `BlockGKeyboard`
  - `labels/g-keyboard.ts` → `LabelGKeyboard`
  - `e2e/helper.ts` → `E2eHelper`
  - `mock/telegram-server.ts` → `MockTelegramServer`
  - `types/` → the `IGramstax*` and `I*` interfaces

</Tree>

## Components

### Gramstax (bot core)

| Attribute | Value |
|-----------|-------|
| **Location** | `src/core/bot.ts` (`Gramstax` class, line 120) |
| **Responsibility** | Orchestration, lifecycle, routing, deploy-mode startup, plugin/hook registration. |
| **Depends On** | `Ctx`, `TemplateManager`, `CacheExternal`, `UpdateQueue`, `UpdateDispatcher`, `PageManager`, `E2eHelper` (when `deploy:"test"`). |
| **Depended On By** | Application entry points and `create-gramstax` scaffolds. |

The constructor (`bot.ts:534`) reads `IGramstaxParams`, selects a deploy mode (`bot.ts:759`): `polling` → `_runPolling`, `webhook` → `_runWebhook`, `serverless` → `_runServerless` (adapter-keyed `optionsDeploy.serverless`), `test` → E2E mode. Hooks (`hookBeforeStart`, `hookBeforeRoute`, `hookAfterStart`, `hookUpdateError`, `hookErrorPage`, `hookNotFoundPage`) are invoked at the documented lifecycle points. The page-level gate is a strict `!== false` test, so a `hookBeforeRoute` that returns `undefined`, `null`, `0` or `""` lets the update through just as `true` does.

### Ctx (page/context base)

| Attribute | Value |
|-----------|-------|
| **Location** | `src/core/ctx.ts` |
| **Responsibility** | Per-update context: template rendering, reply/edit/broadcast, session get/set/clear, routing helpers, keyboard builders. |
| **Depends On** | `TemplateManager`, `CacheExternal`, the client's `InlineKeyboard`/`Keyboard`/`InputMediaBuilder`. |
| **Depended On By** | Every user page class. |

Handler methods follow a naming convention: all optional, all `async`. The name is
assembled in a fixed order (`handle` · `Session`/`Free` · `Command` · `Caption` ·
`Args` · kind), and the `Args` piece is independent of the command piece:
`handleText` and `handleCommandText` match exactly, while `handleArgsText` (args
**without** a command) and `handleCommandArgsText` (`/cmd <args>`) match by
`startsWith`. Caption variants exist for photo, video, audio, document,
animation and voice.

You never call a send method. `render*()` is the entire outbound surface: 32
methods that pick the underlying call for you from the route you pass
(`replyWithPhoto`, `editMessageText`, and so on). Broadcast is a route option
(`broadcast`), not a method. Broadcast and edit are selected by the route,
never named directly.

Keyboard builders: `bottomKeyboardT`, `inlineKeyboardT`, and `buildData` for
route configuration. See [the render contract](/concepts/render-contract) for the
full atom list.

### TemplateEngine

| Attribute | Value |
|-----------|-------|
| **Location** | `src/template/engine.ts` |
| **Responsibility** | Parse, compile, and validate the `<g-*>` DSL and Telegram Rich HTML. |
| **Depends On** | Nothing external (pure string→function compilation via `new Function()`). |
| **Depended On By** | `TemplateManager`. |

Compiles blocks with `_compileToFunction` using `new Function("data", "__esc", "FILTERS", body)` (`engine.ts:3037`, `:3040`). Processes base/message/keyboard/media/description/import/map/script/switch/div/space blocks and resolves scopes/interpolation (`_processScope*`, `_processG*Blocks`). Validation is layered: three layers for Telegram tags (required attributes, value formats, unknown attributes) and two for PAGE blocks (required attributes, value formats); see [Template Blocks](/guides/template-blocks).

### TemplateManager

| Attribute | Value |
|-----------|-------|
| **Location** | `src/template/manager.ts` |
| **Responsibility** | Load templates from `.html`/`.ts`/`.js`, compile via `TemplateEngine`, cache compiled results in `_map`, and hot-reload via `chokidar`. |
| **Depends On** | `TemplateEngine`, `PageManager`, `chokidar`. |
| **Depended On By** | `Gramstax`, `Ctx`, `E2eHelper`. |

`_supportedExtensions = new Set([".html", ".ts", ".js"])` gates which files load at
all. `enableWatch` drives the `chokidar` watcher. The public read surface is the
`getG*` family: `getGMessage`, `getGKeyboard`, `getGMedia`, `getGDescription`,
`getGPoll`, `getGVenue`, `getGDice`, `getGInvoice`, `getGCallbackAnswer`,
`getGWebAppAnswer`, and friends, each taking `(key, AGBaseId, ALang, data)`. The bare `getMessage` name
does not exist; `E2eHelper.gmsg/gkb/gmedia` are the e2e-side shorthands for these.

### PageManager

| Attribute | Value |
|-----------|-------|
| **Location** | `src/page/manager.ts` |
| **Responsibility** | Discover page modules under `src/pages` (`getFilePath()` → `join(cwd,"src","pages")`) and extract the first value export (`Object.values(mod)[0]`, no default-export filtering). |
| **Depends On** | `node:fs`, `node:module` (`createRequire`). |
| **Depended On By** | `TemplateManager`, `Gramstax`. |

`_getFile` takes `Object.values(mod)[0]` and throws only when the module exports nothing at all, so a default-only export loads. Named exports remain the convention because with more than one export you get whichever value the module records first (`manager.ts:45-52`).

<Warning>
  A default export is not rejected here: `_getFile` takes `Object.values(mod)[0]`
  and never filters `default` out, so a default-only module loads. It is still
  the wrong shape to write, because the moment a second export appears the
  loaded value is whichever one the module namespace sorts first. Use one named
  `export class` per page.
</Warning>

### CacheExternal

| Attribute | Value |
|-----------|-------|
| **Location** | `src/cache/external.ts` |
| **Responsibility** | Unified cache/session store extending `keyv`. Modes: `memory` (default `Map`), `redis://…` (`@keyv/redis`), or `forceStore` custom. |
| **Depends On** | `keyv`, `@keyv/redis`. |
| **Depended On By** | `Gramstax.cacheSession`, `Ctx`, template keyboard cache. |

### UpdateQueue + UpdateDispatcher

| Attribute | Value |
|-----------|-------|
| **Location** | `src/update/queue.ts`, `src/update/dispatcher.ts`, `src/update/gate.ts`, `src/update/gate-key.ts` |
| **Responsibility** | In-memory bounded FIFO. `enqueue` blocks when full; `dequeue` blocks when empty; exposes `getStats()`. `UpdateDispatcher` owns the worker pool and drains it before teardown. |
| **Depends On** | Nothing. |
| **Depended On By** | `Gramstax`: opt-in via `optionsDeploy.polling.queue` or `optionsDeploy.webhook.queue`, each mode getting its own instance. `WebhookQueue` is a deprecated alias of `UpdateQueue`. |

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
| **Location** | `src/e2e/helper.ts` (`E2eHelper`, 935 lines), `src/mock/telegram-server.ts` |
| **Responsibility** | `E2eHelper` (active when `deploy:"test"`) intercepts outbound Bot API calls via `bot.api.config.use(...)` and captures them in `calls`; provides `sendText`/`sendPhoto`/`sendCallbackQuery`/… simulators. `MockTelegramServer` is an HTTP mock for integration tests. |
| **Depends On** | `Gramstax` instance. |
| **Depended On By** | Test suites (`test/*`). |

## Data Flow

<Steps>
  <Step title="Startup">
    `new Gramstax(params)` (`bot.ts:534`) selects a deploy mode and calls
    `bot.init()`. `TemplateManager` loads + compiles all page templates once and
    starts the `chokidar` watcher if `enableWatch`.
  </Step>

  <Step title="Incoming update">
    The client hands the update to `Gramstax`. `PageManager` resolves the target
    `Ctx` subclass by route/intent. When `queue.enabled` is set, `UpdateQueue` +
    `UpdateDispatcher` buffer the update and drain it on a worker pool (both
    `polling` and `webhook`); otherwise the update is handled inline.
  </Step>

  <Step title="Handler">
    The matched `handle*` method on the page runs. It calls
    `reply`/`edit`/`broadcast`, which pull the compiled `<g-base>`
    message/keyboard/media from `TemplateManager` (keyed by `AGBaseId` +
    language), interpolate `{{data}}`, and send through the client.
  </Step>

  <Step title="State">
    `Ctx.session` reads/writes user state through `CacheExternal` (keyv → memory
    or Redis). Keyboard layouts are cached per language in `cacheKeyboard`.
  </Step>

  <Step title="Hot reload">
    If a template file changes, `chokidar` triggers recompile in
    `TemplateManager._map`; no restart needed.
  </Step>
</Steps>

## Key Interfaces

| Interface | Location | Purpose |
|-----------|----------|---------|
| `IGramstaxParams` | `src/types/bot.ts` | Constructor options (`token`, `deploy`, `optionsDeploy`, `log`, `botConfig`, `cacheSession`, `cacheKeyboard`, `templateManager`, `manifest`, `optionsPage`, `rateLimit`, `throttle`, `sessionLock`). |
| `IUpdateQueueConfig` | `src/types/bot.ts` | `enabled`, `maxQueueSize`, `workerCount`, `perChatConcurrency`, `blockWhenFull`, `enqueueTimeoutMs`, `waiterTimeoutMs`, `drainTimeoutMs`. Aliased as the deprecated `IWebhookQueueConfig`. |
| `ITemplateOptions` | `src/types/template.ts` | `path[]`, `enableWatch?`, `watchOptions?`, `onReload?`. |
| `ICompiledTemplate` | `src/types/template.ts` | Cached compiled blocks: `media`, `poll`, `venue`, `dice`, `callbackAnswer`, `precheckoutError`, `shippingError`, `inlineButton`, `answerNote`, `webAppAnswer`, `gift`, `invoice`, `paidMedia`, `message`, `keyboard`, `description`. |
| `IPageData` | `src/types/ctx.ts` | Route metadata: `name`, `intentText`, `intentCommandText`, `intentCallbackQueryData`, plus the optional `intentTextMap` / `intentCommandTextMap` language variants. |
| `Ctx` handler signatures | `src/core/ctx.ts` | `handleText`, `handleCallbackQueryData`, `handleFree*`, `handleSession*`, `handle*Caption*`. |

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

1. **Build on an existing client instead of the raw Bot API**: see [ADR-0001](/guides/adr/0001-build-on-grammy.md).
2. **Template DSL compiled with `new Function()`**: see [ADR-0002](/guides/adr/0002-template-dsl-new-function.md).
3. **Unified keyv/Redis cache (`CacheExternal`)**: see [ADR-0003](/guides/adr/0003-keyv-redis-cache.md).
4. **Convention-based routing via page class names + `handle*` methods**: see [ADR-0004](/guides/adr/0004-convention-routing.md).
5. **Hot-reload templates with `chokidar`**: see [ADR-0005](/guides/adr/0005-hot-reload-chokidar.md).
6. **In-process E2E testing (`deploy:"test"`)**: see [ADR-0006](/guides/adr/0006-in-process-e2e.md).
7. **Bun + tsup + Nx + API-Extractor toolchain**: see [ADR-0007](/guides/adr/0007-bun-tsup-nx-toolchain.md).
8. **No `@ts-ignore`, named exports only, minimal deps**: see [ADR-0008](/guides/adr/0008-lint-export-dep-conventions.md).

## Related Documentation

<Columns cols={2}>
  <Card title="Overview" icon="compass" href="/introduction">
    Project purpose and scope
  </Card>
  <Card title="Page routing" icon="route" href="/concepts/page-routing">
    How a file under `src/pages` becomes a route, and how handlers bind to it
  </Card>
  <Card title="Render contract" icon="shapes" href="/concepts/render-contract">
    How `render*()` picks the underlying Bot API call
  </Card>
  <Card title="Glossary" icon="book-open" href="/guides/glossary">
    Domain terminology used here
  </Card>
  <Card title="Decisions" icon="git-branch" href="/guides/adr/index">
    Architecture Decision Records
  </Card>
</Columns>
