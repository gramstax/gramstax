# e2e-validation

**Verdict:** assert the method, the payload, and the absence of the wrong effect. `length > 0` is not a test.

## Why

One update can fan out to several Bot API calls. The default `renderText` route edits on a callback and sends on a message; a page with a keyboard adds `reply_markup`; media adds `editMessageMedia`; streams add drafts. Asserting only "something happened" hides duplicate sends, missing keyboards, wrong routes, and markup drift. Comparing against `gmsg`/`gkb`/`gmedia` ties the assertion to the same compiled template the page renders, so the test fails when the template changes — not in production.

## The call record

Every captured call is:

```typescript
type IE2eApiCall = {
  method: string                      // sendMessage, editMessageText, answerCallbackQuery, …
  body: Record<string, unknown>       // method-specific payload
  timestamp: number                   // Date.now() at capture; do not assert
}
```

- `e2e.calls` — every call since `clearCalls()`, in order.
- The value returned by `send*` / `handleUpdate` — the slice produced **by that update**, even if earlier calls are still in `calls`.
- `e2e.lastCall(method?)` — the most recent call, optionally filtered.
- `e2e.bodyOf<T>(call)` — narrows `body` to the shape you are asserting. `body` is deliberately `Record<string, unknown>` because the Bot API differs per method.

Boot traffic (`getMe`, `getWebhookInfo`, `setWebhook`, `getMyCommands`, `getUpdates`) is answered but never recorded.

## Assertion layers

### 1. The update was handled

```typescript
const responses = await e2e.sendCallbackQuery(intent, enUser)
expect(responses.length).toBeGreaterThan(0)
```

This is the floor. It is never the whole test.

A **silent denial** is the one legitimate zero-call result: `hookBeforeRoute` returns `false` without rendering. Assert `0` only when that is the app's contract (see `e2e-coverage.md`).

### 2. The right method ran — and the wrong one did not

```typescript
const methods = responses.map((call) => call.method)

expect(methods[0]).toBe(`editMessageText`)       // callback ⇒ auto-edit
expect(methods).not.toContain(`sendMessage`)     // no duplicate send
```

For a message update:

```typescript
const responses = await e2e.sendText(`/start`, enUser)
expect(responses.map((c) => c.method)).toContain(`sendMessage`)
expect(responses.map((c) => c.method)).not.toContain(`editMessageText`)
```

The negative assertion is mandatory whenever the route matters. A test that only asserts the expected method passes when the page also sends a duplicate.

### 3. Text matches the compiled template

```typescript
const reply = responses[0]!
expect(e2e.extractText(reply)).toBe(e2e.gmsg(intent, `default`, {}))
```

- `e2e.extractText(call)` reads `rich_message.html` → `rich_message.markdown` → `text` → `caption`, in that order. Use it instead of guessing which field the render path produced.
- `e2e.gmsg(page, AGBaseId, data?, lang?)` takes the page key, the `<g-base id>` (usually `default`), the same data the page passed, and the language. It throws when the block does not exist — that is a real failure, not a skipped assertion.
- When the page passes a computed value (`{name: this.from.first_name}`), pass the same literal in the test: `gmsg(intent, 'default', {name: 'Test'})`.
- Dynamic values (timestamps, generated ids, order numbers) cannot use `toBe`. Assert the stable frame with `toContain` / `toStartWith`, and assert one computed fragment with a regex.

```typescript
expect(text).toStartWith(`🧵 Worker counter`)
expect(text).toMatch(/Count: \d+/)
```

### 4. Keyboard matches the compiled template

```typescript
const reply = responses[0]!
expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(intent, `default`, `inline`, {}))
```

- `gkb(page, AGBaseId, type, data?, lang?)` returns the flattened labels in declaration order. `type` is `inline` or `bottom`.
- `extractButtonLabels(call)` flattens `reply_markup.inline_keyboard` **and** `reply_markup.keyboard`, in that order, dropping empty labels. Compare with `toEqual`, not `toContain`, so order and count both matter.
- When the page has no keyboard, assert absence:

```typescript
expect(e2e.bodyOf<{reply_markup?: unknown}>(reply)?.reply_markup).toBeUndefined()
```

- When you need the callback payload (not just the label), read it directly:

```typescript
const buttons = e2e.bodyOf<{reply_markup?: {inline_keyboard?: Array<Array<{text?: string; callback_data?: string}>>}}>(reply)?.reply_markup?.inline_keyboard?.flat()
const next = buttons?.find((button) => button.text?.includes(`Confirm`))
expect(next?.callback_data).toBe(`${intent}:confirm`)
```

### 5. Media matches the compiled media block

A callback media render edits the message:

```typescript
const edited = e2e.lastCall(`editMessageMedia`)!
const media = e2e.bodyOf<{media?: {type?: string; media?: unknown; caption?: string}}>(edited)?.media
const expected = e2e.gmedia(intent, `default`, {})

expect(media?.type).toBe(expected.type)
expect(media?.media).toBe(expected.src)
expect(media?.caption).toBe(expected.caption)
```

A message media render sends:

```typescript
expect(e2e.lastCall(`sendPhoto`)?.body?.photo).toBe(e2e.gmedia(intent, `default`, {}).src)
expect(e2e.lastCall(`sendVoice`)?.body?.voice).toBe(e2e.gmedia(intent, `default`, {}).src)
```

A media group always sends (groups cannot edit):

```typescript
const group = e2e.lastCall(`sendMediaGroup`)!
const items = e2e.bodyOf<{media: Array<{type?: string; caption?: string}>}>(group)!.media
expect(Array.isArray(items)).toBe(true)
expect(items.length).toBe(e2e.gmedia(intent, `default`, {}).mediaGroup!.length)
expect(items[0]?.type).toBe(`photo`)
```

Rules:

- `gmedia` returns `{kind: 'media', type, src, caption}`; a group adds `mediaGroup: Array<{type, src, caption}>`.
- Assert `media.type` and `media.media` (the `src`), not only the caption. A wrong file with the right caption is a bug.
- For `deleteMessage`-then-send flows, assert **order**: the delete call appears before the send call in `responses`.
- For `sendChatAction` before a large upload, assert it precedes the media send when the page does that.

### 6. Callback answers and alerts

```typescript
const answer = e2e.lastCall(`answerCallbackQuery`)
expect(answer?.body?.text).toBe(`Saved`)
expect(answer?.body?.show_alert).toBe(true)
```

`answerCallbackQuery` is **not** automatic. If the page does not call `renderCallbackAnswer`, the test must not expect it.

### 7. Route contracts

Cover the route the page declared, on both input shapes when both are possible:

| Route | Callback | Message |
| --- | --- | --- |
| `auto` (default) | `editMessageText` | `sendMessage` |
| `mode: 'reply'` | `sendMessage` | `sendMessage` |
| `mode: 'edit'` | `editMessageText` | `editMessageText` or the page's documented fallback when no editable message exists |
| `fallback` | edit fails → `fallbackOptions` path | — |

If the page forces `reply`, assert `methods` does not contain an edit. If it forces `edit`, assert no send. A route regression is invisible when the test accepts either method. A forced edit on a message update has no callback message to edit; assert the page's documented behavior (edit attempt or fallback) instead of assuming the edit succeeds.

### 8. Multi-call and multi-page flows

For a flow spanning updates, assert each step independently and clear calls between steps so a previous step cannot satisfy the assertion:

```typescript
await e2e.sendCallbackQuery(`sum-number`, enUser)
e2e.clearCalls()

const step = await e2e.sendText(`23`, enUser)
expect(step[0]!.body?.text).toBe(e2e.gmsg(`sum-number`, `r`, {}))
e2e.clearCalls()

const result = await e2e.sendText(`10`, enUser)
expect(result[0]!.body?.text).toContain(`33`)
```

For a fan-out inside one update (broadcast, multi-message render), assert the count and each recipient:

```typescript
const sends = responses.filter((call) => call.method === `sendMessage`)
expect(sends.map((call) => call.body?.chat_id)).toEqual([123, 456])
```

### 9. Streams

```typescript
expect(e2e.streamChunks().length).toBeGreaterThan(1)

const final = e2e.lastCall()
expect([`sendMessage`, `sendRichMessage`, `editMessageText`]).toContain(final?.method)
expect(e2e.extractText(final!)).toBe(e2e.gmsg(intent, `default`, {}))
```

- `streamCalls()` returns the stream-relevant subset: drafts, edits, rich messages, `sendMessage`, deletes.
- `streamChunks()` returns non-empty `text` / `rich_message.markdown` / `rich_message.html` values in order.
- The last call must be a **final delivered message**, not a dangling draft. The exact method follows the route: `sendMessage` / `sendRichMessage` for send routes, `editMessageText` for edit routes. Assert that explicitly.
- `replyWithStream` awaits the generator, so the calls are captured inside `handleUpdate`; slow generators need an increased test timeout, not a `sleep`.

### 10. State is proven through the next update

Do not read the session or DB to verify a handler. Prove the state by sending the next update and asserting what it renders:

```typescript
await e2e.sendText(`23`, enUser)   // stores left = 23
e2e.clearCalls()
const prompt = await e2e.sendText(`10`, enUser)
expect(prompt[0]!.body?.text).toBe(e2e.gmsg(`sum-number`, `s`, {result: `33`}))
```

For a delete/update flow, assert the list page no longer contains the item after the mutation. That proves the write and the read path together.

## Method → body field reference

| Method | Fields worth asserting |
| --- | --- |
| `sendMessage` / `editMessageText` | `chat_id`, `text`, `parse_mode`, `reply_markup` |
| `sendRichMessage` | `chat_id`, `rich_message.html` / `.markdown`, `reply_markup` |
| `sendPhoto` / `sendVideo` / `sendAudio` / `sendDocument` / `sendAnimation` / `sendVoice` / `sendVideoNote` / `sendSticker` | `chat_id`, the kind field (`photo`, `video`, …), `caption`, `parse_mode` |
| `editMessageMedia` | `chat_id`, `message_id`, `media.type`, `media.media`, `media.caption` |
| `sendMediaGroup` | `chat_id`, `media[]` with `type` + `media` + `caption` |
| `editMessageCaption` | `caption`, `parse_mode` |
| `editMessageReplyMarkup` | `reply_markup` |
| `answerCallbackQuery` | `callback_query_id`, `text`, `show_alert` |
| `answerPreCheckoutQuery` | `ok`, `error_message` |
| `answerShippingQuery` | `ok`, `shipping_options` |
| `answerInlineQuery` | `inline_query_id`, `results` |
| `deleteMessage` | `chat_id`, `message_id` |
| `sendMessageDraft` / `sendRichMessageDraft` | `draft_id`, `text` / `rich_message` |
| `sendPoll` / `sendDice` / `sendGift` / `sendInvoice` / `sendPaidMedia` / `sendVenue` | the kind-specific payload |

## Anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| `expect(responses.length).toBeGreaterThan(0)` alone | No method, route, text, or keyboard proof |
| `expect(text).toBeDefined()` | A blank message passes |
| Asserting `timestamp` | Non-deterministic and irrelevant |
| Asserting exact `message_id` unless set | Helper counters depend on prior updates |
| `toEqual` on text with a timestamp | Fails the next day; use `toContain`/regex for dynamic fragments |
| Literal translated strings instead of `gmsg(..., lang)` | Drifts from the template; hides a missing translation |
| Asserting only the last call | Hides missing/extra/out-of-order calls |
| Reading `bot.cacheState` to verify a write | Tests internals; assert the next render |
| Ignoring the returned slice and using global `e2e.calls` | Previous updates satisfy the assertion |

## Checklist

- [ ] Every test asserts at least one method and the absence of the wrong method when the route matters.
- [ ] Text/caption comes from `extractText` + `gmsg`, or a documented dynamic pattern.
- [ ] Keyboards come from `extractButtonLabels` + `gkb` with the right `type` and language.
- [ ] Media asserts type + source + caption (and group length where applicable).
- [ ] Multi-step flows clear calls between steps.
- [ ] Streams assert chunks and a final non-draft call.
- [ ] State changes are proven by the next update, not by reading the store.
