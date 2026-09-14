# e2e-validation

Assert every call (not just the last), against `gmsg`/`gkb`/`gmedia` expectations.

## Why

A single update fans out to several API calls (`answerCallbackQuery` → `sendChatAction` → `sendMessage`); asserting only the last one hides missing, extra, or misordered calls. Template helpers (`gmsg`/`gkb`/`gmedia`) tie assertions to the template source so markup drift fails the test, not production.

## Incorrect

```typescript
const responses = await e2e.sendCallbackQuery(intent, asUser)
expect(responses.length).toBeGreaterThan(0) // what was actually sent?
```

## Correct

```typescript
const responses = await e2e.sendCallbackQuery(intent, asUser)
expect(responses.length).toBeGreaterThan(0)
const methods = e2e.calls.map((c) => c.method)
expect(methods[0]).toBe(`answerCallbackQuery`)
expect(methods).toContain(`sendMessage`)
expect(methods).not.toContain(`sendSticker`)

const msg = e2e.lastCall(`sendMessage`)!
expect(msg.body?.text).toBe(e2e.gmsg(intent, agBaseId, {}))
expect(e2e.extractButtonLabels(msg)).toEqual(e2e.gkb(intent, agBaseId, `inline`, {}))
const edit = e2e.lastCall(`editMessageText`)! // edits never appear in responses
```

## Notes

- `parse_mode` must be `HTML` when the template uses markup; absent `reply_markup` when the page has no keyboard.
- Media: validate `photo`+`caption`, `media[]` items (`type`/`media`/`caption`), `deleteMessage` before `sendVoice`, `sendChatAction` before large media.
- Streams: final call must be `sendRichMessage` (not a dangling draft); `streamChunks()` last chunk matches `gmsg`.
- Dynamic content (timestamps, names): `toContain`/`toStartWith`, never exact `toBe`.
