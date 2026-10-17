# route-render-api

Reach for the method that matches the *shape* of the change: long text via `chunkSize`, caption-only edit, keyboard-only swap, gifts, and template-backed query answers.

## Why

Each of these exists because the obvious composition is wrong somewhere. Chunking a long message by hand means tracking Telegram's 4096 limit yourself; swapping a keyboard via delete-and-resend loses the message; answering a query with an ad-hoc string skips the template. The framework already encodes each of those decisions — hand-rolling them reintroduces the bug the method was written to prevent.

## Picking the method

| You need | Method | Telegram call |
| --- | --- | --- |
| normal send / edit, auto send-vs-edit | `renderText` (default `mode: 'auto'`) | `sendMessage` / `editMessageText` |
| text longer than 4096 | `renderText` + `chunkSize` | `sendMessage` × N |
| change only the caption | `renderEditCaption` | `editMessageCaption` |
| change only the keyboard | `renderEditKeyboard` | `editMessageReplyMarkup` |
| send a gift | `renderGift` | `sendGift` |
| answer a callback query | `renderCallbackAnswer` | `answerCallbackQuery` |
| answer an inline query | `renderInlineAnswer` | `answerInlineQuery` |
| answer pre-checkout / shipping | `renderPreCheckout` / `renderShipping` | `answerPreCheckoutQuery` / `answerShippingQuery` |

Send-vs-edit resolution (`mode`) is in `route-render-auto.md`; media block authoring is in `template-media.md`. Every method here takes ONE object params argument — positional args are gone.

## `renderText`

```typescript
async renderText(params: {
  keyboard?: IInBoKb | null
  data?: IData | null
  AGBaseId?: string | null
  mode?: `auto` | `reply` | `edit`
  options?: IOptReply | IOptEdit | null
  richOptions?: IOptReplyRich | null
  fallbackEdit?: IOptFallbackEdit
  chunkSize?: number | null
})
```

The single text method. `mode` defaults to `auto` (send-vs-edit resolution in `route-render-auto.md`); plain-vs-rich is decided at compile time by the `<g-message>` block, so `richOptions` only shapes the rich payload. Without `chunkSize` this is the everyday send/edit call.

### `chunkSize`

When `chunkSize` is present (not `undefined`/`null`), a long `<g-message>` is sent as sequential reply chunks instead of one message. `4096` — Telegram's per-message limit — is the fallback for a non-finite or non-positive value.

- **The keyboard rides only the LAST chunk** — a multi-chunk message does not repeat it.
- The cut prefers the last **paragraph break** (`\n\n`) in the window, then the last **newline** (`\n`), then the last **space**, then a hard cut. Each piece is trimmed and empty pieces are dropped.
- **Placeholders resolve before splitting** — interpolation and filter pipes run first, so escaped output can never be torn mid-tag.
- **It is a REPLY path:** a multi-message split has no in-place edit, so `mode` does not apply — when both are passed, the chunked reply wins.

```typescript
// a long `<g-message>` becomes several messages automatically
await this.renderText({AGBaseId: Base.report, keyboard: this.helper.reportKeyboard(), data: {report}, chunkSize: 4096})
```

A mid-loop failure throws with the recorded chunk index — a partial send is never a silent partial delivery.

## `renderEditCaption`

```typescript
async renderEditCaption(params: {
  keyboardInline?: IInlineKb | null
  data?: IData | null
  AGBaseId: string
  options?: IOptEditCaption | null
  fallbackEdit?: IOptFallbackEdit
})
```

Edits the caption in place, keeping the media. `keyboardInline` and `data` are both optional: `await this.renderEditCaption({AGBaseId: 'photo-card'})` reuses whatever the template's base already declares.

`fallbackEdit` is a field here precisely because caption edits fail on a message that has no caption, so a fallback reply is often needed. Same three values as everywhere else: `delete-reply` (default), `reply`, `disable`.

## `renderEditKeyboard`

```typescript
async renderEditKeyboard(params: {
  keyboardInline?: IInlineKb | null
  data?: IData | null
  AGBaseId: string
  options?: IOptEditKeyboard | null
})
```

Swaps only the reply markup — text and media untouched, no resend.

When `keyboardInline` is omitted (or `null`), markup builds from the template's `<g-keyboard type="inline">` labels, and **each label becomes both the button text and its callback data** (`built.text(label, label)`). That is why template-driven keyboards should use labels that are valid callback payloads.

Note there is **no `fallbackEdit`** field here — unlike `renderEditCaption`. Editing markup on an uncaptioned, unkeyboarded message is the only realistic failure and is not papered over.

## `renderGift`

```typescript
async renderGift(params: {
  target: number
  giftId: string
  keyboard?: IInlineKb | null
  data?: IData | null
  AGBaseId: string
  options?: IOptGift | null
})
```

Sends a gift; `target` is the chat/user id. HTML markup **inside `<g-gift>` is legal** because the send uses `text_parse_mode: HTML` — so the block can carry formatting, not just a plain caption.

## Template-backed query answers

These read their text from a template block instead of taking a literal string, so the answer is translatable and lives with the page's markup.

| Method | Block | Params |
| --- | --- | --- |
| `renderCallbackAnswer` | `<g-callback-answer>` | `{showAlert, data?, AGBaseId, options?}` |
| `renderPreCheckout` | `<g-precheckout-error>` | `{ok, data?, AGBaseId, options?}` |
| `renderShipping` | `<g-shipping-error>` | `{ok, data?, AGBaseId, options?}` |
| `renderInlineAnswer` | `<g-inline-button>` | `{results, data?, AGBaseId, options?, buttonStartParameter?}` |
| `renderGuestAnswer` | — | `{result, data?, AGBaseId, options?}` |
| `renderWebAppAnswer` | — | `{webAppQueryId, result, data?, AGBaseId, options?}` |

```typescript
// the answer text comes from the template, localized, not a hardcoded string
async handleCallbackQueryData() {
  await this.renderCallbackAnswer({showAlert: true, AGBaseId: Base.default})
}
```

Two behaviors worth knowing:

- `showAlert: true` raises a Telegram alert instead of a toast.
- `renderPreCheckout` resolves its block **even when `ok=true`**, as fail-fast validation that the template exists. A missing block throws on the success path too.

Send failures are classified via `Ctx.classifySendError`, reported to `notifySendError`, logged (`retryable` → `error`, `fallback-text` → `warn`), and then **always rethrown untouched**. Plan for the throw rather than assuming a silent no-op.

## Forum topics

There is no dedicated thread helper. Pass `message_thread_id` through the `options` field of any `render*` method:

```typescript
// target a forum topic on a normal render
await this.renderText({AGBaseId: Base.default, keyboard: this.inlineKeyboardT([StartPage], `1`), data: {amount: 100}, options: {message_thread_id: threadId}})
```

A passthrough for `msg.is_topic_message` exists on the send paths, so replies inside a topic thread automatically. There is no forum-topic sample page in `example/`, so this path is unproven in practice — verify it before relying on it.

## Prefer `render*` over raw grammY

For anything a page renders or answers, use the `render*` method rather than the raw grammY call underneath it. Answers resolved from a template block are localizable via `lang`, live with the page's markup, and are covered by the AOT parity suite; a hardcoded `answerCallbackQuery({text})` is none of those.

```typescript
// yes — template-backed, localizable, test-locked
await this.renderCallbackAnswer({showAlert: true, AGBaseId: Base.denied})

// no — hardcoded, untranslatable, skipped by every lang rule
await this.answerCallbackQuery({text: `Forbidden`})
```

**The one exception** is a reply sent before or outside any page — currently just `hookRateLimited`, which receives a bare ctx with no page loaded, so no template block can be resolved. There, raw grammY is correct. See `deploy-runtime.md`.

## Provenance and coverage

Every method in this rule is locked by a unit test, but **none is used in `example/` or in the `create-gramstax` templates** — so they are unit-proven, not exercised in a real project:

| Method | Test |
| --- | --- |
| `renderText` with `chunkSize` | `core.ctx.render-text-chunked.test.ts` |
| `renderEditCaption`, `renderEditKeyboard` | `core.ctx.render-edit-caption-keyboard.test.ts` |
| `renderGift` | `core.ctx.render-gift.test.ts` |
| `renderCallbackAnswer`, `renderPreCheckout`, `renderShipping` | `core.ctx.render-callback-payment.test.ts` |
| `renderInlineAnswer`, `renderGuestAnswer`, `renderWebAppAnswer` | `core.ctx.render-inline-answer.test.ts` |

## Notes

- `AGBaseId` is required on the methods that resolve an explicit block (the two edit methods, `renderGift`, and the query answers) — the base id is what selects the block, so it cannot be omitted. The other fields accept `undefined`/`null`.
- `options` is generally an abort signal, spread last into the Telegram call, except on the answers where it can override the block text (`renderPreCheckout`).
- Every one of these emits the matching `ITCompiledTemplate` field, so all of them are covered by the AOT parity suite. See `template-aot.md`.
- The `<g-callback-answer>`, `<g-precheckout-error>`, `<g-shipping-error>`, `<g-inline-button>`, `<g-answer-note>`, and `<g-gift>` blocks are in the PAGE registry — see `template-logic.md`.
- Assert these in e2e through the captured API payload: `e2e.lastCall('editMessageCaption')?.body`, `e2e.extractText(call)`, `e2e.calls.map(c => c.method)`. See `e2e-validation.md`.
