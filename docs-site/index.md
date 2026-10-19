---
title: gramstax
description: Page-based routing and a template system for Telegram bots.
icon: compass
---

# gramstax

A modern Telegram bot framework built around page-based routing and a powerful
template system.

Two ideas carry most of the design.

**Pages are the routing unit.** A file under `src/pages` *is* a route: the
filename decides how an update reaches it. There is no router to register, so
adding a page cannot break an unrelated one.

**Rendering is declared, not imperative.** A template says what a message
should contain, and the render call names a route; the framework works out which
Bot API method that route implies.

```bash
bun add gramstax
```

<CardGroup cols={2}>
  <Card title="Quickstart" icon="rocket" href="/quickstart">
    A running bot in five minutes: scaffold, edit one page, run it.
  </Card>
  <Card title="Page routing" icon="route" href="/concepts/page-routing">
    How a filename becomes a route, and how `handle*` methods bind to it.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    Why a key the winning route would ignore is a compile error, not a silent drop.
  </Card>
  <Card title="Templates" icon="code" href="/concepts/templates">
    29 page blocks, 54 Telegram Rich HTML tags, filters, and per-block languages.
  </Card>
  <Card title="Deploy" icon="server" href="/concepts/deploy">
    Polling, webhook, serverless, raw, test: one field selects the mode.
  </Card>
  <Card title="E2E testing" icon="check" href="/guides/e2e-testing">
    Assert on the compiled template against an in-process Telegram API.
  </Card>
</CardGroup>

## The shape of an app

There is no `src/index.ts` and no hand-written `new Gramstax({...})` entry.
Every project has a `gramstax.config.ts` at its root, and the framework is
constructed at startup. Construction *is* boot.

```bash
bunx create-gramstax my-bot
cd my-bot
bun --bun gramstax start
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
    You expose an HTTP endpoint and Telegram posts to it. Requires `url` and
    `secretToken`; the secret is verified per request, so an endpoint without one
    is a public endpoint driving your bot.
  </Tab>
  <Tab title="serverless">
    Cloudflare Modules or AWS Lambda async. The only mode that auto-loads the
    frozen `.gramstax/` artifact, because a serverless isolate has no filesystem
    to scan.
  </Tab>
  <Tab title="raw">
    A bare `Bot` instance: no pages, no templates, no routing, no auto-start.
    The supported way to use gramstax as a dependency without adopting its model.
  </Tab>
</Tabs>

## API reference

Every exported symbol, generated from the TypeScript declarations and kept in
step by CI: 1,032 pages grouped by class and type.

<Card title="Browse the reference" icon="code" href="/reference/gramstax">
  `Ctx`, `Gramstax`, `TemplateEngine`, every `render*()` method, and the 12 route
  unions behind them.
</Card>

## The trade, stated plainly

The block vocabulary is a constraint. `<g-script>` is rejected by ahead-of-time
compilation, because it compiles to `with(data …)` and ESM forbids that; logic
belongs in the page class, returning plain data.

In exchange you get pages that fail at build rather than at send, markup a
non-programmer can translate, and assertions a test can make against real output.
[Why this design](/introduction) sets out who it suits and who it does not.

<CardGroup cols={2}>
  <Card title="Source on GitHub" icon="github" href="https://github.com/gramstax/gramstax">
    Apache-2.0. Issues and pull requests welcome.
  </Card>
  <Card title="Architecture decisions" icon="book" href="/guides/adr/index">
    The eight ADRs behind the choices, including what each one cost.
  </Card>
</CardGroup>