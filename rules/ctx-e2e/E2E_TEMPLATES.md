# E2E Test File Templates

## Simple page (callback query navigation)

```typescript
import {describe, it, expect, beforeEach} from "bun:test"
import {e2e} from "./setup"

const intent = \`<page-name>\` // matches the class route name
const asUser = {user: {id: <UNIQUE_ID>, username: \`testuser\`}, chat: {id: <UNIQUE_ID>}}

beforeEach(() => {
  e2e.clearCalls()
})

describe(\`E2E: <PageName>\`, () => {
  it(\`show <description>\`, async () => {
    await e2e.sendText(\`/start\`, asUser) // navigate from home
    e2e.clearCalls()

    const responses = await e2e.sendCallbackQuery(intent, asUser)
    const agBaseId = \`<g-base-id>\`

    // ── Response count ──
    expect(responses.length).toBeGreaterThan(0)

    // ── Message validation ──
    const msg = responses[0]
    expect(msg).toBeDefined()
    expect(msg.body?.text).toBe(e2e.gmsg(intent, agBaseId, {}))
    // If the message uses entities: validate parse_mode
    // expect(msg.body?.parse_mode).toBe(\`HTML\`)

    // ── Inline keyboard validation (text + callback_data) ──
    const labels = e2e.extractButtonLabels(msg)
    const cbData = e2e.extractCallbackData(msg)
    expect(labels).toEqual(e2e.gkb(intent, agBaseId, \`inline\`, {}))
    // Each button must have matching callback_data
    expect(cbData).toHaveLength(labels.length)
    cbData.forEach((data, i) => {
      expect(data).toBeDefined()
      expect(typeof data).toBe(\`string\`)
      expect(data.length).toBeGreaterThan(0)
    })
  })
})
```

## Direct text command

```typescript
const responses = await e2e.sendText(\`/command\`, asUser)
expect(responses.length).toBeGreaterThan(0)
expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, \`<g-base-id>\`, {}))
```

## Bottom keyboard page

```typescript
const responses = await e2e.sendText(\`/start\`, asUser)
expect(responses.length).toBeGreaterThan(0)

const msg = responses[0]
// Bottom keyboard labels — each row is an array of button texts
const bottomLabels = e2e.extractBottomLabels(msg)

// Compare with expected
expect(bottomLabels).toEqual(e2e.gkb(intent, \`<g-base-id>\`, \`bottom\`, {}))

// Bottom keyboard buttons only have text, no callback_data —
// they send the text back as a message when tapped.
// Optionally validate that `reply_markup.keyboard` exists:
expect(msg.body?.reply_markup?.keyboard).toBeDefined()
expect(msg.body?.reply_markup?.resize_keyboard).toBe(true)
```

## Media page (editMessageMedia)

```typescript
await e2e.sendCallbackQuery(intent, asUser)

const editMediaReq = e2e.lastCall(\`editMessageMedia\`)
expect(editMediaReq!.body?.media?.type).toBe(\`photo\`)
expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(intent, \`<g-base-id>\`, {}).src)
expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(intent, \`<g-base-id>\`, {}).caption)
```

## Stream reply page (replyWithStream / replyWithMarkdownStream / replyWithHtmlStream)

Stream pages use **custom API methods** — not `sendMessage`. The stream plugin emits `sendMessageDraft` (plain text chunks), `sendRichMessageDraft` (rich text chunks), and `sendRichMessage` (final flush).

```typescript
const responses = await e2e.sendCallbackQuery(intent, asUser)
expect(responses.length).toBeGreaterThan(0)

// The responses array includes ALL calls (drafts + final + answerCallbackQuery).
// Use extractText to read text from any call (handles both sendMessage.text
// and sendRichMessage.rich_message.html).
const finalCall = e2e.lastCall(\`sendRichMessage\`)
expect(finalCall).toBeDefined()
expect(e2e.extractText(finalCall!)).toBe(e2e.gmsg(intent, agBaseId, {}))

// Validate all stream chunks
const chunks = e2e.streamChunks()
expect(chunks.length).toBeGreaterThan(0)
expect(chunks[chunks.length - 1]).toBe(e2e.gmsg(intent, agBaseId, {}))

// Validate last stream method is sendRichMessage (not a dangling draft)
const streamMethods = e2e.streamCalls().map((c) => c.method)
expect(streamMethods[streamMethods.length - 1]).toBe(\`sendRichMessage\`)

// If replyWithHtmlStream was used, rich_message.html contains the text
// If replyWithMarkdownStream was used, rich_message.markdown contains the text
const body = finalCall!.body as any
if (body?.rich_message?.html) {
  expect(typeof body.rich_message.html).toBe(\`string\`)
}
if (body?.rich_message?.markdown) {
  expect(typeof body.rich_message.markdown).toBe(\`string\`)
}
```

**Note:** The `stream: true` param must be set in `setup.ts` for these methods to be available at runtime.

**Note:** Voice messages cannot be edited in-place. `editVoice()` uses `deleteMessage` + `sendVoice` instead of `editMessageMedia`. Check the actual API method via `e2e.calls.map(c => c.method)` if unsure.

## Send-based media (sticker, voice, video_note)

```typescript
const sendStickerReq = e2e.lastCall(\`sendSticker\`)
expect(sendStickerReq!.body?.sticker).toBe(e2e.gmedia(intent, \`<g-base-id>\`, {}).src)
```

## Media group

```typescript
const sendMediaGroupReq = e2e.lastCall(\`sendMediaGroup\`)
expect(Array.isArray(sendMediaGroupReq!.body?.media)).toBe(true)
sendMediaGroupReq!.body?.media!.forEach((item: any) => {
  expect(item.type).toBe(\`photo\`)
})
```

---

## Flow Tests (multi-step navigation)

Every page with a multi-step flow (form, wizard) **MUST** be tested end-to-end:

```typescript
it(\`full flow\`, async () => {
  await e2e.sendText(\`/start\`, asUser)
  e2e.clearCalls()

  // Step 1 — initial page
  const r1 = await e2e.sendCallbackQuery(\`page1\`, asUser)
  expect(r1[0]!.body?.text).toBe(e2e.gmsg(\`page1\`, \`s1\`, {}))
  // Validate keyboard from step 1
  const labels1 = e2e.extractButtonLabels(r1[0])
  expect(labels1).toEqual(e2e.gkb(\`page1\`, \`s1\`, \`inline\`, {}))

  e2e.clearCalls()

  // Step 2 — send input text
  const r2 = await e2e.sendText(\`user input\`, asUser)
  expect(r2[0]!.body?.text).toBe(e2e.gmsg(\`page1\`, \`s\`, {res: \`user input\`}))
  // Validate keyboard after input
  const labels2 = e2e.extractButtonLabels(r2[0])
  expect(labels2).toEqual(e2e.gkb(\`page1\`, \`s\`, \`inline\`, {res: \`user input\`}))

  e2e.clearCalls()

  // Step 3 — final page
  const r3 = await e2e.sendCallbackQuery(\`page1\`, asUser)
  expect(r3[0]!.body?.text).toBe(e2e.gmsg(\`page1\`, \`s2\`, {}))
})
```

**Flow test rules:**
- Each step must call `e2e.clearCalls()` before the next action.
- Each step must validate **message** + **keyboard**.
- Use `toContain` for dynamic data.

---

## Error & Edge Case Validation

### Invalid Input

If a page has input validation, the test **MUST** cover it:

```typescript
it(\`reject invalid input\`, async () => {
  await e2e.sendCallbackQuery(\`page-input\`, asUser)
  e2e.clearCalls()

  // Send invalid input
  const r = await e2e.sendText(\`invalid!!!\`, asUser)
  expect(r[0]!.body?.text).toBe(e2e.gmsg(\`page-input\`, \`warn-invalid\`, {}))

  // Ensure error keyboard matches
  expect(e2e.extractButtonLabels(r[0])).toEqual(
    e2e.gkb(\`page-input\`, \`warn-invalid\`, \`inline\`, {})
  )
})
```

### Empty State

If a page displays a list, the test **MUST** cover the empty state:

```typescript
it(\`show empty state\`, async () => {
  const r = await e2e.sendCallbackQuery(\`page-list\`, asUser)
  expect(r[0]!.body?.text).toContain(\`empty\`)
  expect(r[0]!.body?.text).toContain(\`no items\`)
})
```

### Session Expiry / Reset

If a page uses session, the test **MUST** ensure session is reset correctly (usually via `start.ts`):

```typescript
it(\`clear session on start\`, async () => {
  // Start flow
  await e2e.sendText(\`/start\`, asUser)
  e2e.clearCalls()
  await e2e.sendCallbackQuery(\`page-flow\`, asUser)
  e2e.clearCalls()

  // Go back to start — session must be clean
  await e2e.sendText(\`/start\`, asUser)
  e2e.clearCalls()
  const r = await e2e.sendCallbackQuery(\`page-flow\`, asUser)

  // Must return to initial state, not the middle of flow
  expect(r[0]!.body?.text).toBe(e2e.gmsg(\`page-flow\`, \`s1\`, {}))
})
```

### General Status Fallback (Route Not Found)

Gramstax has `GeneralStatusPage` as the default fallback when a route/page is not found. Unknown updates are automatically routed to `berrorNotFound` — **MUST** be validated:

```typescript
it(\`fallback to general-status for unknown callback data\`, async () => {
  const responses = await e2e.sendCallbackQuery(\`unknown-data-12345\`, asUser)
  // Gramstax falls back to GeneralStatusPage — response must exist
  expect(responses.length).toBeGreaterThan(0)
  expect(responses[0]!.body?.text).toContain(\`Route Not Found\`)
  // Keyboard should navigate to StartPage (home)
  const labels = e2e.extractButtonLabels(responses[0])
  expect(labels).toBeDefined()
  expect(labels.flat().length).toBeGreaterThan(0)
})

it(\`fallback to general-status for unknown command\`, async () => {
  const responses = await e2e.sendText(\`/unknowncommand\`, asUser)
  expect(responses.length).toBeGreaterThan(0)
  expect(responses[0]!.body?.text).toContain(\`Route Not Found\`)
})

it(\`fallback to general-status for unknown text\`, async () => {
  const responses = await e2e.sendText(\`some random text\`, asUser)
  expect(responses.length).toBeGreaterThan(0)
  expect(responses[0]!.body?.text).toContain(\`Route Not Found\`)
})
```

**Note**: If the project has a custom `GeneralStatusPage` template, adjust the expected text (`Route Not Found`) to match that template.

---

## `blank.test.ts`

```typescript
import {describe, it, expect} from "bun:test"
import {bot} from "./setup"

describe(\`E2E: BlankPage\`, () => {
  it(\`load as a registered page in the bot\`, () => {
    const allPages = bot.pages.all
    expect(allPages[\`blank\`]).toBeDefined()
  })
})
```

Note: `blank.test.ts` only imports `bot`, not `e2e`. Only create this file if the project has a `blank` page.

---

## Session Isolation

When test files share the same bot instance and cause session conflicts:

```typescript
const asUser = {user: {id: <UNIQUE_ID>}, chat: {id: <UNIQUE_ID>}}
// Use asUser in ALL sendText / sendCallbackQuery calls in that file
```
