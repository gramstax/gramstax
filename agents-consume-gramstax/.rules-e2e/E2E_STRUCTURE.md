# E2E Test Structure (bot.e2e pattern)

## File Layout

```
e2e/
  setup.ts           — bot init, export bot + e2e
  blank.test.ts      — page registration check
  start.test.ts      — one file per page, named after the page
  <page>.test.ts
```

## setup.ts Template

```typescript
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"

export type {ITE2eApiCall, ITE2eUpdateOptions} from "gramstax"

const templateManager = new TemplateManager({path: [join(import.meta.dir, \`../src/pages\`)]})
export const bot = new BotCore({
  deploy: \`test\`,
  token: \`test\`,
  log: false,
  templateManager
})

export const e2e = bot.e2e!
```

No MockTelegramServer. No webhook. No port. No polling. No `beforeAll` to wait for server startup. No `process.chdir()` — `_pageLoads()` uses `this.templateManager._path[0]` automatically.

### Project-specific additions

Some projects require extra exports from setup.ts. Add them after `e2e`:

```typescript
// 7-crud — DB reset helper
export async function resetDb(userId: number) {
  await bot.db.clearAll(userId)
}

// 8-newsletter — Session reset + admin constants
import {CacheExternal} from "gramstax"
export const ADMIN_USER = {id: 1, first_name: \`Admin\`, username: \`admin\`, language_code: \`en\`}
export const ADMIN_CHAT = {id: 1, type: \`private\` as const, first_name: \`Admin\`}
const cacheSession = new CacheExternal(\`memory\`)
// ... pass cacheSession to BotCore constructor ...
export async function resetEnv() {
  e2e.clearCalls()
  await cacheSession.clear()
}

// 9-substore-bot — Cart state reset
export async function resetEnv() {
  e2e.clearCalls()
  await bot.cacheState.clear()
}

// 10-http-request — HTTP test server for real fetch tests
import {TemplateManager} from "gramstax"
const testServer = Bun.serve({port: 0, fetch(req) { ... }})
export const httpServerUrl = \`http://127.0.0.1:$\{testServer.port\}\`

// 6-bank-system — Page monkey-patch (runs BEFORE bot creation)
import {TransferPage} from "../src/pages/transfer"
TransferPage.prototype.handleCallbackData = async function () {
  await this.setSessionFreeText()
  await original.call(this)
}

// 5-interactive-menu — Bottom keyboard helper
export function bottomButtonLabels(resp: any): string[] {
  return resp?.body?.reply_markup?.keyboard?.flat().map((b: any) => b.text) ?? []
}
```

### When `hookAfterStart` is needed

In production (webhook/polling), `hookAfterStart` is called automatically. In test mode, it runs inside the constructor **after** `E2eHelper` is created. If the bot's `hookAfterStart` launches background worker threads (e.g. `IncrementJob`), those will run automatically — **no `beforeAll` workaround needed**.

---

## Test File Template

### Simple page (callback query navigation)

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
    const responsesId = await e2e.sendCallbackQuery(intent, {
      user: {id: <UNIQUE_ID+?>, username: \`testuser\`, language_code: \`id\`},
      chat: {id: <UNIQUE_ID+?>}
    })

    expect(responses.length).toBeGreaterThan(0)
    expect(responsesId.length).toBeGreaterThan(0)
    expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, \`<g-base id="..">\`, {}))
    expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, \`<g-base id="..">\`, {}, \`id\`))
    expect(e2e.buttonLabels(responses[0])).toEqual(e2e.gkb(intent, \`<g-base id="..">\`, \`inline\`, {}))
    expect(e2e.buttonLabels(responsesId[0])).toEqual(e2e.gkb(intent, \`<g-base id="..">\`, \`inline\`, {}, \`id\`))
  })
})
```

### Direct text command

```typescript
const responses = await e2e.sendText(\`/command\`, asUser)
const responsesId = await e2e.sendText(\`/command\`, {
  user: {language_code: \`id\`}
})

expect(responses[0]!.body?.text).toBe(e2e.gmsg(intent, \`<g-base id="..">\`, {}))
expect(responsesId[0]!.body?.text).toBe(e2e.gmsg(intent, \`<g-base id="..">\`, {}, \`id\`))
```

### Media page (editMessageMedia)

```typescript
await e2e.sendCallbackQuery(intent, asUser)

const editMediaReq = e2e.lastCall(\`editMessageMedia\`)
expect(editMediaReq!.body?.media?.type).toBe(\`photo\`)
expect(editMediaReq!.body?.media?.media).toBe(e2e.gmedia(intent, \`<g-base id="..">\`, {}).src)
expect(editMediaReq!.body?.media?.caption).toBe(e2e.gmedia(intent, \`<g-base id="..">\`, {}).caption)

// Language variant
e2e.clearCalls()
await e2e.sendCallbackQuery(intent, {user: {language_code: \`id\`}})
const editMediaIdReq = e2e.lastCall(\`editMessageMedia\`)
expect(editMediaIdReq!.body?.media?.caption).toBe(e2e.gmedia(intent, \`<g-base id="..">\`, {}, \`id\`).caption)
```

**Note:** Voice messages cannot be edited in-place. `editVoice()` uses `deleteMessage` + `sendVoice` instead of `editMessageMedia`. Check the actual API method via `e2e.calls.map(c => c.method)` if unsure.

### Send-based media (sticker, voice, video_note)

```typescript
const sendStickerReq = e2e.lastCall(\`sendSticker\`)
expect(sendStickerReq!.body?.sticker).toBe(e2e.gmedia(intent, \`<g-base id="..">\`, {}).src)

// Language variant
e2e.clearCalls()
await e2e.sendCallbackQuery(intent, {user: {language_code: \`id\`}})
const sendStickerIdReq = e2e.lastCall(\`sendSticker\`)
expect(sendStickerIdReq!.body?.sticker).toBe(e2e.gmedia(intent, \`<g-base id="..">\`, {}, \`id\`).src)
```

### Media group

```typescript
const sendMediaGroupReq = e2e.lastCall(\`sendMediaGroup\`)
expect(Array.isArray(sendMediaGroupReq!.body?.media)).toBe(true)
sendMediaGroupReq!.body?.media!.forEach((item: any) => {
  expect(item.type).toBe(\`photo\`)
})

// Language variant
e2e.clearCalls()
await e2e.sendCallbackQuery(intent, {user: {language_code: \`id\`}})
const idReq = e2e.lastCall(\`sendMediaGroup\`)
expect(idReq!.body?.media![0]?.caption).toBe(e2e.gmedia(intent, \`<g-base id="..">\`, {}, \`id\`).mediaGroup![0]?.caption)
```

---

## Available e2e Methods (Bot API 10.1)

### User simulation

| Method                                                  | Description                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `e2e.sendText(text, options?)`                          | Send a text message (auto-adds `bot_command` entity if starts with `/`) |
| `e2e.sendPhoto(options?)`                               | Send a photo with optional caption                                      |
| `e2e.sendVideo(options?)`                               | Send a video with optional caption                                      |
| `e2e.sendAudio(options?)`                               | Send an audio file with optional caption                                |
| `e2e.sendDocument(options?)`                            | Send a document with optional caption                                   |
| `e2e.sendAnimation(options?)`                           | Send an animation (GIF) with optional caption                           |
| `e2e.sendVoice(options?)`                               | Send a voice message with optional caption                              |
| `e2e.sendVideoNote(options?)`                           | Send a video note (round video)                                         |
| `e2e.sendSticker(options?)`                             | Send a sticker                                                          |
| `e2e.sendLocation(options?)`                            | Send a location (lat/lng)                                               |
| `e2e.sendContact(options?)`                             | Send a contact                                                          |
| `e2e.sendCallbackQuery(data, options?)`                 | Press an inline keyboard button                                         |
| `e2e.sendDice(options?)`                                | Send a dice with emoji (🎲🎯🏀⚽🎰🎳)                                   |
| `e2e.sendEditedText(text, options?)`                    | Edit an existing message text                                           |
| `e2e.sendNewChatMembers(options?)`                      | Service message: user joined                                            |
| `e2e.sendChannelPost(text, options?)`                   | Channel post (text)                                                     |
| `e2e.sendPollAnswer(pollId, optionIds, options?)`       | Answer a poll                                                           |
| `e2e.sendInlineQuery(query, options?)`                  | Inline query                                                            |
| `e2e.sendChosenInlineResult(resultId, query, options?)` | Chosen inline result                                                    |

### Inspection

| Method                     | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `e2e.calls`                | Array of all captured API calls `{method, body, timestamp}` |
| `e2e.lastCall(method?)`    | Most recent call, optionally filtered by method name        |
| `e2e.clearCalls()`         | Reset captured calls — use in `beforeEach`                  |
| `e2e.handleUpdate(update)` | Inject raw Update object directly (low-level)               |

### Template helpers

| Method                                   | Description                                              |
| ---------------------------------------- | -------------------------------------------------------- |
| `e2e.gmsg(page, id, data?, lang?)`       | Render expected message text                             |
| `e2e.gkb(page, id, type?, data?, lang?)` | Build expected keyboard labels                           |
| `e2e.gmedia(page, id, data?, lang?)`     | Get expected media config                                |
| `e2e.buttonLabels(call)`                 | Extract inline keyboard button text from a captured call |

### Types

| Type                        | Description                                                                |
| --------------------------- | -------------------------------------------------------------------------- |
| `ITE2eApiCall`              | `{method: string, body: Record<string,unknown>, timestamp: number}`        |
| `ITE2eUpdateOptions`        | `{user?: ITE2eUser, chat?: ITE2eChat, date?: number, message_id?: number}` |
| `ITE2eMediaOptions`         | Extends `ITE2eUpdateOptions` with `caption`                                |
| `ITE2eCallbackQueryOptions` | Extends with `id`, `messageText`                                           |
| `ITE2eLocationOptions`      | Extends with `latitude`, `longitude`                                       |
| `ITE2eContactOptions`       | Extends with `phone_number`, `first_name`, etc.                            |

---

## Key Patterns

### 1. Language Variant

Always add an inline `{user: {language_code: 'id'}}` call alongside the default user call:

```typescript
const responses = await e2e.sendCallbackQuery(intent, asUser)
const responsesId = await e2e.sendCallbackQuery(intent, {
  user: {language_code: \`id\`}
})
```

Assert with `e2e.gmsg(..., 'id')`, `e2e.gkb(..., 'id')`, or `e2e.gmedia(..., 'id')`.

### 2. Assertion Rules

- **Exact match** → `toBe(e2e.gmsg(intent, AGBaseId, data))`
- **Dynamic content** (timestamps, random numbers, user input) → `toContain` or `toStartWith`
- **Keyboard labels** → `toEqual(e2e.gkb(intent, AGBaseId, type, data))`
- **Media captions/src** → `toBe(e2e.gmedia(intent, AGBaseId, data).caption)` / `.src`
- **Always verify** `responses.length > 0` and the response is defined
- **Use `e2e.calls.map(c => c.method)` to inspect which API methods were triggered** (helpful for unfamiliar pages)

### 3. Session Isolation

When test files share the same bot instance and cause session conflicts:

```typescript
const asUser = {user: {id: <UNIQUE_ID>}, chat: {id: <UNIQUE_ID>}}
// Use asUser in ALL sendText / sendCallbackQuery calls for that file
```

Or for inline use when only the language differs:

```typescript
{user: {id: <UNIQUE_ID>, language_code: \`id\`}, chat: {id: <UNIQUE_ID>}}
```

### 4. `lang="id"` Template Pattern

In every page template, add ID variants:

```
<g-keyboard>Button1, Button2</g-keyboard>
<g-keyboard lang="id">Tombol1, Tombol2</g-keyboard>

<g-message>English text</g-message>
<g-message lang="id">Teks Indonesia</g-message>
```

### 5. Flow Tests (multi-step navigation)

```typescript
it(\`full flow\`, async () => {
  await e2e.sendText(\`/start\`, asUser)
  e2e.clearCalls()

  // Step 1
  const r1 = await e2e.sendCallbackQuery(\`page1\`, asUser)
  expect(r1[0]!.body?.text).toBe(e2e.gmsg(\`page1\`, \`s1\`, {}))

  e2e.clearCalls()

  // Step 2
  const r2 = await e2e.sendText(\`user input\`, asUser)
  expect(r2[0]!.body?.text).toBe(e2e.gmsg(\`page1\`, \`s\`, {res: \`user input\`}))
})
```

### 6. `blank.test.ts`

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

Note: `blank.test.ts` only imports `bot`, not `e2e`. Only create this file if the project has a `blank` page (`Object.keys(bot.pages.all)` to verify).

---

## API Mapping (MockTelegramServer → e2e)

| MockTelegramServer                   | bot.e2e                                            |
| ------------------------------------ | -------------------------------------------------- |
| `env.mockServer.sendText()`          | `e2e.sendText()`                                   |
| `env.mockServer.sendCallbackQuery()` | `e2e.sendCallbackQuery()`                          |
| `env.mockServer.sendPhoto()`         | `e2e.sendPhoto()`                                  |
| `env.mockServer.sendVideo()`         | `e2e.sendVideo()`                                  |
| `env.mockServer.lastRequest()`       | `e2e.lastCall()`                                   |
| `env.clearRequests()`                | `e2e.clearCalls()`                                 |
| `resp.body?.text`                    | `resp.body?.text` (unchanged)                      |
| `resp.body?.reply_markup`            | `resp.body?.reply_markup` (unchanged)              |
| `gmsg()` standalone                  | `e2e.gmsg()`                                       |
| `gkb()` standalone                   | `e2e.gkb()`                                        |
| `buttonLabels()` standalone          | `e2e.buttonLabels()`                               |
| `gmedia()` standalone                | `e2e.gmedia()`                                     |
| `getEnv()` + `beforeAll`             | **Not needed** — bot is created at module level    |
| Webhook URL polling (5s loop)        | **Not needed** — `handleUpdate` is called directly |
| `MockTelegramServer` import          | **Not needed** — all mock logic is in `E2eHelper`  |

---

## Checklist for New Project

- [ ] `e2e/setup.ts` — bot init with `deploy: "test"`, export `bot` + `e2e`
- [ ] `e2e/blank.test.ts` — page registration (only if project has blank page)
- [ ] `e2e/<page>.test.ts` — one per page
- [ ] `lang="id"` templates in every page's `<g-message>` and `<g-keyboard>`
- [ ] Language variant assertions: `{user: {language_code: 'id'}}` inline
- [ ] `e2e.gmsg` for exact text, `toContain` for dynamic content only
- [ ] `e2e.gmedia()` for media caption/src validation
- [ ] Unique `{user, chat}` IDs per test file when session conflicts
- [ ] `beforeEach(() => e2e.clearCalls())` for call isolation
- [ ] If project needs DB reset: export `resetDb(userId)` or `resetEnv()` from setup.ts
- [ ] If project needs background workers: `hookAfterStart` is called automatically (no workaround)
- [ ] If project tests real HTTP requests: start a `Bun.serve()` and export the URL from setup.ts
