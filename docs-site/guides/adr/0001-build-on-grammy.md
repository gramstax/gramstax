# ADR-0001: Build on grammY instead of the raw Bot API

<Info>
  **Status:** Accepted

  **Date:** 2025 (inferred from package history)
</Info>

## Context

A Telegram bot framework needs to talk to the Telegram Bot API: sending messages, editing, keyboards, media groups, webhook/polling transport, and the `Context` object that carries update state. The raw Bot API is a flat HTTP surface; re-implementing transport, `Context`, and media builders would be a large, error-prone effort distinct from the framework's actual value (declarative pages/templates).

## Decision

Build `gramstax` **on top of [`grammy`](https://grammy.dev)**. `Gramstax` extends grammY's `Bot` (`core/bot.ts` imports `Bot, webhookCallback`); `Ctx` reuses grammY's `Context`, `InlineKeyboard`, `Keyboard`, and `InputMediaBuilder` (`core/ctx.ts`); public types are aliases of grammY types (`types/ctx.ts`: `ICt = Context`, `IInlineKb = InlineKeyboard`, `IBottomKb = Keyboard`).

## Consequences

### Benefits

- Inherits grammY's typed `Context`, transport, media builders, and `webhookCallback` for free.
- The framework adds value (pages, templates, cache) without reimplementing Bot API plumbing.
- Upgrades track grammY releases rather than a custom fork.

### Trade-offs

<Note>
  Tight coupling to grammY's API surface and versioning. `peerDependencies` must
  keep `typescript` aligned; grammY major bumps can ripple into `Ctx`/`Bot`
  signatures.
</Note>

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| Raw `fetch` to Bot API | Duplicates transport, `Context`, and media builders; loses grammY's typing and ecosystem. |
| `telegraf` (Node) | Node-oriented; repo targets Bun and grammY's design fits the `Context`-extension model better. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Dependency | `package.json` — `"grammy": "^1.46.0"` |
| Code | `src/core/bot.ts:20` — `import {Bot, webhookCallback, type BotConfig, type BotError} from "grammy"` |
| Code | `src/core/ctx.ts:14` — `import {InlineKeyboard, InputMediaBuilder, Keyboard} from "grammy"` |
| Config | `src/types/ctx.ts` — `ICt = Context`; `InlineKeyboard` / `Keyboard` / `InputMediaBuilder` are used directly from `grammy` with no local alias |
| Docs | `AGENTS.md` — "Built on top of the Telegram Bot API framework with page-based routing." |

## Related

- [Architecture](../architecture.md) — Components: Gramstax, Ctx
- [ADR-0004](/guides/adr/0004-convention-routing.md) — routing on top of grammY `Context`
