# E2E Checklist for New Project

## Setup

- [ ] `e2e/setup.ts` — bot init with `deploy: "test"`, export `bot` + `e2e`
- [ ] `e2e/blank.test.ts` — page registration (only if project has blank page)
- [ ] `e2e/<page>.test.ts` — one file per page, cover all g-base ids
- [ ] `beforeEach(() => e2e.clearCalls())` — call isolation per test
- [ ] Unique `{user, chat}` IDs per test file when session conflicts
- [ ] If project needs DB reset: export `resetDb(userId)` or `resetEnv()` from setup.ts
- [ ] If project needs background workers: `hookAfterStart` is called automatically
- [ ] If project tests real HTTP requests: start `Bun.serve()` and export URL from setup.ts
- [ ] If project needs monkey-patch: do it BEFORE bot creation in setup.ts

## Config

- [ ] `stream: true` in setup.ts — enables `replyWithStream` / `replyWithMarkdownStream` / `replyWithHtmlStream`
- [ ] `autoRetry: true` in setup.ts — enables auto-retry on rate limits

## Message Validation (REQUIRED per page)

- [ ] **Response existence** — `expect(responses.length).toBeGreaterThan(0)`
- [ ] **Message text** — `toBe(e2e.gmsg(...))` or `toContain` for dynamic content
- [ ] **parse_mode** — `toBe(\`HTML\`)` if template uses HTML/Markdown
- [ ] **No keyboard** — `reply_markup` must be `toBeUndefined()` if page has no keyboard
- [ ] **Edit message** — use `e2e.lastCall(\`editMessageText\`)`, not response array
- [ ] **entities** — validate if there are special entities (bold, url, mention)

## Keyboard Validation (REQUIRED per page)

- [ ] Inline: validate **button labels** — `e2e.extractButtonLabels()` + `toEqual(e2e.gkb(...))`
- [ ] Inline: validate **callback_data** — `e2e.extractCallbackData()` + each entry non-empty
- [ ] Inline: validate **answerCallbackQuery** exists at `e2e.calls[0]`
- [ ] Bottom: validate **labels** — `e2e.extractBottomLabels()` + `toEqual(e2e.gkb(...))`
- [ ] Bottom: validate `reply_markup.keyboard` + `resize_keyboard`

## Media Validation (REQUIRED if page uses media)

- [ ] `e2e.gmedia()` for media src and caption validation
- [ ] Validate media type (`photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`)
- [ ] If voice edit: check API method — `deleteMessage` must be BEFORE `sendVoice`
- [ ] If media group: validate `media[]` array and each item: `type`, `media`, `caption`
- [ ] If sending large media: validate `sendChatAction` exists BEFORE send
- [ ] Validate `editMessageMedia`: `media.type`, `media.media`, `media.caption`

## Stream Reply Validation (REQUIRED if page uses streaming)

- [ ] `stream: true` is set in setup.ts
- [ ] Final call is `sendRichMessage` (not a dangling draft) — `e2e.lastCall(\`sendRichMessage\`)` defined
- [ ] Final text validated via `e2e.extractText(finalCall)` matches `e2e.gmsg(...)`
- [ ] Stream chunks validated — `e2e.streamChunks()` non-empty, last chunk matches final text
- [ ] Last stream method is `sendRichMessage` — confirms flush completed
- [ ] If `replyWithHtmlStream`: `rich_message.html` contains the text
- [ ] If `replyWithMarkdownStream`: `rich_message.markdown` contains the text

## Multi-Call & Order Validation (REQUIRED)

- [ ] **All** API calls validated, not just `lastCall()` — use `e2e.calls.map(c => c.method)`
- [ ] **Order** of API calls correct: `answerCallbackQuery` → `sendChatAction` → `sendMessage`/`sendPhoto`/etc.
- [ ] No **unexpected API calls** — `expect(methods).not.toContain(\`sendSticker\`)`

## Special Media Types (if applicable)

- [ ] **Dice** — validate `emoji` type (`🎲`, `🎯`, `🏀`, `⚽`, `🎰`, `🎳`)
- [ ] **Poll** — validate `question`, `options` (length > 1), `type`, `is_anonymous`
- [ ] **Poll (quiz)** — validate `correct_option_id`
- [ ] **Invoice** — validate `title`, `description`, `payload`, `currency`, `total_amount`
- [ ] **Location** — validate `latitude` range (-90..90) and `longitude` range (-180..180)
- [ ] **Contact** — validate `phone_number` (phone format), `first_name`

## Fallback / Error Validation (REQUIRED)

- [ ] **Unknown callback data** — Gramstax falls back to `StatusPage`, validate "Route Not Found" message
- [ ] **Unknown command** — falls back to `StatusPage`, validate response
- [ ] **Unknown free text** — falls back to `StatusPage`, validate response
- [ ] **Invalid input** — page with validation: show appropriate error/warning page
- [ ] **Empty state** — page with list: show empty message

## Flow & Session (REQUIRED)

- [ ] **Multi-step flow** — each step validates message + keyboard + callback_data
- [ ] **Session reset** — ensure `/start` clears session
- [ ] **Session isolation** — ensure user A does not affect user B's session

## Language Variant (if applicable)

- [ ] Test with different `language_code`
- [ ] `e2e.gmsg()`, `e2e.gkb()`, `e2e.gmedia()` with `lang` parameter
- [ ] Template: `<g-message lang="...">` and `<g-keyboard lang="...">`
