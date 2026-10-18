---
title: Quickstart
description: From an empty directory to a running Telegram bot in five minutes.
---

# Quickstart

This page gets you from nothing to a bot answering messages. It assumes Node 18+
and a Telegram bot token from [@BotFather](https://t.me/BotFather).

## 1. Scaffold

```bash
bunx create-gramstax my-bot
cd my-bot
```

The generator writes a complete project: `gramstax.config.ts`, a `Gramstax`
subclass at `src/core/bot.ts`, seven pages under `src/pages`, base classes in
`src/base`, a guard in `src/guards`, an LMDB database layer in `src/db`, and nine
e2e tests under `e2e/`.

Copy `.env.example` to `.env` and set `BOT_TOKEN` to the token BotFather gave
you.

## 2. Look at the page you got

`src/pages/start/index.ts` is the whole routing model in one file — the route
`start` is the path `src/pages/start/index.ts`.

```ts
export default class extends PageBase {
  static template = `<g-message>Hello {{name}}. Pick a number:</g-message><g-keyboard><g-button callback="start/random/number">{{number}}</g-button></g-keyboard>`
  handleCommandText() {
    this.renderText({args: [`Enter your name`]})
  }
}
```

Two things are worth noticing before you write anything:

- **There is no `sendMessage` call.** The template says what the message
  contains; `renderText` says it should go out. The route decides the Bot API
  method.
- **There is no `bot.command("start", …)` registration.** The file path *is*
  the route.

## 3. Run it

```bash
bun --bun gramstax start
```

Bun is required — the CLI resolves TypeScript paths and the `~` alias, which
plain Node cannot.

## 4. Add a page

Create `src/pages/hi.ts`. The route becomes `hi`, with no table to update.

```ts
import {PageBase} from "../../src/base/page"

export default class extends PageBase {
  static template = `<g-message>Hi.</g-message>`
  handleCommandText() {
    this.renderText({args: [`Hi.`]})
  }
}
```

Send `/hi` to your bot. Nothing else needed.

## 5. Check it works before you ship it

The scaffold ships e2e tests that drive the compiled template against an in-process
mock of the Telegram API — no network, no token.

```bash
bun test e2e/
```

Add one next to it and you are testing the same thing your users get.

## Where to go next

- [Page routing](/concepts/page-routing) — how a filename becomes a route
- [The render contract](/concepts/render-contract) — why `renderText` is not
  `sendMessage`
- [Templates](/concepts/templates) — the block vocabulary
- [Deploy](/concepts/deploy) — moving off polling