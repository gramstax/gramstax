---
title: Configuration reference
description: Every gramstax.config.ts field, what it does, and when you should reach for it.
icon: settings
---

# Configuration reference

`gramstax.config.ts` holds twenty fields. All are optional (a missing file yields
`{deploy: "polling"}`), and anything else throws `unknown field` with the list of
supported keys.

<Note>
  The config file holds **refs and plain data, never instances**. `cacheSession`
  takes `{store, ttlMs?, namespace?}` or a module ref, not a constructed
  `CacheExternal`. The CLI materializes each slot and `instanceof`-checks it. The
  one exception is the programmatic constructor, which takes instances: see
  [Constructor params](#constructor-params).
</Note>

## Identity

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `token` | `string` | _none_  | The bot token **value**, not a variable name. `""` is accepted at load so `process.env.BOT_TOKEN ?? ""` typechecks; `gramstax start` then throws `Token is not valid or empty`. |
| `deploy` | `string` | `polling` | The mode. Plain `string`, not a literal union, so `process.env.DEPLOY ?? "polling"` typechecks: membership is enforced by the loader, not the type. CLI `--deploy` wins. |

<Tip>
  `token` holding the value rather than the name is deliberate: the framework
  cannot tell a literal from an env-derived string, so a literal in this file is a
  committed secret. See [gramstax start](/guides/gramstax-start).
</Tip>

## Deploy

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `optionsDeploy` | object | _none_ | Per-mode settings in nested branches. At most one branch may be non-empty and it must equal `deploy`; unknown branches and unknown fields inside a branch are rejected. |

Full branch tables are in [Deploy](/concepts/deploy) and
[gramstax start](/guides/gramstax-start).

## Reliability

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `autoRetry` | `boolean` | `true` | Mounts the auto-retry plugin, which absorbs Telegram rate limits by retrying failed requests. |
| `autoRetryOptions` | object | _none_ | `maxRetryAttempts` (≥ 1) and `retryOnInternalServerErrors`. Unknown keys are rejected. |
| `updateTimeoutMs` | `number` | `30000` | How long a single handler may run before the update is treated as timed out. It does not cancel the handler: the update is only marked. |
| `skipDuplicateUpdate` | `boolean` | `false` | Drops an update whose `update_id` was already handled. This is the one to reach for on webhook retries, where Telegram may deliver the same update more than once. |
| `maxTextLength` | `number` | `0` | Caps incoming `message.text` / `message.caption`; longer updates are skipped. `0` disables the check. |
| `rateLimit` | object | _none_ | Inbound limit. Both `windowMs` and `max` are required. See below. |

### Rate limiting

`rateLimit` mounts `@grammyjs/ratelimiter` with `timeFrame: windowMs` and
`limit: max`. `windowMs` is the length of a **fixed** window in milliseconds (
handed to the middleware unchanged), and `max` is how many updates a single key
may send inside one such window. Both are required.

The key is the sender's user id, `ctx.from?.id?.toString()`. The limit is
therefore per user rather than per chat, and an update that carries no `from`
yields no key at all. Override `hookKeyGenerator` to bucket differently (per
chat, per session, one shared global bucket). It must be synchronous: the key is
read before the update is dispatched, so there is nothing to await.

Past the limit the update is dropped, and by default that is completely silent.
`hookRateLimited` is optional and the framework ships no implementation, so a
bot that sets `rateLimit` and nothing else simply stops answering a flood. The
hook is what turns the drop into a message:

```typescript
class MyBot extends Gramstax {
  override async hookRateLimited(ctx: Ctx) {
    await ctx.reply(`Slow down.`)
  }
}
```

The hook is fired and not awaited: the middleware hands off to it and returns.
What the context carries is worth being precise about: it is built by
`createCtx`, the same factory the routing path uses, and is memoized per
incoming update, so it holds the full scope (`templateManager`, `cacheSession`,
`cacheKeyboard`, `log`, `mediaRoots`) and every `render*` helper. It is **not**
bound to a page: `temp.data` starts empty, so there is no page template behind
a template-backed render. Prefer a plain `ctx.reply` in this hook.

## Outgoing load

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `throttle` | object | _none_  | Outgoing throttling via `@grammyjs/transformer-throttler`. Bottleneck buckets: `global`, `group`, `out`. Composes with `autoRetry` rather than replacing it. |

<Note>
  `rateLimit` is inbound and `throttle` is outbound. They solve opposite problems
  and are frequently confused: `rateLimit` protects your bot from a chatty user,
  `throttle` protects the Bot API from your bot.
</Note>

## Storage and caches

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `cacheSession` | ref \| builtin | `memory` | `{"store", "ttlMs"?, "namespace"?}`, or a module ref to a `CacheExternal` subclass. `memory` is in-process; any store URL starting with `redis` (`redis://…`, `rediss://…`) is shared across instances. |
| `cacheKeyboard` | ref \| array \| object | internal `Map` | Keyboard memoization. Accepts a module ref to a `Map` subclass, an entries array, or a plain object. |
| `sessionLock` | object | off | Distributed lease for multi-instance deployments. `enabled`, `leaseMs`, `onContended` (`skip` \| `wait` \| `serialize`), `key`. **Redis only**: the lock is enabled only when the session store is a `KeyvRedis` instance, so any other store, the built-in `memory` store or a custom one, auto-disables it with a warning. |

## Templates and media

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `templateManager` | ref \| builtin | `new TemplateManager({path: [<cwd>/src/pages]})` | Usually left alone. Set it only to share one manager across several page directories. Accepts a module ref to a `TemplateManager` subclass, or `{path}` with a non-empty array. |
| `mediaRoots` | `string[] \| null` | `null` | A local-path jail for media uploads. `undefined`, `null` and `[]` all leave it **off**; a non-empty array only allows paths resolving under one of the roots. |

<Warning>
  `mediaRoots` off is not the same as permissive: it is simply not enforced. With
  no roots there is no local-path jail at all, so a `file` input resolved from
  user input can reach outside the project. Set it whenever you accept uploads from
  a public bot.
</Warning>

## Observability

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `statusServerPort` | `number` | _none_ | An extra HTTP port serving `GET /health`, `GET /stats` and `GET /metrics` in **any** deploy mode. Unset, `/health` and `/stats` remain available on the webhook server; `/metrics` does not. |
| `statusServerHostname` | `string` | `127.0.0.1` | Bind address for that server. |
| `log` | boolean \| ref \| object | silent when omitted | `true` mounts the default logger, `false` stays silent, a module ref resolves to a `LoggingHelper`, or pass `{pathFile?, force?, formatTime?}`. Unknown fields are rejected. |

### `GET /metrics`

`GET /metrics` serves Prometheus exposition text as `text/plain; version=0.0.4`
from the same `MetricsStore` that backs `GET /stats`. It emits:

- `gramstax_updates_total{listener="…"}`: one series per listener name.
- One series per outcome, named by joining the metric prefix to the outcome and a
  `_total` suffix: `gramstax_updates_matched_total`, `gramstax_updates_blocked_total`,
  and the rest. The outcome names are `updatesTotal`, `updatesFailed`, `matched`,
  `noMatch`, `noHandler`, `blocked`, `timeouts`, `skippedDuplicate`,
  `skippedValidation` and `dropped`.
  Counters sitting at zero are skipped rather than emitted as `0`, so an absent
  series means "never happened" and a metric that should be present has not yet
  fired.
- `gramstax_update_duration_ms{quantile="avg"|"max"}`: handler latency, and
  only once at least one dispatch has completed.
- `gramstax_uptime_seconds`.

Queue depth adds four gauges (`gramstax_queue_length`, `gramstax_queue_max_size`,
`gramstax_queue_waiting_enqueue` and `gramstax_queue_waiting_dequeue`), each
emitted only when its field is defined, so a partially populated snapshot is
omitted rather than zero-filled.

Those four come from the **webhook** queue only. A polling deployment serves
`/metrics` with no queue series at all, and a webhook deployment whose queue is
disabled serves none either, because the route reads the live `UpdateQueue`
instance and passes `null` when there is no instance. Use
`getPollingQueueStats()` or `getWebhookQueueStats()` for the other mode; both
return `null` while their queue is off.

When a webhook secret token is configured, `/stats` and `/metrics` answer `401`
unless the request carries a matching `X-Telegram-Bot-Api-Secret-Token` header.

## Behaviour

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `optionsPage` | `{shortCallbackQueryData?}` | flag off (`shortCallbackQueryData: false`) | Numeric callback ids instead of names. Shrinks callback payloads, at the cost of the callback data no longer being readable in the Telegram UI. |
| `botConfig` | `BotConfig` | _none_  | Forwarded to the client (`apiRoot` and friends). Use it for a self-hosted Bot API server. |

## Constructor params

`new Gramstax(params)` takes **instances**, not refs, and adds one field the
config file cannot carry:

| Field | Difference from the config file |
| --- | --- |
| `cacheSession`, `cacheKeyboard`, `templateManager`, `log` | Pass the constructed instance, not a ref or builtin form. |
| `manifest` | **Rejected** in the config file with `unknown field`. It is constructor-only: it skips directory scanning entirely for a fs-less boot. |
| `token`, `deploy` | Required here, optional on the config type. |

This is the one place the two shapes diverge, and it is deliberate: the CLI can
resolve a module path, and your own code already has the object.

## Validation is strict on purpose

Most fields reject unknown siblings rather than ignoring them. A misspelled key
fails at boot with the supported keys named, instead of silently leaving you on the
default and wondering why your cache is empty. Two fields are passed through
instead: `throttle` is checked only to be an object, and `botConfig` is a grammY
`BotConfig` forwarded as-is.