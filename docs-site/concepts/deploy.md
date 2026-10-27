---
title: Deploy
description: Five deploy modes, nested options branches, and what each one costs you.
icon: globe
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

The loader enforces this at boot. Setting `deploy: "webhook"` while `serverless`
holds the settings throws, so the config cannot claim one mode and silently run
another. `webhook` requires both `url` and `secretToken`.

The old `webhook:<url>` colon grammar is gone and throws.

## The five modes

### `polling`

Long polling, and the default. Nothing to expose, nothing to terminate.

The queue is opt-in. Without it, updates drain sequentially. With
`optionsDeploy.polling.queue` enabled you get bounded concurrency, and the
per-chat gate still keeps one chat's updates in order. Turning it on is not a
default change; measure your own traffic first. The bundled benchmark at
`packages/gramstax/bench/bench.ts` compares both modes.

### `webhook`

You expose an HTTP endpoint; Telegram posts to it. It requires `url` and
`secretToken`. The bot refuses to boot without the secret, and every request is
checked against it; a mismatch returns 401.

### `serverless`

Keyed by adapter: `cloudflare-mod` or `aws-lambda-async`. Also requires `url`
and `secretToken`.

<Warning>
  Keep the secret out of `gramstax.config.ts`. It comes only from the
  `BOT_WEBHOOK_SECRET` runtime binding (`wrangler secret put BOT_WEBHOOK_SECRET`),
  never as a literal in a file that gets committed.
</Warning>

This is the **only** mode that auto-loads `.gramstax/`, the output of
`gramstax build`. Polling, webhook and test boot from the filesystem, because
they have a filesystem. A serverless function does not, so the frozen artifact
is what gets loaded.

Manifest boot goes further and needs no directory at all: pass `manifest:
IAppManifest` to skip scanning. See [serverless deploy](/guides/serverless-deploy).

### `raw`

A bare `Bot` instance: no pages, no templates, no Gramstax routing, no
auto-start. Write raw handlers on `bot.bot` and start it yourself.

Raw is not a blank slate. By the time the branch is reached, the constructor has
already mounted `autoRetry`, `stream()`, the rate limiter, the throttler,
`hydrateFiles`, `bot.catch` and the `SIGINT`/`SIGTERM` handlers. What the branch
skips is the page, template and routing setup, the built-in listeners and the
deploy loop, and it calls `hookBeforeStart` only: `hookAfterStart` never fires,
because nothing ever starts.

This is the supported way to use gramstax as a dependency without adopting its
model. The legacy `templateManager: {} as any` escape hatch was removed; using it
outside raw mode throws.

### `test`

What the e2e suite runs against: `E2eHelper` intercepts the Bot API in-process,
with no HTTP server and no token, over real compiled templates.

<Frame caption="One field, one branch. `serverless` is the only mode that loads the frozen `.gramstax/` output; polling, webhook and test boot from the filesystem, because they have one.">
  <img
    src="/images/deploy-modes.svg"
    alt="At the top, a gramstax.config.ts sketch with deploy set to webhook and the five optionsDeploy branches beneath it, polling, webhook, serverless, raw and test, with webhook lit and the rest dimmed. A warning panel states that at most one branch may be non-empty and it must equal deploy. Below, a five row table lists each mode, what its branch requires and what it loads: polling needs nothing and loads the filesystem; webhook needs url and secretToken and loads the filesystem; serverless needs url, secretToken and one of the cloudflare-mod or aws-lambda-async adapter keys and is the only row that loads .gramstax; raw loads nothing; test loads the filesystem."
  />
</Frame>

## The build

```bash
gramstax build [--target cloudflare-mod|aws-lambda-async] [--bundle] [--dry-run] [--raw]
```

Freezes `src/pages` into `.gramstax/`: `routes.json`, `manifest.js`, AOT output
under `gen/`, and a `server/` entry per target. AOT always runs. There is no
`--aot` flag.

Run it with `gramstax build`; the published bin uses Bun, which resolves the
TypeScript paths. The CLI also loads project-root `.env*` files
automatically before importing the config.

## Observability

An in-process `MetricsStore` keeps ten counters: `updatesTotal`,
`updatesFailed`, `matched`, `noMatch`, `noHandler`, `blocked`, `timeouts`,
`skippedDuplicate`, `skippedValidation` and `dropped`. The webhook server and
the optional status server expose the snapshot as JSON at `GET /stats`.
Prometheus text at `GET /metrics` is available when `statusServerPort` is set.

`blocked` counts two things: a session-lock refusal because another instance held
the lease, and a `hookBeforeRoute` gate that returned `false`. On a single
instance, a non-zero value usually means your access gate fired, not that two
instances are racing.