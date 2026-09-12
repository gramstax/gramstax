# E2E Validation Rules

## 0. Structure Mirroring — `e2e/` vs `src/pages/`

The `e2e/` directory structure **MUST** mirror `src/pages/` exactly:

```
src/pages/                   e2e/
├── start.ts      ──────▶    ├── start.test.ts
├── start/                   ├── start/
│   ├── random/              │   ├── random/
│   │   ├── index.ts  ──▶    │   │   ├── index.test.ts
│   │   ├── number.ts  ──▶   │   │   ├── number.test.ts
│   │   └── text.ts  ──▶     │   │   └── text.test.ts
├── help.ts        ──────▶   ├── help.test.ts
├── sum-number.ts  ──────▶   ├── sum-number.test.ts
```

**Rules:**
- Every `.ts`/`.js` file in `src/pages/` **MUST** have a corresponding `.test.ts`/`.test.js` file in `e2e/` at the same relative path
- `index.ts` → `index.test.ts` (not `index.test.ts` at parent level)
- File naming: `foo.ts` → `foo.test.ts` (pages root), `foo/bar.ts` → `foo/bar.test.ts` (subdirectory)
- `setup.ts` is excluded (test harness, not a page test)

**Verification tools** (available in generated projects):
```bash
bun run scripts/check-e2e-mirror.ts          # Check mirror integrity
bun run scripts/check-e2e-mirror.ts --fix    # Auto-create missing test stubs
bun run scripts/generate-e2e-structure.ts    # Generate test stubs in bulk
```

**Rationale:** Mirror structure ensures every page has at minimum a registration test, preventing orphaned pages from going unnoticed.

## 1. Response Existence

Every test **MUST** validate that a response exists before accessing its properties:

```typescript
expect(responses.length).toBeGreaterThan(0); // response exists
expect(responses[0]).toBeDefined(); // response is not undefined
```

## 2. Message Validation

Every response message **MUST** validate:

| Field              | Required? | Description                                     |
| :----------------- | :-------- | :---------------------------------------------- |
| `body?.text`       | ✅ YES    | Use `e2e.gmsg()` for exact match                |
| `body?.parse_mode` | ✅ YES    | If template uses HTML/Markdown, validate `HTML` |
| `body?.caption`    | ✅ YES    | For media messages, validate caption            |
| `body?.entities`   | ⚠️        | If there are special entities (bold, url)       |

**Dynamic content**: If the message contains dynamic data (timestamp, random number, user input), use `toContain` or `toStartWith` — not `toBe`.

```typescript
// Exact match
expect(msg.body?.text).toBe(e2e.gmsg(intent, agBaseId, {}))

// Partial match for dynamic content
expect(msg.body?.text).toContain(\`Deposit\`)
expect(msg.body?.text).toStartWith(\`✅\`)
```

## 3. Keyboard Validation

### Inline Keyboard

Every inline keyboard **MUST** validate:

| Field                               | Required? | Description                                     |
| :---------------------------------- | :-------- | :---------------------------------------------- |
| Button **text** (label)             | ✅ YES    | `e2e.extractButtonLabels()` + `e2e.gkb()` match |
| Button **callback_data**            | ✅ YES    | `e2e.extractCallbackData()` — each button valid |
| Count callback_data == count labels | ✅ YES    | Ensure no button is missing callback_data       |
| callback_data must not be empty     | ✅ YES    | `expect(data).toBeDefined()` + `.length > 0`    |

```typescript
const labels = e2e.extractButtonLabels(msg)
const cbData = e2e.extractCallbackData(msg)

// Text validation
expect(labels).toEqual(e2e.gkb(intent, agBaseId, \`inline\`, {}))

// callback_data validation
expect(cbData).toHaveLength(labels.length)
cbData.forEach((data, i) => {
  expect(data).toBeDefined()
  expect(typeof data).toBe(\`string\`)
  expect(data.length).toBeGreaterThan(0)
})
```

### Bottom Keyboard

Every bottom keyboard **MUST** validate:

| Field                          | Required? | Description                                     |
| :----------------------------- | :-------- | :---------------------------------------------- |
| Button **text** (label)        | ✅ YES    | `e2e.extractBottomLabels()` + `e2e.gkb()` match |
| `reply_markup.keyboard` exists | ✅ YES    | Ensure keyboard structure is correct            |
| `reply_markup.resize_keyboard` | ✅ YES    | Must be `true` for UX                           |

```typescript
const bottomLabels = e2e.extractBottomLabels(msg)
expect(bottomLabels).toEqual(e2e.gkb(intent, agBaseId, \`bottom\`, {}))
expect(msg.body?.reply_markup?.keyboard).toBeDefined()
expect(msg.body?.reply_markup?.resize_keyboard).toBe(true)
```

## 4. Media Validation

Every media action **MUST** validate:

| API Call           | Required validation                               |
| :----------------- | :------------------------------------------------ |
| `sendPhoto`        | `photo`, `caption`                                |
| `sendVideo`        | `video`, `caption`                                |
| `sendAudio`        | `audio`, `caption`                                |
| `sendDocument`     | `document`, `caption`                             |
| `sendAnimation`    | `animation`, `caption`                            |
| `sendVoice`        | `voice`, `caption`                                |
| `sendVideoNote`    | `video_note`                                      |
| `sendSticker`      | `sticker`                                         |
| `sendMediaGroup`   | `media[]` — each item: `type`, `media`, `caption` |
| `editMessageMedia` | `media.type`, `media.media`, `media.caption`      |
| `sendLocation`     | `latitude`, `longitude`                           |
| `sendContact`      | `phone_number`, `first_name`                      |

Use `e2e.gmedia()` to get the expected values:

```typescript
expect(req.body?.photo).toBe(e2e.gmedia(intent, agBaseId, {}).src);
expect(req.body?.caption).toBe(e2e.gmedia(intent, agBaseId, {}).caption);
```

## 5. API Method Validation

Sometimes the bot responds with unexpected API methods. Use method inspection:

```typescript
// Check which API methods were called
const methods = e2e.calls.map(c => c.method)
expect(methods).toContain(\`sendMessage\`)

// For voice which cannot use editMessageMedia
if (methods.includes(\`deleteMessage\`)) {
  expect(methods).toContain(\`sendVoice\`)
}
```

## 6. Callback Query Answer Validation

Many bots call `answerCallbackQuery` as the first response (before `sendMessage`) to stop the loading indicator on Telegram buttons. **MUST** be validated:

```typescript
const firstCall = e2e.calls[0]
expect(firstCall.method).toBe(\`answerCallbackQuery\`)

// If there is alert text
if (firstCall.body?.text) {
  expect(firstCall.body.text).toBe(\`Expected alert text\`)
  expect(typeof firstCall.body.text).toBe(\`string\`)
  expect(firstCall.body.text.length).toBeGreaterThan(0)
}

// If show_alert (popup, not toast)
if (firstCall.body?.show_alert) {
  expect(firstCall.body.show_alert).toBe(true)
}

// If url (for login/webapp button)
if (firstCall.body?.url) {
  expect(firstCall.body.url).toStartWith(\`https://\`)
}
```

**REQUIRED** for every page that uses inline keyboard — ensure `answerCallbackQuery` is not forgotten.

## 7. No-Keyboard Validation

Some pages have no keyboard at all (text only). **MUST** validate that `reply_markup` is absent:

```typescript
// Page without keyboard
expect(msg.body?.reply_markup).toBeUndefined();

// Or if the page has an empty inline keyboard
if (msg.body?.reply_markup?.inline_keyboard) {
  expect(msg.body.reply_markup.inline_keyboard).toHaveLength(0);
}
```

## 8. Edit Message Validation

When the bot edits an existing message (`editMessageText`, `editMessageCaption`, `editMessageReplyMarkup`), validate the edited content:

```typescript
// editMessageText — get from e2e.calls directly, not from responses
const editReq = e2e.lastCall(\`editMessageText\`)
expect(editReq).toBeDefined()
expect(editReq!.body?.text).toBe(e2e.gmsg(intent, agBaseId, {}))
expect(editReq!.body?.parse_mode).toBe(\`HTML\`)

// If only editing reply_markup (without changing text)
const editMarkupReq = e2e.lastCall(\`editMessageReplyMarkup\`)
expect(editMarkupReq).toBeDefined()
const cbData = e2e.extractCallbackData(editMarkupReq)
expect(cbData).toBeDefined()
```

**Note**: `editMessageText` and `editMessageReplyMarkup` do NOT appear in the `responses` array (because they are not sendMessage) — they must be retrieved via `e2e.lastCall()` or `e2e.calls.filter()`.

## 9. Multi-Call Validation (One Update → Multiple API Calls)

A single update can trigger multiple API calls at once. **MUST** validate ALL calls produced:

```typescript
const responses = await e2e.sendCallbackQuery(intent, asUser)
expect(responses.length).toBeGreaterThan(0)

// Get all methods that were called
const methods = e2e.calls.map(c => c.method)

// Common pattern: answerCallbackQuery + sendMessage
expect(methods[0]).toBe(\`answerCallbackQuery\`)
expect(methods).toContain(\`sendMessage\`)

// Example pattern: answerCallbackQuery + sendPhoto + sendMessage
expect(methods).toEqual([
  \`answerCallbackQuery\`,
  \`sendPhoto\`,
  \`sendMessage\`
])

// Example pattern: deleteMessage + sendVoice (voice edit)
expect(methods).toContain(\`deleteMessage\`)
expect(methods).toContain(\`sendVoice\`)
// deleteMessage must be called BEFORE sendVoice
const deleteIdx = methods.indexOf(\`deleteMessage\`)
const sendIdx = methods.indexOf(\`sendVoice\`)
expect(deleteIdx).toBeLessThan(sendIdx)

// Ensure no unexpected calls
expect(methods).not.toContain(\`sendSticker\`)
```

## 10. Chat Action Validation

If a page sends large media (photo, video, audio, document), the bot typically calls `sendChatAction` first. **MUST** validate:

```typescript
const methods = e2e.calls.map(c => c.method)

// Check sendChatAction exists
const chatActionIdx = methods.indexOf(\`sendChatAction\`)
expect(chatActionIdx).not.toBe(-1)

// Check the action type
const chatActionCall = e2e.calls[chatActionIdx]
expect(chatActionCall.body?.action).toBe(\`upload_photo\`)

// Chat action must be before media
const sendPhotoIdx = methods.indexOf(\`sendPhoto\`)
expect(chatActionIdx).toBeLessThan(sendPhotoIdx)
```

Common action types: `typing`, `upload_photo`, `upload_video`, `upload_audio`, `upload_document`, `find_location`.

## 11. Dice, Poll, Invoice, Location, Contact — Specific Validation

### Dice

```typescript
const sendDiceReq = e2e.lastCall(\`sendDice\`)
expect(sendDiceReq!.body?.emoji).toBe(\`🎲\`)
```

### Poll

```typescript
const sendPollReq = e2e.lastCall(\`sendPoll\`)
expect(sendPollReq!.body?.question).toBe(\`Question?\`)
expect(sendPollReq!.body?.options).toBeDefined()
expect(sendPollReq!.body?.options!.length).toBeGreaterThan(1)
expect(sendPollReq!.body?.type).toBe(\`regular\`)   // or \`quiz\`
expect(sendPollReq!.body?.is_anonymous).toBe(true)
expect(sendPollReq!.body?.allows_multiple_answers).toBe(false)

// If quiz
if (sendPollReq!.body?.type === \`quiz\`) {
  expect(sendPollReq!.body?.correct_option_id).toBeDefined()
}
```

### Invoice (Payment)

```typescript
const sendInvoiceReq = e2e.lastCall(\`sendInvoice\`)
expect(sendInvoiceReq!.body?.title).toBeDefined()
expect(sendInvoiceReq!.body?.description).toBeDefined()
expect(sendInvoiceReq!.body?.payload).toBeDefined()
expect(sendInvoiceReq!.body?.currency).toBe(\`USD\`)  // or IDR, etc.
expect(sendInvoiceReq!.body?.total_amount).toBeGreaterThan(0)
```

### Location

```typescript
const sendLocationReq = e2e.lastCall(\`sendLocation\`)
expect(sendLocationReq!.body?.latitude).toBeGreaterThanOrEqual(-90)
expect(sendLocationReq!.body?.latitude).toBeLessThanOrEqual(90)
expect(sendLocationReq!.body?.longitude).toBeGreaterThanOrEqual(-180)
expect(sendLocationReq!.body?.longitude).toBeLessThanOrEqual(180)
```

### Contact

```typescript
const sendContactReq = e2e.lastCall(\`sendContact\`)
expect(sendContactReq!.body?.phone_number).toMatch(/^\\+?\\d{6,15}$/)
expect(sendContactReq!.body?.first_name).toBeDefined()
if (sendContactReq!.body?.last_name) {
  expect(typeof sendContactReq!.body?.last_name).toBe(\`string\`)
}
```

## 12. Stream Reply Validation

The grammY stream plugin uses three custom API methods — **not** `sendMessage`:

| Method                 | Body shape                               | Description                        |
| ---------------------- | ---------------------------------------- | ---------------------------------- |
| `sendMessageDraft`     | `{ text }`                               | Plain text chunk                   |
| `sendRichMessageDraft` | `{ rich_message: { html \| markdown } }` | Rich text chunk (HTML / Markdown)  |
| `sendRichMessage`      | `{ rich_message: { html \| markdown } }` | Final complete message after flush |

The E2eHelper provides dedicated helpers for stream inspection:

- `e2e.streamCalls()` — returns all stream-related calls
- `e2e.streamChunks()` — extracts all text chunks as `string[]`
- `e2e.extractText(call)` — extracts text from any call (handles both `text` and `rich_message.html`)

**MUST** validate the final flushed message:

```typescript
const responses = await e2e.sendCallbackQuery(intent, asUser)
expect(responses.length).toBeGreaterThan(0)

// The responses array includes ALL calls (drafts + final + answerCallbackQuery).
// The final complete text is in sendRichMessage.
const finalCall = e2e.lastCall(\`sendRichMessage\`)
expect(finalCall).toBeDefined()
expect(e2e.extractText(finalCall!)).toBe(e2e.gmsg(intent, agBaseId, {}))
```

**MUST** validate stream chunks for incremental rendering correctness:

```typescript
const chunks = e2e.streamChunks()
expect(chunks.length).toBeGreaterThan(0)

// Each chunk should be non-empty
chunks.forEach((chunk) => {
  expect(typeof chunk).toBe(\`string\`)
  expect(chunk.length).toBeGreaterThan(0)
})

// The last chunk should match the final complete text
const lastChunk = chunks[chunks.length - 1]
expect(lastChunk).toBe(e2e.gmsg(intent, agBaseId, {}))
```

**MUST** validate `sendRichMessage` is the last stream call (not a dangling draft):

```typescript
const streamMethods = e2e.streamCalls().map((c) => c.method)
expect(streamMethods[streamMethods.length - 1]).toBe(\`sendRichMessage\`)
```

If `replyWithHtmlStream` was used, the rich message body contains `rich_message.html`; if `replyWithMarkdownStream` was used, it contains `rich_message.markdown`.

```typescript
// Check specific format
const finalBody = finalCall!.body as any
if (finalBody?.rich_message?.html) {
  expect(typeof finalBody.rich_message.html).toBe(\`string\`)
}
if (finalBody?.rich_message?.markdown) {
  expect(typeof finalBody.rich_message.markdown).toBe(\`string\`)
}
```

## 13. Language Variant Testing (if applicable)

If the project supports multi-language, add tests with a different `language_code`:

```typescript
const responsesLang = await e2e.sendCallbackQuery(intent, {
  user: {language_code: \`<other-lang>\`}
})
expect(responsesLang[0]!.body?.text).toBe(e2e.gmsg(intent, agBaseId, {}, \`<other-lang>\`))
expect(e2e.extractButtonLabels(responsesLang[0])).toEqual(
  e2e.gkb(intent, agBaseId, \`inline\`, {}, \`<other-lang>\`)
)
```

Template pattern:

```
<g-keyboard type="inline">Button1, Button2</g-keyboard>
<g-keyboard type="inline" lang="<other-lang>">Button1, Button2</g-keyboard>

<g-message>English text</g-message>
<g-message lang="<other-lang>">Other language text</g-message>
```

---

## Assertion Rules Summary

| Category               | Req? | Validation Method                                                                                                                           |
| :--------------------- | :--- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| Response existence     | ✅   | `responses.length > 0`, `responses[0].toBeDefined()`                                                                                        |
| Message text           | ✅   | `toBe(e2e.gmsg(...))` or `toContain` for dynamic                                                                                            |
| Message parse_mode     | ✅   | `toBe(\`HTML\`)` if template uses HTML                                                                                                      |
| Keyboard labels        | ✅   | `toEqual(e2e.gkb(...))`                                                                                                                     |
| Keyboard callback_data | ✅   | `e2e.extractCallbackData()`, length match, each entry valid                                                                                 |
| Bottom keyboard        | ✅   | `e2e.extractBottomLabels()`, check `reply_markup.keyboard`                                                                                  |
| No keyboard            | ✅   | `reply_markup` must be `toBeUndefined()` if page has none                                                                                   |
| answerCallbackQuery    | ✅   | `e2e.calls[0].method === \`answerCallbackQuery\``                                                                                           |
| Method call order      | ✅   | `expect(methods).toEqual([...])` ensures correct order                                                                                      |
| Multi-call validation  | ✅   | All calls validated, not just `lastCall()`                                                                                                  |
| sendChatAction         | ⚠️   | If sending large media, validate `sendChatAction` exists                                                                                    |
| Media src/caption      | ✅   | `toBe(e2e.gmedia(...).src)` / `.caption`                                                                                                    |
| Edit message           | ✅   | Get from `e2e.lastCall(\`editMessageText\`)`, not responses                                                                                 |
| Stream reply           | ✅   | Final output is `sendRichMessage` (`body.rich_message.html`); validate via `e2e.streamCalls()` / `e2e.streamChunks()` / `e2e.extractText()` |
| Fallback (general)     | ✅   | Route Not Found → validate `StatusPage` response                                                                                            |
| Dice/Poll/Invoice      | ✅   | Validate specific fields per media type                                                                                                     |
| Location               | ✅   | Validate lat range (-90..90) and lng (-180..180)                                                                                            |
| Contact                | ✅   | Validate `phone_number` format, `first_name`                                                                                                |
