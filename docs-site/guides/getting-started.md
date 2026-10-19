---
title: Getting Started
description: Prerequisites, installation, the config fields a bot needs, and how to run a gramstax bot locally with polling.
icon: rocket
---

# Getting Started

> How to set up and run a `gramstax` bot locally.

## Prerequisites

| Requirement                 | Version             | Install                                   |
| --------------------------- | ------------------- | ----------------------------------------- |
| Bun (runtime + test runner) | latest              | https://bun.sh (or `npm i -g bun`)        |
| Node.js                     | LTS (`lts/*`)       | For the npm OIDC release step in CI only  |
| TypeScript                  | `^6.0.3` (peer dep) | `bun add -d typescript`                   |
| Bot token                   | _not applicable_    | From [@BotFather](https://t.me/BotFather) |

`gramstax` targets `esnext` and uses Bun APIs (e.g. `Bun.serve` for webhooks), so **Bun is the primary runtime**. The repo is an Nx monorepo; this guide covers the `packages/gramstax` library and a local bot that consumes it.

## Installation

<CodeGroup>

```bash Consume gramstax in your own bot
bun add gramstax
```

```bash Work on gramstax itself
# From the monorepo root
git clone <repo-url>
cd gramstax
bun install
```

</CodeGroup>

<Note>
  `gramstax` depends on the Telegram client it is built on, so that package arrives
  with this install. Adding it yourself is not required, and a separately declared
  range can resolve to a version `gramstax` was not tested against.
</Note>

## Configuration

An application is configured entirely through `gramstax.config.ts` at the project
root: a default export annotated `: GramstaxConfig`, whose twenty fields are all
optional. The CLI loads that file, materializes each ref slot, and constructs the
bot. `token` has no default, and `deploy` falls back to `polling`.

Config files hold refs and plain data, never instances. `cacheSession` takes
`{store, ttlMs?, namespace?}` or a module ref, not a `CacheExternal`; `log` takes a
boolean, a module ref, or `{pathFile, force, formatTime}`, not a logger instance.
Instances belong to `IGramstaxParams`, which is the constructor input and not a
config field at all.

Every field, with its type and default, is in the
[configuration reference](/guides/configuration).

## Running Locally

The simplest local setup uses **polling** (no public URL needed). The bot is
constructed by the CLI from `gramstax.config.ts`. There is no `src/index.ts` and
no hand-written `new Gramstax({...})` entry point:

```typescript
// gramstax.config.ts
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN,
  deploy: `polling`
}

export default config
```

```bash
# Run with Bun: the CLI resolves TypeScript paths and the ~ alias
BOT_TOKEN="123456:ABC…" bun --bun gramstax start
```

<Warning>
  `Gramstax` has no `start()` method. Construction *is* boot. The CLI
  discovers the `Gramstax` subclass at `src/core/bot.ts`, materializes each ref
  slot, constructs it, and the bot is running. Only `stop()` exists.
</Warning>

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

<Warning>
  The export must be named. `export default class` breaks discovery:
  `PageManager._getFile` only reads the first named export
  (`page/manager.ts:56`) and throws without one.
</Warning>

### Webhook / serverless / test

<Tabs>
  <Tab title="Webhook">
    ```typescript
    // gramstax.config.ts: the branch must be named after `deploy`
    {
      deploy: `webhook`,
      optionsDeploy: {
        webhook: {url: `https://example.com/bot`, secretToken: process.env.BOT_WEBHOOK_SECRET}
      }
    }
    ```
  </Tab>

  <Tab title="Serverless">
    ```typescript
    {
      deploy: `serverless`,
      optionsDeploy: {
        serverless: {
          adapter: `cloudflare-mod`, // or `aws-lambda-async`
          url: `https://example.com/bot`,
          secretToken: process.env.BOT_WEBHOOK_SECRET
        }
      }
    }
    ```
  </Tab>

  <Tab title="Test">
    ```typescript
    {deploy: `test`} // E2E mode: MockTelegramServer stands in for the Bot API
    ```
  </Tab>
</Tabs>

## Verifying It Works

```bash
# From the monorepo root: run the package's unit tests
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
| Keyboard bindings don't work                            | A `<g-base id="x">` is defined but `AGBaseId` isn't passed to the keyboard builder. | Pass the same `id` to `bottomKeyboardT`/`inlineKeyboardT` (`types/ctx.ts` warns about this).           |
| Changes to templates not reflected                      | `enableWatch` is off or the file extension isn't `.html`/`.ts`/`.js`.               | Set `templateManager: {enableWatch: true}` (`TemplateManager._supportedExtensions`, `manager.ts:87`).    |
| Redis session errors                                    | Wrong `cacheSession` URL.                                                           | Use `new CacheExternal("redis://host:port")` or omit for in-memory (`cache/external.ts:64`).             |

## Next Steps

<Columns cols={3}>
  <Card title="Quickstart" icon="zap" href="/quickstart">
    The same ground in five minutes, one command at a time.
  </Card>
  <Card title="Example bots" icon="boxes" href="/guides/examples">
    Eleven runnable bots, numbered as a teaching sequence.
  </Card>
  <Card title="Configuration reference" icon="settings" href="/guides/configuration">
    Every `gramstax.config.ts` field and what it does.
  </Card>
  <Card title="Development" icon="code" href="/guides/development">
    Learn how to contribute
  </Card>
  <Card title="Architecture" icon="layers" href="/guides/architecture">
    Understand the system design
  </Card>
  <Card title="Decisions" icon="git-branch" href="/guides/adr/index">
    Why the framework is built this way
  </Card>
</Columns>
