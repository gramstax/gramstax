---
title: gramstax
description: Page-based routing and a template system for Telegram bots, built on grammY.
---

# gramstax

A modern Telegram bot framework built around page-based routing and a powerful
template system.

Two ideas carry most of the design. **Pages are the routing unit** — a file under
`src/pages` is a route, and the filename decides how an update reaches it.
**Rendering is declared, not imperative** — a template says what a message
should contain, and the render call names a route; the framework works out which
Bot API method that route implies.

## Install

```bash
bun add gramstax
```

## The shape of an app

```bash
bunx create-gramstax my-bot
cd my-bot
bun --bun gramstax start
```

There is no `src/index.ts` and no hand-written `new Gramstax({...})` entry.
Every project has a `gramstax.config.ts` at its root, and the framework is
constructed at startup — construction *is* boot.

## Deploy

`deploy` selects the mode, and `optionsDeploy` carries its settings in a nested
branch named after that mode:

| Mode | What it is |
| --- | --- |
| `polling` | Long polling, the default. |
| `webhook` | An HTTP endpoint you expose, with a `secretToken`. |
| `serverless` | Cloudflare Modules or AWS Lambda async. |
| `raw` | A bare grammY bot — no pages, no templates, no routing. |

## Where to go next

- **API reference** — every exported symbol, generated from the TypeScript
  declarations by api-extractor.
- **Templates** — `<g-*>` page blocks and the 54 Telegram Rich HTML tags, with
  their required attributes and value formats.
- **The render contract** — why `renderText()` takes `editOptions` but
  `renderMedia()` takes `mediaOptions`, and what the 13 route unions mean.

<CardGroup cols={2}>
  <Card title="API reference" icon="code" href="/reference/gramstax">
    1,000+ generated pages, grouped by class and type.
  </Card>
  <Card title="Source on GitHub" icon="github" href="https://github.com/gramstax/gramstax">
    Apache-2.0. Issues and pull requests welcome.
  </Card>
</CardGroup>