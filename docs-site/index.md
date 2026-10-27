---
title: gramstax
description: Page-based routing and a template system for Telegram bots.
icon: compass
---

# gramstax

A Telegram bot framework built around page-based routing and a template system.

Two ideas carry most of the design.

**Pages are the routing unit.** A file under `src/pages` *is* a route: the
filename decides how an update reaches it. There is no router to register, and
adding a page cannot change how an unrelated page routes at runtime. A duplicate
page name or intent is still caught at boot and stops the whole app.

**Rendering is declared, not imperative.** A template says what a message
should contain, and the render call names a route; the framework works out which
Bot API method that route implies.

```bash
bun add gramstax
```

Gramstax apps run on Bun: the `gramstax` CLI, project boot, `~/*` aliases, webhook/status server, and build all require it.

## Start here

<Columns cols={2}>
  <Card title="Quickstart" icon="rocket" href="/quickstart">
    A running bot in five minutes: scaffold, edit one page, run it.
  </Card>
  <Card title="Introduction" icon="book" href="/introduction">
    What gramstax is, what it removes, and who it is for.
  </Card>
  <Card title="Configuration reference" icon="settings" href="/guides/configuration">
    Every `gramstax.config.ts` field, what it does, and when you should reach for it.
  </Card>
  <Card title="API reference" icon="terminal" href="/reference/gramstax">
    Every exported symbol, grouped by class and type, kept in step by CI.
  </Card>
</Columns>

## The model

<Columns cols={2}>
  <Card title="Page routing" icon="route" href="/concepts/page-routing">
    How a filename becomes a route, and how `handle*` methods bind to it.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    Why a key the winning route would ignore is a compile error, not a silent drop.
  </Card>
  <Card title="Templates" icon="code" href="/concepts/templates">
    30 page blocks, 54 Telegram Rich HTML tags, filters, and per-block languages.
  </Card>
  <Card title="Deploy" icon="server" href="/concepts/deploy">
    Polling, webhook, serverless, raw, test: one field selects the mode.
  </Card>
</Columns>

## The shape of an app

There is no `src/index.ts` and no hand-written `new Gramstax({...})` entry.
Every project has a `gramstax.config.ts` at its root, and the framework is
constructed at startup. Construction *is* boot.

```bash
bunx create-gramstax my-bot
cd my-bot
gramstax start
```

## Deploy

`deploy` selects the mode, and `optionsDeploy` carries its settings in a nested
branch named after that mode. At most one branch may be non-empty, and it must
equal `deploy`.

<Tabs>
  <Tab title="polling">
    The default. Long polling, nothing to expose, nothing to terminate. The
    concurrency queue is opt-in and only worth turning on once you have measured
    a reason (see [Deploy](/concepts/deploy)).
  </Tab>
  <Tab title="webhook">
    You expose an HTTP endpoint and Telegram posts to it. It requires `url` and
    `secretToken`. The bot refuses to start without the secret, and every request
    is checked against it; a mismatch returns 401.
  </Tab>
  <Tab title="serverless">
    Cloudflare Modules or AWS Lambda async. The only mode that auto-loads the
    frozen `.gramstax/` artifact, because a serverless function has no filesystem
    to scan.
  </Tab>
  <Tab title="raw">
    A bare `Bot` instance: no pages, no templates, no routing, no auto-start.
    The supported way to use gramstax as a dependency without adopting its model.
  </Tab>
</Tabs>

## API reference

The public API is documented in a generated reference: 1,495 pages across the
three published packages. CI regenerates it from the TypeScript declarations.

<Card title="Browse the reference" icon="code" href="/reference/gramstax">
  `Ctx`, `Gramstax`, `TemplateEngine`, every `render*()` method, and the 12 route
  unions behind them.
</Card>

## The trade, stated plainly

The block vocabulary is a constraint. `<g-script>` is rejected by ahead-of-time
compilation, because it compiles to `with(data …)` and ESM forbids that; logic
belongs in the page class, returning plain data.

In exchange, template mistakes surface before a user triggers them: at build
time for AOT, at load time otherwise. The markup is readable by a translator, and
a test can assert against the real output.
[Why this design](/introduction) sets out who it suits and who it does not.

## Where to go next

<Columns cols={2}>
  <Card title="Example bots" icon="boxes" href="/guides/examples">
    The runnable bots under `example/`, and which files to read in each one.
  </Card>
  <Card title="E2E testing" icon="check" href="/guides/e2e-testing">
    Assert on the compiled template against an in-process Telegram API.
  </Card>
  <Card title="Serverless deploy" icon="cloud" href="/guides/serverless-deploy">
    The build, secret, and deploy workflow for Cloudflare Workers and AWS Lambda.
  </Card>
  <Card title="Architecture" icon="layers" href="/guides/architecture">
    How gramstax is put together, from update intake through routing and cache.
  </Card>
  <Card title="Source on GitHub" icon="github" href="https://github.com/gramstax/gramstax">
    Apache-2.0. Issues and pull requests welcome.
  </Card>
  <Card title="Architecture decisions" icon="book" href="/guides/adr/index">
    The eight ADRs behind the choices, including what each one cost.
  </Card>
</Columns>