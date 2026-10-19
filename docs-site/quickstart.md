---
title: Quickstart
description: From an empty directory to a running Telegram bot in five minutes.
icon: zap
---

# Quickstart

This page gets you from nothing to a bot answering messages. It assumes Node 18+
and a Telegram bot token from [@BotFather](https://t.me/BotFather).

<Steps>
  <Step title="Scaffold the project">
    ```bash
    bunx create-gramstax my-bot
    cd my-bot
    ```

    The generator writes a complete project: `gramstax.config.ts`, a `Gramstax`
    subclass at `src/core/bot.ts`, seven pages under `src/pages`, base classes in
    `src/base`, a guard in `src/guards`, an LMDB database layer in `src/db`, and
    nine e2e tests under `e2e/`.
  </Step>

  <Step title="Give it a token">
    Copy `.env.example` to `.env` and set `BOT_TOKEN` to the token BotFather gave
    you.

    ```bash
    cp .env.example .env
    ```
  </Step>

  <Step title="Read the page you got">
    `src/pages/start/index.ts` is the whole routing model in one file. The route
    `start` is the path `src/pages/start/index.ts`.

    ```ts
    export default class extends PageBase {
      static template = `<g-message>Hello {{name}}. Pick a number:</g-message><g-keyboard><g-button callback="start/random/number">{{number}}</g-button></g-keyboard>`
      handleCommandText() {
        this.renderText({args: [`Enter your name`]})
      }
    }
    ```

    Two things are worth noticing before you write anything.

    **There is no `sendMessage` call.** The template says what the message
    contains; `renderText` says it should go out, and the route decides which
    Telegram method that becomes. See [the render
    contract](/concepts/render-contract).

    **There is no `bot.command("start", …)` registration.** The file path *is* the
    route. See [page routing](/concepts/page-routing).
  </Step>

  <Step title="Run it">
    ```bash
    bun --bun gramstax start
    ```

    <Warning>
      Bun is required. The CLI resolves TypeScript paths and the `~` alias, which
      plain Node cannot (running it under `node` fails at import).
    </Warning>
  </Step>

  <Step title="Add a page">
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
  </Step>

  <Step title="Check it works before you ship it">
    The scaffold ships e2e tests that drive the compiled template against an
    in-process mock of the Telegram API: no network, no token.

    ```bash
    bun test e2e/
    ```

    <Tip>
      Add one next to it and you are asserting on the same compiled output your
      users get, not on a mock's echo. See [E2E
      testing](/guides/e2e-testing).
    </Tip>
  </Step>
</Steps>

## Where to go next

<Columns cols={2}>
  <Card title="Page routing" icon="route" href="/concepts/page-routing">
    How a filename becomes a route, and how handlers bind to it.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    Why `renderText` is not `sendMessage`, and why the wrong key is a compile error.
  </Card>
  <Card title="Templates" icon="code" href="/concepts/templates">
    The block vocabulary, filters, and per-block languages.
  </Card>
  <Card title="Deploy" icon="rocket" href="/concepts/deploy">
    Five modes, and moving off polling.
  </Card>
  <Card title="Configuration reference" icon="settings" href="/guides/configuration">
    Every `gramstax.config.ts` field, and when you should reach for it.
  </Card>
  <Card title="Example bots" icon="boxes" href="/guides/examples">
    The runnable bots under `example/`, and which files to read in each one.
  </Card>
</Columns>