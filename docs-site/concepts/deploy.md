---
title: Deploy
description: Five deploy modes, nested options branches, and what each one costs you.
---

# Deploy

One field selects the mode. Its settings live in `optionsDeploy`, in nested
branches named after the mode.

```ts
const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN,
  deploy: `webhook`,
  optionsDeploy: {
    polling: undefined,
    webhook: {url: `https://example.com/hook`, secretToken: process.env.BOT_WEBHOOK_SECRET},
    serverless: undefined,
    raw: undefined,
    test: undefined
  }
}
```

## The branch rule

**At most one branch may be non-empty, and it must equal `deploy`.**

This is enforced, not documented-and-hoped-for. Setting `deploy: "webhook"` while
`serverless` holds the settings throws at boot — so the config cannot claim one
mode and silently run another. `webhook` requires both `url` and `secretToken`.

The old `webhook:<url>` colon grammar is gone and throws.

## The five modes

### `polling`

Long polling, and the default. Nothing to expose, nothing to terminate.

The queue is opt-in. Without it, updates drain sequentially exactly as they
always did. With `optionsDeploy.polling.queue` enabled you get bounded
concurrency — at a 600 users/s target the sequential drain fell to 377 users/s at
p95 1828 ms, while the queue sustained 601 users/s at p95 124 ms. Turning it on
is not a default change; you opt into it when you have measured a reason.

### `webhook`

You expose an HTTP endpoint; Telegram posts to it. Requires `url` and
`secretToken` — the secret is verified per request, so an endpoint without it is
a public endpoint that will drive your bot.

### `serverless`

Keyed by adapter: `cloudflare-mod` or `aws-lambda-async`. Also requires `url`
and `secretToken`.

<Warning>
  Keep the secret out of `gramstax.config.ts`. It comes only from the
  `BOT_WEBHOOK_SECRET` runtime binding — `wrangler secret put BOT_WEBHOOK_SECRET`
  — never as a literal in a file that gets committed.
</Warning>

This is the **only** mode that auto-loads `.gramstax/` — the output of
`gramstax build`. Polling, webhook and test boot from the filesystem, because
they have a filesystem. A serverless isolate does not, so the frozen artifact is
what gets loaded.

Manifest boot goes further and needs no directory at all: pass `manifest:
IAppManifest` to skip scanning. See [serverless deploy](/guides/serverless-deploy).

### `raw`

A bare grammY `Bot` — no pages, no templates, no Gramstax routing, no
auto-start. Write raw grammY handlers on `bot.bot` and start it yourself.

This is the supported way to use gramstax as a dependency without adopting its
model. The legacy `templateManager: {} as any` escape hatch was removed; using it
outside raw mode now throws.

### `test`

What the e2e suite runs against, with `MockTelegramServer` standing in for the
Bot API. No network, no token, real compiled templates.

## The build

```bash
gramstax build [--target cloudflare-mod|aws-lambda-async] [--bundle] [--dry-run] [--raw]
```

Freezes `src/pages` into `.gramstax/`: `routes.json`, `manifest.js`, AOT output
under `gen/`, and a `server/` entry per target. AOT always runs — there is no
`--aot` flag.

Run it with `bun --bun` like the rest of the CLI; plain Node cannot resolve the
TypeScript paths.

## Observability

An in-process `MetricsStore` counts every outcome — `matched`, `noMatch`,
`noHandler`, `blocked`, `timeouts`, `skippedDuplicate`, `skippedValidation`,
`dropped` — as JSON at `GET /stats` and Prometheus exposition text at
`GET /metrics`.

`blocked` is the one to watch: it counts updates a session lock refused because
another instance held the lease. On a single instance it should be zero; if it
is not, two instances are serializing the same user.