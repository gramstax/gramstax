---
title: Errors
description: How gramstax classifies, reports and recovers from failures across the update layer, the send layer, the edit fallback, and the runtime route guard.
icon: alert-triangle
---

# Errors

gramstax has two error layers and they do not talk to each other. The **update
layer** catches whatever a handler throws and decides what the user is told. The
**send layer** classifies every Bot API rejection, reports it, and decides
whether the framework can still serve that user something. Between them sit a
set of programmer-error guards that never recover at all, because a template
that does not compile is not something to fall back from.

This page is the mechanism: where each check lives, what it does, and what it
does not do. For "I see this string on my screen, what do I fix", use
[Troubleshooting](/guides/troubleshooting), which is indexed by symptom and
covers the failures this page deliberately does not repeat.

## The four surfaces

| Surface | Where | Fires on | Recovers? |
| :------ | :---- | :------- | :-------- |
| `hookErrorPage` | `Gramstax`, in `core/bot.ts` | A page handler, gate or route threw | No. It is the last chance to tell the user. |
| `hookNotFoundPage` | `Gramstax`, in `core/bot.ts` | Routing returned `no-match` | No. It is the reply. |
| `hookSendError` | `Gramstax`, bound into every `Ctx` | Any classified Bot API rejection | No. It observes; the caller decides. |
| `assert*` / `_assert*` | `Ctx`, static | A params combination or a block that cannot work | Never. These are programmer errors. |

Everything else on this page is how one of those four is reached.

## Layer one: the update

`Gramstax._handleCtx(ctx, listenerName, shouldCheckNotFound, traceId)` in
`packages/gramstax/src/core/bot.ts` is the whole update lifecycle, in order:

```ts
try {
  const before = await this.hookBeforeRoute?.(ctx, {listenerName, isEdit})
  if (before === false) {
    this.metrics.counts.blocked += 1
    return
  }
  // ... race runRoute() against limits.updateTimeoutMs ...
} catch (error) {
  if (error instanceof UpdateTimeoutError) {
    state = `timeout`
    this._emitUpdateError({traceId, listenerName, state: `timeout`, error, durationMs, isEdit})
  } else {
    state = `error`
    try {
      await this.hookErrorPage?.(ctx, {listenerName, error, isEdit})
    } catch (hookFailure) {
      this.log?.error?.(`hookErrorPage hook failed: ${String(hookFailure)}`)
    }
    this._emitUpdateError({traceId, listenerName, state: `error`, error, durationMs, isEdit})
  }
}
```

Five behaviours are worth stating exactly, because each is a decision you would
otherwise have to reverse-engineer.

**`hookErrorPage` is guarded, and its failure is logged rather than propagated.**
The `catch` around it is not decoration. A throw from `hookErrorPage` would
otherwise skip `hookAfterRoute` and the metrics record with nothing sent and
nothing written. A failing `hookNotFoundPage` lands in the same place, which is
what terminates the fallback cascade: the not-found page throws, the error page
runs, and if that throws too it is logged and the update ends.

**`hookNotFoundPage` is conditional.** It fires on `no-match` only when
`shouldCheckNotFound` is true, which is an `ICustomRouteEntry` field defaulting
to `true`. Chat-member routes set it to `false`, because a status transition is
not a user command and an unknown one should stay silent.

**An explicit `false` from `hookBeforeRoute` returns immediately.** It increments
`blocked` and returns from `_handleCtx`, so `hookAfterRoute`, `metrics.recordUpdate`
and the outcome counter do not run for that update. `undefined`, `null`, `0` and
`""` are not `false`, and all of them allow.

**A timeout is a different state from an error.** With `limits.updateTimeoutMs`
greater than zero (30 seconds unless the constructor param overrides it),
`runRoute()` is raced against a timer that rejects with `UpdateTimeoutError`. The
timeout branch counts `timeouts` instead of `updatesFailed` and calls
`_emitUpdateError` with `state: 'timeout'`; `hookErrorPage` is **not** invoked,
because the handler may still be running and may still send.

**The outcome set is closed.** `hookAfterRoute` receives one of `matched`,
`no-match`, `no-handler`, `blocked`, `error` or `timeout`. `hookUpdate` fires
for everything except `error` and `timeout`; `hookUpdateError` fires for those
two. `hookTrace` is guarded and fired for every routed update.

### Wiring the two page hooks

```ts
// example/1-complex/src/core/bot.ts
export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore) {
    const user = await new UserGuard(ctx).overrideLang()
    if (user === null) {
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).gerror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).gnotFound.show()
  }
}
```

Both page hooks are optional class overrides, so the default for a bot that
defines neither is silence on `error` and silence on `no-match`. Nothing logs
your handler's exception unless you wire `hookErrorPage` or turn the logger on.
Both hooks receive a fully constructed page context, so `new StatusPage(ctx)` and
the `render*` helpers are available inside them.

<Warning>
  A `render*()` call inside `hookErrorPage` is still a page send: it classifies
  its own failures and can still throw. Keep it simple, and remember the guard
  above means a failure there is logged and swallowed, not surfaced.
</Warning>

## Layer two: the send

Every send site in `core/ctx.ts` follows the same four steps, and the shape is
consistent enough to read one and recognise the rest.

### `classifySendError`

A static on `Ctx`, three lines, and the whole taxonomy is in it:

```ts
static classifySendError(err: unknown): `fallback-text` | `retryable` {
  if (err instanceof HttpError) return `retryable`
  if (err instanceof GrammyError && err.error_code >= 400 && err.error_code < 500 && err.error_code !== 429) return `fallback-text`
  return `retryable`
}
```

| Error | Classification | Reasoning |
| :----- | :------------- | :-------- |
| `HttpError` (transport) | `retryable` | The request never got an answer. |
| `GrammyError` 400 to 499, including 403 | `fallback-text` | Telegram rejected the content. Sending something else may still work. |
| `GrammyError` 429 | `retryable` | Rate limited. Sending different content does not help. |
| Anything else | `retryable` | Unknown, so treated as the safe loud default. |

The asymmetry is the point. A 403 (bot blocked by the user) is a
`fallback-text`, because the recipient is still reachable, just not for this
content. A 429 is `retryable`, because the same content will work later. Anything
unrecognised is `retryable` rather than `fallback-text`, so the fail-loud branch
is the default.

`Ctx.retryAfterMs(err)` sits alongside it and reads `parameters.retry_after` off
a `GrammyError`, converting seconds to milliseconds. It is informational: pacing
is owned by the broadcast loops, not by this helper.

### `notifySendError` and `hookSendError`

The hook is not injected per call. `Gramstax` binds it once when it builds the
context scope:

```ts
// core/bot.ts, the constructor's buildScope()
onSendError: this.hookSendError?.bind(this) ?? null
```

`Ctx.notifySendError(err, kind, chatId)` then builds `ISendErrorInfo` and calls
it inside its own `try`/`catch` whose body is empty:

```ts
notifySendError(err: unknown, kind: `fallback-text` | `retryable`, chatId?: number): void {
  const hook = this.onSendError
  if (hook === undefined || hook === null) return
  const info: ISendErrorInfo = {page: this.sendPageName(), kind, chatId}
  try {
    hook(err, info)
  } catch {
    // throwing hook must never break the send flow
  }
}
```

So `hookSendError` is strictly an observer. A throw inside it cannot break the
send, and it cannot be used to substitute a retry: whatever it collects has to be
re-driven from somewhere else.

| `ISendErrorInfo` field | Source |
| :--------------------- | :----- |
| `page` | `sendPageName()`, which is `this.data?.name ?? \`unknown\`` |
| `kind` | the `classifySendError` outcome |
| `chatId` | `sendChatId()`, the current chat for single sends, the recipient id for broadcast loops |

The routing rule the framework documents for these three sibling hooks is worth
keeping: retry queue from `hookSendError`, exception tracker from
`hookUpdateError`, dashboard from `hookTrace`. One incident, for example a 403
that fails a send and then kills the handler, can fire all three in sequence, so
forwarding all three to the same alert triples it.

### The always-rethrow rule

Stated exactly as implemented, because it is the one rule that catches people
out: after notifying and logging, the **original error is rethrown untouched**
on both branches. There is no path where a classified failure is swallowed at a
single-chat send site.

```ts
} catch (error) {
  const kind = Ctx.classifySendError(error)
  this.notifySendError(error, kind, this.sendChatId())
  if (kind === `retryable`) {
    this.log?.error(`text send retryable error for page "${this.sendPageName()}" chat ${this.sendChatId()}: ${String(error)}`)
    throw error
  }
  // No text fallback for text: there is no degraded content to deliver, so rethrow after notify+log.
  this.log?.warn(`text send fallback-text error for page "${this.sendPageName()}" chat ${this.sendChatId()}: ${String(error)}`)
  throw error
}
```

Classification changes the log severity and nothing else. What differs between
methods is whether the caller gets a value back **before** the throw would have
happened, and that is decided by whether a degraded content exists at all.

| Site | On `fallback-text` | On `retryable` |
| :--- | :---------------- | :------------- |
| `renderText`, `renderPoll`, the six `render*Answer` methods, `renderGift`, `renderDice` | notify, `log.warn`, rethrow | notify, `log.error`, rethrow |
| `renderMedia`, `renderMediaGroup` | notify, `log.warn`, **return `replyFallbackText()`** | notify, `log.error`, rethrow |
| Broadcast send loops (`ids`) | notify, best-effort fallback text to that recipient, count failed | notify, push to `retryable[]`, continue the loop |
| `renderBroadcastDelete` | notify, `log.warn`, count failed (there is nothing to deliver) | notify, push to `retryable[]`, continue the loop |
| `broadcast.targets` revise | notify, best-effort fallback text to that chat, count failed | notify, push to `retryable[]`, continue the loop |

The `fallback-text` branch exists for media because a photo that fails to send
has a text equivalent. It does not exist for text, answers or polls because
there is no degraded version of a callback toast or a poll. Broadcast loops do
not rethrow at all, because the fan-out is per recipient and one recipient
cannot fail the other 9,999.

## The edit fallback

When an edit fails, the `fallback` field decides what happens next. The type is
`IOptFallbackEdit` and there are exactly three values.

| Value | What happens | Where the branch lives |
| :---- | :----------- | :--------------------- |
| `delete-reply` (default) | delete the original, then send a new message | `renderText` edit catch |
| `reply` | send a new message, leave the original | `renderText` edit catch |
| `disable` | rethrow the edit error, send nothing | `renderText` edit catch |

```ts
const fallback = params.fallback ?? `delete-reply`
try {
  return await this.editMessageText(text, {...})
} catch (error) {
  if (fallback === `disable`) {
    throw error
  }
  this.log?.warn(`renderText fallback reply for page "${this.sendPageName()}"`)
  if (fallback === `delete-reply`) {
    try {
      await this.deleteMessage()
    } catch {
      // delete failure (e.g. already deleted) must not block the fallback reply
    }
  }
  viaFallback = true
}
```

Four details that the type does not tell you.

**The fallback covers the edit attempt only.** Once the resend starts, it is an
ordinary send and it is classified and rethrown like any other. `fallback` is
not a retry policy.

**A failed delete never blocks the resend.** The `deleteMessage()` is inside its
own `try` with an empty `catch`, so an already-deleted message still produces the
new message rather than an error.

**The options bag switches with the path.** The same call serves the everyday
send and the post-edit resend, so the bag is picked at runtime:
`viaFallback ? params.fallbackOptions ?? params.options : params.options`. On an
explicit `mode: 'edit'` route `options` is unread, which is why `fallbackOptions`
exists: it is the only legal bag for the resend.

**The same three modes appear in four places.** `renderMedia` reads
`params.fallback ?? \`delete-reply\``, `renderMediaGroup` reads its own
`fallback`, and the `broadcast.targets` revise loop has an equivalent switch
where `delete-reply` deletes and re-sends and `disable` classifies without
re-sending. On a media revise the fallback also drops `media` and `mediaOptions`
and warns that it did, because those describe `editMessageMedia` and the
fallback path sends instead.

### The fallback text itself

`Ctx.FALLBACK_TEXT` is the framework default, and it is deliberately plain:

```ts
static readonly FALLBACK_TEXT = `Media unavailable`
```

Three ways to change it, in precedence order:

| Level | How |
| :---- | :-- |
| Per page | set the instance field `fallbackText` on your page class |
| Per call | `await this.replyFallbackText()` explicitly |
| Default | `Ctx.FALLBACK_TEXT` |

`resolveFallbackText()` returns `this.fallbackText ?? Ctx.FALLBACK_TEXT`.
`replyFallbackText()` is the delivery half and **never throws**: a nested failure
is logged as `replyFallbackText delivery failed for page "..."` and reported as
`undefined`, so the outer send has already recorded the primary error and this
warn only marks the loss of the last-resort message. Broadcast loops use
`api.sendMessage(chatId, resolveFallbackText())` directly, for the same reason:
the fallback is best-effort and its own failure is ignored.

## The runtime route guard

TypeScript callers cannot reach a bad params combination, because
`IRenderTextParams` is a union over delivery routes and the unread keys are
`never`. Plain-JS callers can, so `Ctx._assertRenderRoute(method, params,
richAxis)` re-checks at runtime. It is one function shared by `renderText`,
`renderMedia` and `renderMediaGroup`, and it resolves the route from the same
three discriminators in a fixed order: the `broadcast` shape first, then
`chunkSize`, then `mode`.

| Branch | Trigger | Fields it refuses |
| :------ | :------ | :--------------- |
| `broadcast.targets` | `broadcast` with a `targets` key | `mode`, `fallback`, `options`, `captionOptions`, `editOptions`, `fallbackOptions`, `chunkSize` |
| `broadcast` otherwise | `broadcast` with `ids` | `type`, `mode`, `chunkSize`, `fallback`, `editOptions`, `fallbackOptions`, `media`, `mediaOptions`, `resendOptions` |
| `chunkSize` | `chunkSize` set, no `broadcast` | `mode` unless it is `reply`, plus `fallback`, `editOptions`, `fallbackOptions`, `media`, `mediaOptions`, `resendOptions` |
| `mode: 'reply'` | no `broadcast`, no `chunkSize` | `fallback`, `editOptions`, `fallbackOptions`, `media`, `mediaOptions`, `resendOptions` |

Every throw names the offending field, the reason it is unread, and the fix, in
one message. This is a prefix, quoted up to the point where the real string
continues:

```text
renderText illegal combination: mode: "reply" + fallback: "reply"
```

`rich` and `richOptions` are only refused on the media family, and that is what
the `richAxis` argument is for: the same key is live on text and dead on media,
so the method has to tell the guard which family it is.

There is a second, smaller guard. `_assertInlineKeyboardForEdit(method, keyboard)`
rejects a bottom (reply) keyboard on any route that edits in place, before the
API call, because `editMessageText` and `editMessageMedia` accept inline
keyboards only and a reply keyboard would come back as an opaque 400. The message
names the fix, and this is a prefix:

```text
renderText edit route rejects a bottom (reply) keyboard: editMessageText/editMessageMedia accept inline keyboards only
```

Send-only routes are exempt, and so are the delete-then-resend media kinds,
because a send accepts either keyboard type.

## Programmer errors that never recover

The `assert*` family on `Ctx` runs before the API call and always throws. These
are not send failures: there is no `classifySendError`, no `notifySendError` and
no `hookSendError` anywhere near them, because a template that cannot be sent is
not something to retry.

| Assert | Checks |
| :----- | :----- |
| `assertMediaSize` | payload bytes against `MEDIA_UPLOAD_LIMITS` for the type |
| `assertMediaSrcSize` | the same, when the size is knowable from a path or buffer |
| `assertMediaCaption` | caption length for the caption-carrying types |
| `assertMediaPreconditions` | unknown type, upload size, voice caption, caption length, in one pass |
| `assertMediaGroupItems` | group size and per-item types |
| `assertMediaSrcList` | a pipe-delimited `srcList` against the group limit |
| `assertLocation` | latitude and longitude |
| `assertContact` | phone and first name |
| `assertPoll` | question, options, and the option count |
| `assertInvoice` | title, description, payload, and at least one price |
| `assertPaidMedia` | Stars amount and item count |
| `assertLivePeriod` | the live-location period |
| `assertDiceEmoji` | the emoji is one Telegram accepts |
| `assertVenue` | title, address and coordinates, returning them narrowed |

The limits they read are public constants on `Ctx`, so a template validator or a
pre-commit check can assert against the same numbers the sender will:
`MEDIA_UPLOAD_LIMITS`, `MEDIA_CAPTION_LIMIT`, `MEDIA_CAPTION_TYPES`,
`MEDIA_GROUP_LIMIT`, `POLL_QUESTION_LIMIT`, `POLL_OPTION_LIMIT`,
`POLL_OPTIONS_MIN`, `POLL_OPTIONS_MAX`, `INVOICE_TITLE_LIMIT`,
`INVOICE_DESCRIPTION_LIMIT`, `INVOICE_PAYLOAD_LIMIT`, `INVOICE_PRICES_MIN`,
`PAID_MEDIA_STARS_MIN`, `PAID_MEDIA_STARS_MAX`, `PAID_MEDIA_ITEMS_MIN` and
`PAID_MEDIA_ITEMS_MAX`.

## Which hook do I want

| Your question | Hook or field |
| :------------ | :------------ |
| A handler threw and nobody told the user | `hookErrorPage(ctx, {listenerName, error, isEdit})` |
| The user typed something and nothing happened | `hookNotFoundPage(ctx, {listenerName, isEdit})` |
| Sends are failing but handlers are fine | `hookSendError(err, {page, kind, chatId})` |
| The update ended badly and I want it in Sentry | `hookUpdateError(event)` |
| I want every update, successes included | `hookUpdate(event)` and `hookTrace(span)` |
| Nobody should be able to reach a page family | `hookBeforeRoute(ctx, {listenerName, isEdit})` |

The last row returns `!== false` to allow, so an omitted hook and a hook that
returns `undefined` behave identically. Denying is silent: answer the callback or
render a page, or the user sees nothing at all. See [Pages](/guides/pages) for
the page-level gate.

## When the two layers meet

An exception thrown by a handler is an **update** failure and lands in
`hookErrorPage`. An exception thrown by a `render*()` send is a **send** failure
that has already notified `hookSendError`, and it becomes an update failure the
moment it leaves your handler. That is why a single blocked recipient can produce
both hooks in sequence, and why the retry queue belongs to the send layer while
the exception tracker belongs to the update layer.

Counters on `MetricsStore` (`GET /stats`, and `GET /metrics` in Prometheus form)
answer the operational question of how many updates ended in each state:
`noMatch`, `noHandler`, `blocked`, `dropped`, `timeouts`, `updatesFailed`, plus
the success and failure totals per listener. Turn the logger on before you read
anything else: `log: true` in `gramstax.config.ts` mounts the default logger and
`log: {force: "file"}` writes to disk.

## What this page does not cover

Template validation messages, routing mismatches, config errors, deploy-mode
mistakes, build and serverless failures, port and queue problems: those are
indexed by symptom in [Troubleshooting](/guides/troubleshooting). If you arrived
here with a string on screen, start there. If you arrived here to understand why
the framework does something surprising, you are in the right place.

## Where to go next

<Columns cols={2}>
  <Card title="Troubleshooting" icon="life-buoy" href="/guides/troubleshooting">
    The same failures, indexed by the string you are seeing.
  </Card>
  <Card title="The render contract" icon="shapes" href="/concepts/render-contract">
    The route unions that make the illegal combinations unrepresentable.
  </Card>
  <Card title="Broadcast" icon="send" href="/guides/broadcast">
    Where a fan-out records a failure instead of throwing one.
  </Card>
  <Card title="Query answers" icon="message-circle" href="/guides/query-answers">
    The six methods whose send errors always rethrow.
  </Card>
  <Card title="Pages" icon="file-code" href="/guides/pages">
    Gates by inheritance, and what a denied route does.
  </Card>
  <Card title="Deploy" icon="server" href="/concepts/deploy">
    Status server, `/stats`, `/metrics`, and the webhook secret.
  </Card>
</Columns>