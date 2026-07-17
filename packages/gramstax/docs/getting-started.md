# Getting Started

> How to set up and run a `gramstax` bot locally.

## Prerequisites

| Requirement                 | Version             | Install                                   |
| --------------------------- | ------------------- | ----------------------------------------- |
| Bun (runtime + test runner) | latest              | https://bun.sh (or `npm i -g bun`)        |
| Node.js                     | LTS (`lts/*`)       | For the npm OIDC release step in CI only  |
| TypeScript                  | `^6.0.3` (peer dep) | `bun add -d typescript`                   |
| grammY Bot token            | —                   | From [@BotFather](https://t.me/BotFather) |

`gramstax` targets `esnext` and uses Bun APIs (e.g. `Bun.serve` for webhooks), so **Bun is the primary runtime**. The repo is an Nx monorepo; this guide covers the `packages/gramstax` library and a local bot that consumes it.

## Installation

```bash
# From the monorepo root
git clone <repo-url>
cd gramstax
bun install

# Consume gramstax in your own bot project
bun add gramstax grammy
```

## Configuration

A bot is configured entirely through the `ITGramstaxParams` object passed to `new Gramstax(...)`. There are no `.env` files required by the library itself — only `token` and `deploy` are mandatory.

| Field                           | Required | Description                                                                      | Default         |
| ------------------------------- | -------- | -------------------------------------------------------------------------------- | --------------- |
| `token`                         | Yes      | Telegram Bot API token from BotFather.                                           | —               |
| `deploy`                        | Yes      | One of `polling`, `webhook:<public-url>`, `serverless:<adapter>`, `test`.        | —               |
| `log`                           | No       | `LoggingHelper` instance, `true` (default logger), or `null`/`false` to disable. | `false`         |
| `botConfig`                     | No       | grammY `BotConfig` (e.g. `apiRoot`).                                             | —               |
| `webhookQueue`                  | No       | `ITWebhookQueueConfig` for webhook backpressure.                                 | —               |
| `cacheSession`                  | No       | Custom `CacheExternal` (e.g. Redis).                                             | in-memory `Map` |
| `cacheKeyboard`                 | No       | Custom keyboard cache `Map`.                                                     | internal `Map`  |
| `templateManager`               | No       | Custom `TemplateManager` options.                                                | auto-created    |
| `optionsPage.shortCallbackData` | No       | Use numeric callback ids to shrink payloads.                                     | `false`         |

## Running Locally

The simplest local setup uses **polling** (no public URL needed):

```typescript
// src/bot.ts
import { Gramstax } from "gramstax";

const bot = new Gramstax({
  token: process.env.BOT_TOKEN!,
  deploy: "polling",
  log: true,
});

bot.start(); // registers handlers, calls bot.init(), begins polling
```

```bash
# Run with Bun (from the package or your bot project)
BOT_TOKEN="123456:ABC…" bun run src/bot.ts
```

### Pages

Create page classes under `src/pages` (auto-discovered by `PageManager`). Each must be a **named export** extending `Ctx` with a `static template`:

```typescript
// src/pages/start.ts
import { Ctx } from "gramstax";

export class StartPage extends Ctx {
  static template = `
    <g-base>
      <g-keyboard type="inline">Menu, Help</g-keyboard>
      <g-message>Hello {{name}}!</g-message>
    </g-base>
  `;

  async handleText() {
    await this.reply();
  }
}
```

### Webhook / serverless / test

```typescript
new Gramstax({ token, deploy: "webhook:https://example.com/bot" }); // Bun HTTP server + setWebhook
new Gramstax({ token, deploy: "serverless:std/http" }); // export handler for your runtime
new Gramstax({ token: "test", deploy: "test" }); // E2E mode, no HTTP
```

## Verifying It Works

```bash
# From the monorepo root — run the package's unit tests
bun run test:packages
# or target this package's tests directly
bun test ./packages/gramstax/test
bun test --filter "TemplateEngine"

# Type-check + lint (the CI gate)
bun run ci:check:packages
```

Send `/start` to your bot in Telegram; you should receive the rendered `<g-message>` with the inline keyboard.

## Common Issues

| Problem                                                 | Cause                                                                               | Solution                                                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `File <path> must have export (not default) class page` | Page uses `export default class`.                                                   | Use a named `export class StartPage`. `PageManager._getFile` only reads `mod[0]` (`page/manager.ts:56`). |
| Keyboard bindings don't work                            | A `<g-base id="x">` is defined but `AGBaseId` isn't passed to the keyboard builder. | Pass the same `id` to `bottomKeyboardT`/`inlineKeyboardT` (`types/t.ctx.ts` warns about this).           |
| Changes to templates not reflected                      | `enableWatch` is off or the file extension isn't `.html`/`.ts`/`.js`.               | Set `templateManager: {enableWatch: true}` (`TemplateManager._supportedExtensions`, `manager.ts:87`).    |
| Redis session errors                                    | Wrong `cacheSession` URL.                                                           | Use `new CacheExternal("redis://host:port")` or omit for in-memory (`cache/external.ts:64`).             |

## Next Steps

- [Development](development.md) - Learn how to contribute
- [Architecture](architecture.md) - Understand the system design
- [Decisions](adr/README.md) - Why the framework is built this way
