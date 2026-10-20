---
title: "ADR-0004: Convention-Based Routing via Page Class Names and handle Methods"
description: Why updates route by page class name and handle method convention rather than manual registration, and what that costs in traceability.
icon: route
---

# ADR-0004: Convention-based routing via page class names + `handle*` methods

<Info>
  **Status:** Accepted

  **Date:** 2025 (inferred from package history)
</Info>

## Context

A bot receives many update kinds (text, commands, callback queries, photos, captions, contacts, locations, …) across many screens. Wiring each to an explicit `bot.on(...)` handler is verbose and scatters routing logic. The framework wants a discoverable, convention-driven model where adding a screen is "drop a class in `src/pages`".

## Decision

Route updates **by convention**, not by manual `bot.on` registration:

- **Discovery**: `PageManager` (`src/page/manager.ts`) scans `src/pages` (`getFilePath()` → `join(cwd,"src","pages")`), loads each file, and takes the first value export: `_getFile` reads `Object.values(mod)[0]` and does not filter out `default`, so a default-only module loads and the throw fires only when the module exports nothing at all (`manager.ts:45-52`).
- **Route key**: a page's `name` is derived from the file/class; `Ctx.buildData` can override `intentText` / `intentCommandText`. The callback intent is derived from `name` and is not an input field.
- **Handler methods**: each page declares optional `async handle*` methods on its `Ctx` subclass: `handleText`, `handleArgsText`, `handleCommandText`, `handleCommandArgsText`, `handleCallbackQueryData`, `handleArgsCallbackQueryData`, `handleFreeText`, the `handleSession*` and `handle*Caption*` variants, etc. (`src/core/ctx.ts`).
- **Worker bots**: bots that only make raw API calls use `deploy: "raw"`, which
  skips page discovery entirely. An earlier `templateManager: {} as any`
  exception for this case has been removed and now throws.

<Note>
  Routing is implicit: harder to trace than explicit `bot.on` calls, and
  name/intent collisions are resolved by convention rather than by a typed route
  table.
</Note>

## Consequences

### Benefits

- Adding a screen = create a class in `src/pages`; zero router wiring.
- Handler names make intent obvious (`handleFreeText` vs `handleCallbackQueryData`).
- `buildData` overrides let one page serve multiple intents without renaming.

### Trade-offs

- Routing is implicit: harder to trace than explicit `bot.on` calls.
- Name/intent collisions are resolved by convention, not a typed route table.

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| Explicit `bot.on(...)` registration | Verbose; reimplements what grammY already offers, loses auto-discovery. |
| Central route table (file) | Extra config to maintain; less "drop a file" ergonomics. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Code | `src/page/manager.ts:45-52`: `_getFile` takes `Object.values(mod)[0]` |
| Code | `src/core/ctx.ts`: `handleText`, `handleCallbackQueryData`, `handleFreeText`, `handleSession*`, `handle*Caption*` |
| Code | `src/core/bot.ts:759`: deploy-mode selection that feeds routing |
| Config | `src/types/ctx.ts`: `IPageData` (name/intent* fields) |
| Docs | `AGENTS.md`: "Convention-based routing: `handle*`, `handleSession*`, `handleFree*`, intent/callback naming." |

## Related

- [Architecture](../architecture.md): Components: PageManager, Ctx
- [ADR-0001](/guides/adr/0001-build-on-grammy.md): routing sits on grammY `Context`
