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
├── webhook/queue.ts    WebhookQueue (bounded concurrent queue)
├── mock/telegram-server.ts MockTelegramServer
├── e2e/helper.ts       E2eHelper (in-process test harness)
├── types/              t.bot.ts, t.ctx.ts, t.template.ts, t.e2e.ts
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
| Webhook request queuing                      | `webhook/queue.ts`                         |
| Mock Telegram API for tests                  | `mock/telegram-server.ts`                  |
| E2E test helpers                             | `e2e/helper.ts`                            |
| Public TypeScript types                      | `types/t.*.ts`                             |

## Exports

Barrel (`src/index.ts`) re-exports all public symbols. No default exports. Add new public exports here.

## Key Classes

- **Gramstax** (`core/bot.ts`) — main app class wrapping grammy `Bot`. Composes `TemplateManager`, `CacheExternal`, `WebhookQueue`, `PageManager`.
- **Ctx** (`core/ctx.ts`) — base class for page handlers. Handles reply, edit, broadcast, session, routing.
- **TemplateEngine** (`template/engine.ts`) — template parser/compiler/validator for Telegram Rich HTML + PAGE blocks.
- **TemplateManager** (`template/manager.ts`) — template file watcher, loader, compiler integration.
- **PageManager** (`page/manager.ts`) — auto-discovers page modules; loads first named export (no default exports).
- **TemplateConfig** — `ITGramstaxParams` (not `GramstaxConfig`). Includes `token`, `deploy`, `log`, `botConfig`, `webhookQueue`, `cacheSession`, `cacheKeyboard`, `templateManager`, `optionsPage`, `rateLimit`, `throttle`, `sessionLock`, `onTrace`.

## Patterns

- Template-driven bot with filesystem page discovery.
- Convention-based routing: `handle*`, `handleSession*`, `handleFree*`, intent/callback naming.
- Template pipeline is regex/parser-based with `new Function()` compilation.
- Supports hot-reload for template files via chokidar.
- Test mode via `deploy: "test"` + `MockTelegramServer`.
- Raw mode: pass `deploy: "raw"` to get a bare grammY `Bot` (no pages, no templates, no Gramstax routing, no auto-start). Write raw grammY handlers on `bot.bot` and start it yourself. The legacy `templateManager: {} as any` exception was removed — using it in a non-raw mode now throws.

## Complexity Hotspots

| File                  | Lines | Risk                                                              |
| --------------------- | ----- | ----------------------------------------------------------------- |
| `core/ctx.ts`         | 4006  | Multipurpose — split candidates: reply, broadcast, session, route |
| `template/engine.ts`  | 3251  | Parser + compiler + validator in one file                         |
| `core/bot.ts`         | 1612  | Lifecycle + routing + webhook/polling + plugins                   |
| `template/manager.ts` | 1012  | Watcher + loader + compiler glue                                  |

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

Context docs: `CONTEXT.md` + ADRs in `packages/gramstax/docs/adr/`; map + consumer rules in root `CONTEXT-MAP.md` / `docs/agents/domain.md`.

## Anti-Patterns

- Do not add `@ts-ignore` / `@ts-expect-error` for hide error you must be fix it!.
- Do not use vitest or jest.
- Type suppression in tests (`as any`) is acceptable.
- Avoid adding new dependencies; prefer grammy, keyv, logging-pretty.
- No default exports — always named exports.
