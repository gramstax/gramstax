---
title: Query answers
description: The six render methods that answer a Telegram query from a template block, what each block carries, and how send failures on an answer behave.
icon: message-circle
---

# Query answers

Telegram has six queries a bot has to answer: an inline-button tap, a payment
pre-checkout, a shipping address, an inline-mode search, a guest-mode message,
and a web-app query. Every one of them is a short-lived obligation. Answer it and
the client stops spinning; miss it and the user sees a stuck loader.

gramstax answers them the same way it sends everything else: the text comes out
of a template block, not a string literal at the call site. That is the whole
reason these methods exist instead of you calling `ctx.answerCallbackQuery`
directly. The block sits beside `<g-message>` in the same `<g-base>`, so a
translator can change the toast for a payment decline without touching a
handler.

<Note>
  This page covers the answer path only. Sends to a chat are the render contract,
  and their failures are covered in [Errors](/guides/errors). See [the render
  contract](/concepts/render-contract) for `mode` and the send-versus-edit
  decision.
</Note>

## The six methods

Every one takes `{data?, AGBaseId?, options?}` on top of its required key. There
is no `mode`, no `keyboard` and no `fallback`: an answer is not a message, so
there is nothing to edit and nowhere to fall back to.

| Method | Block | Telegram call | Required | Optional |
| :----- | :---- | :------------ | :------- | :------- |
| `renderCallbackAnswer` | `<g-callback-answer>` | `answerCallbackQuery` | `showAlert` | `data`, `AGBaseId`, `options` |
| `renderPreCheckout` | `<g-precheckout-error>` | `answerPreCheckoutQuery` | `ok` | `data`, `AGBaseId`, `options` |
| `renderShipping` | `<g-shipping-error>` | `answerShippingQuery` | `ok` | `data`, `AGBaseId`, `options` |
| `renderInlineAnswer` | `<g-inline-button>` | `answerInlineQuery` | `results` | `data`, `AGBaseId`, `options`, `buttonStartParameter` |
| `renderGuestAnswer` | `<g-answer-note>` | `answerGuestQuery` | `result` | `data`, `AGBaseId`, `options` |
| `renderWebAppAnswer` | `<g-web-app-answer>` | `api.answerWebAppQuery` | `webAppQueryId`, `result` | `data`, `AGBaseId`, `options` |

`renderWebAppAnswer` reads `<g-web-app-answer>`. `<g-answer-note>` stays valid
for it as a legacy alias, so a template written before the dedicated block
keeps working.

The params types are `IRenderCallbackAnswerParams`, `IRenderPreCheckoutParams`,
`IRenderShippingParams`, `IRenderInlineAnswerParams`,
`IRenderGuestAnswerParams` and `IRenderWebAppAnswerParams`, all in
`packages/gramstax/src/types/ctx.ts`. The `options` bags are `IOptCallbackAnswer`,
`IOptPreCheckout`, `IOptShipping`, `IOptInlineAnswer`, `IOptGuestAnswer` and
`IOptWebAppAnswer`, each derived from the grammy call it feeds, so you cannot
pass a field the underlying method would not accept.

| Shared key | Type | What it does |
| :--------- | :--- | :----------- |
| `AGBaseId` | `string \| null` | Which `<g-base>` holds the block. Omit it and the `default` base is used. |
| `data` | `IData \| null` | Interpolation data for the block, so the same toast can name the thing the user tapped. |
| `options` | the matching `IOpt* \| null` | Passed straight through to the Bot API call, spread over the template-derived fields. |

`renderCallbackAnswer` and `renderPreCheckout` read `options` only when it is an
object, so a non-object value is never spread over the call. `renderPreCheckout`
is also the one method that *uses* a non-object value: a string `options`
**replaces** the block text as the `error_message` rather than being passed on.

## One method in full

```ts
// a page-level gate that says why, in the user's language
export abstract class PageAdminBase extends PageBase {
  async hookBeforeRoute() {
    if (await isAdmin(this.from!.id)) return true
    await this.renderCallbackAnswer({showAlert: true, AGBaseId: Base.denied})
    return false // strict `false` only
  }
}
```

```html
<g-base id="denied">
  <g-callback-answer>You are not allowed to do that.</g-callback-answer>
  <g-callback-answer lang="id">Kamu tidak diizinkan melakukan itu.</g-callback-answer>
</g-base>
```

| Param | Required | Meaning |
| :---- | :------- | :------ |
| `showAlert` | yes | `true` for a modal alert the user must dismiss, `false` for a toast that fades. |
| `AGBaseId` | no | The base holding the `<g-callback-answer>`. |
| `data` | no | Interpolation data, e.g. `{action: `ban`}` into `{{action}}`. |
| `options` | no | Answer options such as `cache_time`. |

The language comes from the update, the same way `<g-message>` picks its
variant, so the same page serves both without a branch in the handler.

<Warning>
  Toast text is capped by Telegram at 200 characters. Keep the block short: it
  is a notification, not a message.
</Warning>

## What each block actually carries

The blocks are not interchangeable, and two of them carry nothing at all beyond
proof that the template exists. That is deliberate, and it is the part worth
knowing before you design the page.

| Method | The block supplies | The call carries |
| :----- | :----------------- | :--------------- |
| `renderCallbackAnswer` | the notification text | `showAlert`, `options` |
| `renderPreCheckout` | `error_message` when `ok` is `false` | `ok`, `options` |
| `renderShipping` | `error_message` when `ok` is `false` | `ok`, `options` |
| `renderInlineAnswer` | `button.text` and `start-parameter` | the `results` array you build |
| `renderGuestAnswer` | nothing: resolved for validation only | the `result` you build |
| `renderWebAppAnswer` | nothing: resolved for validation only | `webAppQueryId`, the `result` you build |

Three consequences follow.

**Approving does not need a message, but the block is still required.**
`renderPreCheckout` resolves its `<g-precheckout-error>` before it branches, so
an `ok: true` approval with no block in the template throws. That is fail-fast
validation that the template exists, on the one code path that would otherwise
ship untested. `renderShipping` behaves the same way, and so does
`renderInlineAnswer`.

**An inline answer's button is opt-in.** `renderInlineAnswer` only attaches the
block's button when there is a start parameter to attach. Precedence is
`options.button` first, then the explicit `buttonStartParameter`, then the
block's own `start-parameter`. Without any of the three, no button is sent and
the results stand alone.

**Guest and web-app answers are pure validation markers, and they use two
different blocks.** `<g-answer-note>` belongs to `renderGuestAnswer`;
`<g-web-app-answer>` belongs to `renderWebAppAnswer`. Each holds a note in your
markup, but neither method sends it. They exist so the page declares, in the
template, that this page answers guest or web-app queries, and so a missing
declaration fails at the call instead of in production. `<g-answer-note>` also
works for `renderWebAppAnswer` as a legacy alias: the web-app answer prefers
`<g-web-app-answer>` and falls back to `<g-answer-note>` when the base declares
only the older block. The guest answer never reads `<g-web-app-answer>`.

```html
<g-base id="guest-card">
  <g-answer-note>Appended to the inline result, kept here for translators.</g-answer-note>
</g-base>

<g-base id="webapp-card">
  <g-web-app-answer>Appended to the web-app result, kept here for translators.</g-web-app-answer>
</g-base>
```

## A missing block throws, by name

Every one of the six blocks is read through a strict getter on
`TemplateManager`, and a strict getter means a missing block is an error rather
than an empty string. The messages name the template, the base and the language,
because the wrong language variant is the common cause.

```text
CallbackAnswer function not found for template "start" (base "denied", lang "id")
PrecheckoutError function not found for template "start" (base "pay", lang "default")
ShippingError function not found for template "start" (base "ship", lang "default")
InlineButton function not found for template "start" (base "inline-card", lang "default")
AnswerNote function not found for template "start" (base "guest-card", lang "default")
WebAppAnswer function not found for template "start" (base "webapp-card", lang "default")
```

These come from `getGCallbackAnswer`, `getGPrecheckoutError`, `getGShippingError`,
`getGInlineButton`, `getGAnswerNote` and `getGWebAppAnswer` in
`packages/gramstax/src/template/manager.ts`, and the lookup falls back
`AGBaseId` to `default` and then the language to `default`, so a template that
declares one base and one language resolves for every base and language and only
fails when neither exists. The web-app getter tries `<g-web-app-answer>` first
and `<g-answer-note>` second, so its error means the template declares neither.

<Warning>
  The lookup does throw, but it is a template error, not a send error: it is
  raised before the `try` block that wraps the Bot API call, so it is never
  classified, never reported to `hookSendError`, and never logged as a send
  failure. It propagates straight to your handler.
</Warning>

## Answers are deadlines

Two of the six carry a clock, and both clocks are Telegram's rather than the
framework's.

| Method | Limit | Where it comes from |
| :----- | :---- | :----------------- |
| `renderPreCheckout` | Telegram requires the answer within 10 seconds of the query | Bot API pre-checkout contract |
| `renderInlineAnswer` | at most 50 results, cache identical queries with `cache_time` | Bot API inline-mode contract |

A payment handler that does I/O before calling `renderPreCheckout` has spent its
budget. Do the decision first, then answer.

## How a failed answer behaves

Every one of the six wraps its Bot API call in the same `try`/`catch`, and the
catch is uniform: classify the error with `Ctx.classifySendError`, report it to
`notifySendError`, log it, then **rethrow the original error untouched**.

```ts
catch (error) {
  const kind = Ctx.classifySendError(error)
  this.notifySendError(error, kind, this.sendChatId())
  if (kind === `retryable`) {
    this.log?.error(`callback answer retryable error for page "${this.sendPageName()}" chat ${this.sendChatId()}: ${String(error)}`)
    throw error
  }
  this.log?.warn(`callback answer fallback-text error for page "${this.sendPageName()}" chat ${this.sendChatId()}: ${String(error)}`)
  throw error
}
```

Both branches throw. There is no degraded content to deliver, because a failed
answer has nowhere to put it: there is no message, so there is no fallback text
and no reply. The classification changes the log severity and nothing else.

| Outcome | `classifySendError` returns | Log level | Then |
| :------ | :-------------------------- | :--------- | :--- |
| `GrammyError` 400 to 499, except 429 | `fallback-text` | `log.warn` | rethrow |
| `GrammyError` 429 | `retryable` | `log.error` | rethrow |
| `HttpError`, network, anything unknown | `retryable` | `log.error` | rethrow |

So a `renderCallbackAnswer` inside `hookBeforeRoute` can itself throw, and that
throw is a handler failure, which routes to `hookErrorPage`. Write the gate so a
denied user cannot produce an unhandled error.

<Warning>
  Plan for the throw. `await this.renderCallbackAnswer(...)` inside a `try` is
  not optional ceremony: a 429 on the answer call is a `retryable` send error and
  it reaches your caller. See [Errors](/guides/errors) for the full rule and for
  `hookSendError`, which observes without swallowing.
</Warning>

## One answer marks the update as handled

`Ctx.ANSWER_API_METHODS` is the set of Bot API methods whose response counts as
an answer, used by the context proxy to set `temp.isAnswer` so the router knows
the page responded. Five of the six methods here go through such a method:

| Method | Called through | In `ANSWER_API_METHODS` |
| :----- | :------------- | :--------------------- |
| `renderCallbackAnswer` | `answerCallbackQuery` | yes |
| `renderPreCheckout` | `answerPreCheckoutQuery` | yes |
| `renderShipping` | `answerShippingQuery` | yes |
| `renderInlineAnswer` | `answerInlineQuery` | yes |
| `renderWebAppAnswer` | `answerWebAppQuery` | yes |
| `renderGuestAnswer` | `answerGuestQuery` | no |

An answer that answers and nothing else is the whole job for five of the six,
so it is normal for a `handle*` method to consist of one answer call and no
render.

## Where to go next

<Columns cols={2}>
  <Card title="Template blocks" icon="blocks" href="/guides/template-blocks">
    The block vocabulary, including every answer block.
  </Card>
  <Card title="Templates" icon="code" href="/concepts/templates">
    How a base and a language resolve to one compiled block.
  </Card>
  <Card title="Errors" icon="alert-triangle" href="/guides/errors">
    `classifySendError`, the rethrow rule, and `hookSendError`.
  </Card>
  <Card title="Filters" icon="funnel" href="/guides/filters">
    Compile-time pipes for the `{{placeholders}}` in your answer text.
  </Card>
  <Card title="Pages" icon="file-code" href="/guides/pages">
    `buildData`, `handle*` names, and the rest of the page class.
  </Card>
  <Card title="Routing" icon="route" href="/guides/routing">
    How an update reaches the handler that answers it.
  </Card>
</Columns>