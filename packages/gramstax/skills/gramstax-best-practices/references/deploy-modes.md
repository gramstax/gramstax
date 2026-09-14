# deploy-modes

Pick the deploy mode by environment; `raw` for bare workers, `test` for e2e.

## Why

Each mode wires a different startup path (polling loop, webhook server, serverless handler, nothing, in-process harness). Constructing the wrong mode in the wrong place means real network calls in tests or a full page stack in a cron worker.

## Incorrect

```typescript
// full Gramstax stack just to call one API method on a schedule
const bot = new Gramstax({token, deploy: `polling`, templateManager, log: false})
await bot.bot.api.deleteMessage(chatId, messageId)
```

## Correct

```typescript
// bare grammY bot: no pages, no templates, no routing, no auto-start
const bot = new Gramstax({token, deploy: `raw`, log: false})
await bot.bot.api.deleteMessage(chatId, messageId)

// e2e harness: no network at all
const bot = new Gramstax({token: `test`, deploy: `test`, templateManager, log: false})
```

## Notes

- `polling` / `webhook:<url>` / `serverless:<adapter>` run startup hooks (`hookBeforeStart`, then `hookAfterStart`); `raw` runs only `hookBeforeStart`; observe `bot.ready` for async completion.
- `templateManager: {} as any` no longer opts out of anything — non-raw modes require a real `TemplateManager`.
- Invalid deploy strings throw at construction (`polling`, `webhook:<url>`, `serverless:<adapter>`, `raw`, `test` only).
