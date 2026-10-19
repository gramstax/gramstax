---
title: Glossary
description: Project-specific terms used across gramstax, each defined with the source file or module where it appears, plus an acronym list.
icon: book-open
---

# Glossary

> Project-specific terminology used in `gramstax`.

Terms are defined as they are used in this project. General programming terms are omitted unless they carry a project-specific meaning.

| Term                         | Definition                                                                                                                                                                    | Where Used                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Gramstax**                 | The `gramstax` npm package, a declarative Telegram bot framework built around pages, templates and a route-aware render API.                                                                                   | `package.json`, `src/index.ts`                     |
| **Gramstax (class)**         | The main bot application class (`core/bot.ts`) that owns the bot lifecycle and composes `TemplateManager`, `CacheExternal`, `UpdateQueue`, and `PageManager`.                  | `src/core/bot.ts:61`                               |
| **Ctx**                      | The page/context base class (`core/ctx.ts`) extended by every page handler. Provides reply, edit, broadcast, session, and routing methods.                                    | `src/core/ctx.ts:146`                              |
| **Page**                     | A user-defined class extending `Ctx` that represents one bot screen/route. Must be a named (non-default) export.                                                              | `src/core/ctx.ts`, `src/page/manager.ts:56`        |
| **Template**                 | An HTML-like string assigned to a page's static `template` property, containing `<g-*>` blocks.                                                                               | `src/core/ctx.ts:146`                              |
| **Base**                     | A `<g-base>` block inside a template, the unit of layout that holds messages, keyboards, and media. Multiple bases are addressed by `id`.                                    | `src/template/engine.ts` (`_processGBaseBlocks`)   |
| **Block**                    | Any `<g-*>` element: `<g-message>`, `<g-keyboard>`, `<g-media>`, `<g-description>`, `<g-space>`, `<g-import>`, `<g-switch>`, `<g-map>`, `<g-script>`, `<g-div>`, `<g-names>`. | `src/template/engine.ts`                           |
| **Keyboard (inline/bottom)** | Telegram inline (below message) or reply (replaces device keyboard) button layouts. Built from `<g-keyboard type="inline\|bottom">`.                                          | `src/blocks/g-keyboard.ts`, `src/labels/g-keyboard.ts` |
| **LabelGKeyboard**            | Base class for declaring multilingual button label data consumed by `BlockGKeyboard`.                                                                                          | `src/labels/g-keyboard.ts:53`                        |
| **BlockGKeyboard**            | Static builder that turns a `LabelGKeyboard` definition into `<g-keyboard>` template strings.                                                                                  | `src/blocks/g-keyboard.ts:66`                        |
| **TemplateEngine**           | Parser/compiler/validator for the `<g-*>` DSL and Telegram Rich HTML.                                                                                                         | `src/template/engine.ts`                           |
| **TemplateManager**          | Loads, compiles, caches, and hot-reloads template sources from disk via `chokidar`.                                                                                           | `src/template/manager.ts:48`                       |
| **PageManager**              | Auto-discovers page modules under `src/pages` and extracts the first named export.                                                                                            | `src/page/manager.ts:38`                           |
| **CacheExternal**            | Unified caching adapter extending `keyv`, with memory / Redis (`@keyv/redis`) / custom store modes. Used for sessions.                                                        | `src/cache/external.ts:55`                         |
| **UpdateQueue**              | In-memory bounded FIFO that backpressures and buffers updates. Shared by the `polling` and `webhook` deploys; opt-in via `optionsDeploy.<mode>.queue`. `WebhookQueue` is a deprecated alias.                                                                                                     | `src/update/queue.ts:14`                           |
| **Deploy mode**              | One of `polling`, `webhook`, `serverless`, `raw`, or `test`, supplied via `IGramstaxParams.deploy`. Per-mode settings live in `optionsDeploy`.                                                                 | `src/core/bot.ts:323`                              |
| **E2E / E2eHelper**          | In-process end-to-end test harness (active in `deploy: "test"`) that intercepts Bot API calls with zero HTTP.                                                                 | `src/e2e/helper.ts:62`                             |
| **MockTelegramServer**       | Lightweight HTTP mock of the Telegram Bot API for offline integration testing.                                                                                                | `src/mock/telegram-server.ts`                      |
| **Intent**                   | The routing key derived from a page's `name` (or overridden via `buildData` `intentText`/`intentCommandText`/`intentCallbackQueryData`).                                           | `src/types/ctx.ts:375`                           |
| **Scope**                    | Interpolation syntax inside templates (`{{var}}`, switch, map, script, div) resolved at compile time by `TemplateEngine`.                                                     | `src/template/engine.ts` (`_processScope*`)        |
| **Worker bot**               | A bot that only makes raw Bot API calls, with no page templates. Use `deploy: "raw"`, a bare grammY `Bot`, no pages, no routing, no auto-start. The older `templateManager: {} as any` exception was removed and now throws. | `AGENTS.md` (Raw mode)                              |

## Acronyms

| Acronym | Expansion                         | Meaning                                                                  |
| ------- | --------------------------------- | ------------------------------------------------------------------------ |
| RPC     | Remote Procedure Call             | Used in `ICacheRpc` for cache transport between bot and external store. |
| LRU     | Least Recently Used               | `CacheExternal.refreshLruCache()` re-touches keys to keep them warm.     |
| API     | Application Programming Interface | Telegram Bot API, reached through the client.                                   |
| DSL     | Domain-Specific Language          | The `<g-*>` template markup is a DSL compiled by `TemplateEngine`.       |
| CI      | Continuous Integration            | `.github/workflows/release.yml`.                                         |
