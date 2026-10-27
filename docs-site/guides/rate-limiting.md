---
title: Rate limiting
description: The two throttles gramstax mounts, the hooks that decide who gets limited and what happens next, and why the count of a blocked update never reaches /metrics.
icon: gauge
---

# Rate limiting

A Telegram bot has two distinct pressure problems and gramstax gives each one its
own knob. The first is inbound: a user, or a script, sending faster than your bot
should answer. The second is outbound: the bot itself sending faster than Telegram
will accept. They are configured with two different top-level fields, they run in
two different directions, and they fail in two different ways.

| Field | Direction | What it throttles | Mounted as |
| :---- | :-------- | :---------------- | :--------- |
| `rateLimit` | In | Updates entering the router | `@grammyjs/ratelimiter` middleware on the bot |
| `throttle` | Out | Calls leaving to the Bot API | `@grammyjs/transformer-throttler` on the API client |

Both are optional and both are off unless you set them. Neither appears inside
`optionsDeploy`: they are top-level fields of `gramstax.config.ts`, described in
[configuration](/guides/configuration).

## Inbound: `rateLimit`

The inbound limiter has exactly two options, and both are required by the type.

```ts
export default {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `polling`,
  rateLimit: {windowMs: 1000, max: 5}
} satisfies GramstaxConfig
```

| Field | Type | Forwarded as | Meaning |
| :---- | :--- | :------------ | :------ |
| `windowMs` | `number` | `timeFrame` | Length of the fixed window in milliseconds |
| `max` | `number` | `limit` | At most this many updates per key per window |

Both are validated at config load. `windowMs` must be a positive number and `max`
must be a positive number, each with a message naming the file and the field. A
non-object, or any key other than `windowMs` and `max`, is rejected by name.

The mapping is literal: `IRateLimitOptions` is the two-field type the framework
declares, and it is passed straight to `limit()` as `timeFrame` and `limit`. There
is no bucket count, no burst allowance, and no per-group configuration. If you need
one of those, mount your own middleware instead.

<Note>
  The config file type and the constructor type agree here. `rateLimit` is
  forwarded to the constructor by `gramstax start` untouched, so a project that
  never opens `gramstax.config.ts` can set the same two options on
  `IGramstaxParams`.
</Note>

### The default is silence

When a key exceeds its limit, the update is dropped. Nothing is logged, nothing is
sent, and no reply is generated. That is the shipped behaviour and it is the right
one for the common case: a user tapping a button in a loop should get no answer
rather than an error every time.

Silence is the absence of a hook, not a feature of it. Override
[`hookRateLimited`](#the-rate-limited-hook) to say something.

## The rate-limited hook

An optional class override. It receives the app scope, but it is not bound to a
page. `ctx.data` is `undefined`, so `renderText()` and `renderMedia()` throw;
use `ctx.reply()` for plain text.

```ts
// src/core/bot.ts
import {Gramstax, type Ctx} from "gramstax"

export class BotCore extends Gramstax {
  override async hookRateLimited(ctx: Ctx) {
    await ctx.reply(`Slow down.`)
  }
}
```

<Warning>
  Keep the override small and do not call a template-backed render here. There
  is no page behind this context, so there is no template to resolve.
</Warning>

The hook is fired without `await` from the middleware's `onLimitExceeded` callback,
so it must not throw: an unhandled rejection there surfaces as an unhandled promise
rejection rather than through the bot's error handling.

### What a limited update never touches

The operational point: **a rate-limited update is invisible to the counters.** The limiter is mounted as middleware during
construction, ahead of gramstax's own routing middleware, so a dropped update never
reaches `_onHandle`. It does not increment `updatesTotal`, it does not increment
`blocked`, and it does not land in `gramstax_updates_*` at all. None of
`hookBeforeRoute`, `hookAfterRoute`, `hookTrace` or `hookUpdate` fire for it.

<Warning>
  `/metrics` will show a perfectly healthy bot answering all of its updates while
  updates are being discarded. The hook fires once per key per window, at the
  moment the limit is crossed; later drops in the same window are silent. A
  counter in `hookRateLimited` therefore counts limit-exceedance events, not every
  dropped update.
</Warning>

## `hookKeyGenerator(ctx)`

An optional class override that produces the per-update key. It must be
**synchronous**, because the middleware reads the key before the update is
dispatched. The hook replaces the default; it does not fall back to it.

| Override returns | The limiter groups by |
| :--------------- | :-------------------- |
| a string | that string |
| `undefined` | no key: the update is not limited |

Return a string for every update. Only when the hook is absent does the limiter
use the sender id. The default is per sender, which is the right unit for "stop
this user flooding you" and the wrong unit for "stop this group flooding you".
That is a two-line override:

```ts
import {Gramstax, type Ctx} from "gramstax"

export class BotCore extends Gramstax {
  override hookKeyGenerator(ctx: Ctx) {
    // One shared bucket for every message in a chat, sender ignored.
    return ctx.chat?.id?.toString()
  }
}
```

A single global bucket is one string away, and it is what you want when the scarce
resource is your own API quota rather than one user's patience:

```ts
import {Gramstax} from "gramstax"

export class BotCore extends Gramstax {
  override hookKeyGenerator() {
    return `global`
  }
}
```

<Tip>
  Choose the key by what you are protecting. Per sender protects one user's
  session. Per chat protects a group conversation. A global key protects the Bot API
  budget and the process, and every user then shares one budget.
</Tip>

## Outbound: `throttle`

The outbound throttle is a different library with a different job. It is mounted on
the API client with `api.config.use(apiThrottler(...))`, which means it sees every
outgoing Bot API call rather than every incoming update.

```ts
export default {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `webhook`,
  throttle: {global: {maxConcurrent: 30}}
} satisfies GramstaxConfig
```

The option value is `APIThrottlerOptions`, the type exported by
`@grammyjs/transformer-throttler`, and gramstax forwards it verbatim without
validating or reshaping a single field. Its documented buckets are `global`, `group`
and `out`. Because nothing is validated, a wrong shape surfaces from Bottleneck at
the first call rather than at boot.

<Note>
  `throttle` is listed as an "edge safe" object slot by `gramstax build`, meaning
  the config value itself survives bundling. It is not the same as the throttle
  actually working in a bundle: read the caveat below.
</Note>

### Composition order on the API client

Three transformers land on `api.config.use` during construction, in this order:

1. `autoRetry(params.autoRetryOptions ?? {})`, unless `autoRetry === false`
2. `apiThrottler(params.throttle)`, when `throttle` is set
3. `hydrateFiles(this.bot.token)`

They compose rather than replace one another. Retry sits in front, so a throttled
call that fails is retried; the file hydration is mounted by default so
`ctx.download()` works without setup.

### The single-file edge bundle

<Warning>
  `gramstax build --bundle` replaces `@grammyjs/transformer-throttler` with a stub
  that throws on call. The throttler dependency graph reaches built-in modules through
  dynamic `require()`, which workerd rejects, so the build fails loudly rather than
  shipping a bot that is silently unthrottled. Use the multi-file deploy output
  when `throttle` is required.
</Warning>

This is a deliberate failure mode. An unthrottled edge bot that looks fine until it
is rate limited by Telegram is a worse outcome than one that will not start.

## Choosing what to set

<Tabs>
  <Tab title="One user is flooding you">
    Set `rateLimit` and leave the key alone. The default key is the sender's user
    id, which is exactly the unit that is misbehaving.

    ```ts
    const rateLimit = {windowMs: 1000, max: 5}
    ```
  </Tab>
  <Tab title="A group is flooding you">
    Set `rateLimit` and key per chat, so the whole group shares one bucket instead
    of one member being able to exhaust it.

    ```ts
    const rateLimit = {windowMs: 10_000, max: 50}
    ```

    ```ts
    import {Gramstax, type Ctx} from "gramstax"

    export class BotCore extends Gramstax {
      override hookKeyGenerator(ctx: Ctx) {
        return ctx.chat?.id?.toString()
      }
    }
    ```
  </Tab>
  <Tab title="The bot sends too much">
    That is outbound, so reach for `throttle`, not `rateLimit`. A large broadcast
    is well inside the inbound budget and still trips Telegram's method limits.

    ```ts
    throttle: {global: {maxConcurrent: 30}}
    ```
  </Tab>
  <Tab title="Both">
    They do not interfere. `rateLimit` shapes what reaches a handler, `throttle`
    shapes how fast the answers leave, and the two are mounted on different sides
    of the process.
  </Tab>
</Tabs>

## Rate limiting and the other backstops

Three mechanisms can all stop an update, and they are not substitutes for each
other. Knowing which one fired is most of the debugging.

| Mechanism | Trigger | Update is | Counter |
| :-------- | :------ | :-------- | :------ |
| `rateLimit` | A key exceeds its window | Dropped before routing | None. Invisible to `/metrics` |
| [The session lock](/guides/session-lock) | Another instance holds the lease | Dropped or queued on contention | `blocked` |
| [The update queue](/guides/update-queue) | The queue is full on webhook | Blocked, or answered with HTTP 429 | None, plus `dropped` at drain |

The lock is about **correctness** across instances and the queue is about
**saturation** within one. Rate limiting is the only one of the three whose drops
are unrecorded. `hookRateLimited` fires when the limit is crossed, not on every
later drop in the same window, so a counter there measures exceedance events
rather than every discarded update.

<Note>
  Rate limiting happens before routing, so a limited update never reaches the
  queue's `enqueueTimeoutMs`, never occupies a gate slot, and never shows up in
  `byListener`. It reduces load on everything downstream, which is the point.
</Note>

## Related

- [The update queue](/guides/update-queue): in-process concurrency and backpressure
- [The session lock](/guides/session-lock): the cross-instance drop that *is* counted
- [Observability](/guides/observability): what the counters do and do not cover
- [Configuration reference](/guides/configuration): `rateLimit` and `throttle` in the field table
