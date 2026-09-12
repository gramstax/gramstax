# E2E Setup (setup.ts)

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

export const bot = new BotCore({
  deploy: \`test\`,
  token: \`test\`,
  log: false,
  stream: true,        // enables ctx.replyWithStream / replyWithMarkdownStream / replyWithHtmlStream
  autoRetry: true,     // enables auto-retry on rate limits
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, \`../src/pages\`)]
  })
})
export const e2e = bot.e2e!
```

No MockTelegramServer. No webhook. No port. No polling. No `beforeAll` to wait for server startup. No `process.chdir()` — `_pageLoads()` uses `this.templateManager._path[0]` automatically.

### `stream` and `autoRetry` — defaults & E2E impact

Both default to `true` in the `BotCore` constructor. Explicitly set `stream: true` in setup.ts for clarity.

| Param | Default | Effect |
|-------|---------|--------|
| `stream` | `true` | Enables `ctx.replyWithStream`, `ctx.replyWithMarkdownStream`, `ctx.replyWithHtmlStream`. In E2E tests the stream plugin captures calls as `sendMessageDraft`, `sendRichMessageDraft`, and `sendRichMessage` — not `sendMessage`. The `sendRichMessage` call holds the final complete text in `body.rich_message.html`. |
| `autoRetry` | `true` | Enables auto-retry on rate limits (`429 Too Many Requests`). Does not affect E2E call capture — the retried call is invisible to tests because it succeeds before the test inspects `e2e.calls`. |

Stream-specific validations are in `E2E_VALIDATION.md` (rule 12).

### Project-specific additions

Some projects require extra exports from setup.ts. Add them after `e2e`:

```typescript
// 7-crud — DB reset helper
export async function resetDb(userId: number) {
  await bot.db.clearAll(userId)
}

// 8-newsletter — Session + cache reset
import {CacheExternal} from "gramstax"
const cacheSession = new CacheExternal(\`memory\`)
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
TransferPage.prototype.handleCallbackQueryData = async function () {
  await this.setSessionFreeText()
  await original.call(this)
}
```

### When `hookAfterStart` is needed

In production (webhook/polling), `hookAfterStart` is called automatically. In test mode, it runs inside the constructor **after** `E2eHelper` is created. If the bot's `hookAfterStart` launches background worker threads (e.g. `IncrementJob`), those will run automatically — **no `beforeAll` workaround needed**.

### When the bot MUST NOT respond

Some pages should produce **zero** API calls (e.g., a page that only answers the callback query silently via `answerCallbackQuery`). Validate with:

```typescript
const responses = await e2e.sendCallbackQuery(intent, asUser)
expect(responses).toHaveLength(0)      // no sendMessage
expect(e2e.calls).toHaveLength(1)      // only answerCallbackQuery
expect(e2e.lastCall()?.method).toBe(\`answerCallbackQuery\`)
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

| Method                                   | Description                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `e2e.gmsg(page, id, data?, lang?)`       | Render expected message text                                                     |
| `e2e.gkb(page, id, type?, data?, lang?)` | Build expected keyboard labels array                                             |
| `e2e.gmedia(page, id, data?, lang?)`     | Get expected media config                                                        |
| `e2e.extractButtonLabels(call)`          | Extract inline keyboard button **text** from a captured call                     |
| `e2e.extractCallbackData(call)`          | Extract inline keyboard **callback_data** array from a captured call             |
| `e2e.extractBottomLabels(call)`          | Extract bottom (reply) keyboard button **text** from a captured call             |
| `e2e.extractText(call)`                  | Extract text from a call — handles both `sendMessage` (`text`) and `sendRichMessage` (`rich_message.html`) |
| `e2e.streamCalls()`                      | Get all stream-related calls (`sendMessageDraft`, `sendRichMessageDraft`, `sendRichMessage`, `sendMessage`) |
| `e2e.streamChunks()`                     | Extract all text chunks from stream calls as a string array                      |

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
| `extractButtonLabels()` standalone   | `e2e.extractButtonLabels()`                        |
| `extractCallbackData()` standalone   | `e2e.extractCallbackData()`                        |
| `extractBottomLabels()` standalone   | `e2e.extractBottomLabels()`                        |
| `gmedia()` standalone                | `e2e.gmedia()`                                     |
| `getEnv()` + `beforeAll`             | **Not needed** — bot is created at module level    |
| Webhook URL polling (5s loop)        | **Not needed** — `handleUpdate` is called directly |
| `MockTelegramServer` import          | **Not needed** — all mock logic is in `E2eHelper`  |
