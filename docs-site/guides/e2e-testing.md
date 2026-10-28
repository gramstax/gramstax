---
title: E2E testing
description: Testing a page by driving the compiled template against an in-process mock of the Telegram API.
icon: test-tube
---

# E2E testing

gramstax tests a bot the way a user meets it: by sending an update and asserting
on what comes back. No network, no token, no fixtures that drift from the real
output.

<Note>
  E2E is the one place that does not boot through `gramstax.config.ts`. The setup
  constructs the bot class directly so it can inject `deploy: "test"`, a dummy
  token, and the retry behaviour a test wants.
</Note>

## The setup exports

The scaffold's `e2e/setup.ts` is the whole harness. It exports four core things
(projects with persistent state add a `resetEnv()` helper):

| Export | What it is |
| --- | --- |
| `bot` | The constructed bot, in `deploy: "test"` |
| `e2e` | `bot.e2e`: the helper you drive |
| `enUser` | A user fixture with `language_code: "en"` |
| `idUser` | The same user in Indonesian, for language assertions |

`bot.ready` resolves after the startup hooks. Await it in a suite that depends on
async startup (workers, LMDB open, an HTTP fixture). Projects with persistent
state also export `resetEnv()` and call it from `beforeEach`.

The user fixtures matter more than they look. The template suite ships both so a
test can prove a language actually switched rather than asserting against the
only string it happened to have.

## Mirroring is not coverage

A mirrored test file proves a page is *registered*. It does not prove that any
handler on that page runs, that a declined tap is denied, or that the Indonesian
message exists. A complete suite has three artifacts: a mirrored test file, a
ledger row for every handler/state, and a method-level assertion for every render
route. The seven layers are:

| # | Layer | What must be true | Machine proof |
| --- | --- | --- | --- |
| 1 | Mirror | Every `src/pages` file has an `e2e/*.test.ts` counterpart | `check-e2e-mirror` exits 0 |
| 2 | Entry points | Every `handle*` on the page is triggered by a real update shape | One ledger row per handler |
| 3 | Render routes | Every `render*` call produces the intended Bot API method | Method + payload assertion |
| 4 | States | Every `show`/`process` branch, including invalid input and cancel | One test per interactive state |
| 5 | Guards | Both allow and deny behave as designed | Two users, two assertions |
| 6 | Locales | Every declared `lang` variant renders | `gmsg`/`gkb`/`gmedia` with that lang |
| 7 | Fallbacks | Unknown callbacks, commands, text, and media land somewhere safe | Fallback page or free-handler assertion |

Layers 2–6 are per page; layers 1 and 7 are project-wide. The scaffold ships
`e2e/COVERAGE.md` as the ledger: one row per handler, state, or hook-driven page,
naming the test that proves it. `check-e2e-handlers.ts` fails when a handler
under `src/pages` has no row, a handler row names no test file, a referenced test
file is missing, or a test file is not referenced at all.

The gate has no "uncovered" row. A handler that cannot be observed through an
update is either dead code (delete it) or missing a reachable trigger (add the
page/route that exercises it). "Hard to test" and "the mock does not support it"
are not exceptions; use `e2e.handleUpdate()` to build the missing update shape.

## Handler dispatch matrix

Trigger each handler with the update shape its name implies. `intent` is
`Page.data.intentCallbackQueryData` (default: the page name, e.g.
`start/random`).

| Handler | Send | Rule |
| --- | --- | --- |
| `handleCallbackQueryData` | `e2e.sendCallbackQuery(intent, user)` | Exact intent; callbacks edit by default |
| `handleArgsCallbackQueryData` | ``e2e.sendCallbackQuery(`${intent}:${a1}:${a2}`, user)`` or `Page.data.callbackQueryData(a1, a2).result` | Requires args data |
| `handleCommandText` | `e2e.sendText("/cmd", user)` | No args |
| `handleCommandArgsText` | `e2e.sendText("/cmd arg", user)` | Args required |
| `handleText` | `e2e.sendText(Page.data.intentText, user)` | Exact intent text |
| `handleArgsText` | ``e2e.sendText(`${Page.data.intentText} ${a1}`, user)`` | Args required |
| `handleCaptionPhoto` | `e2e.sendPhoto({caption: Page.data.name, user})` | Bare route name; same for Video/Audio/Document/Animation/Voice |
| `handleCaptionArgsPhoto` | `e2e.sendPhoto({caption: Page.data.name + " " + a1, user})` | Args required; same for the other media kinds |
| `handleCommandCaptionPhoto` | `e2e.sendPhoto({caption: "/" + Page.data.intentCommandText, user})` | Command caption |
| `handleCommandCaptionArgsPhoto` | `e2e.sendPhoto({caption: "/" + Page.data.intentCommandText + " " + a1, user})` | Command caption with args |
| session variants (`handleSession*`) | Enter the state first, then send the matching update | Never dispatched by `handleFree*`; only reachable while `session.method` points at them |
| `handleChatMemberOutIn` | `e2e.sendChatMemberUpdate({oldStatus, newStatus, user, chat})` | Suffix buckets are `out`/`in`/`regular`/`admin` |
| `handleMyChatMemberOutAdmin` | `e2e.sendMyChatMemberUpdate({oldStatus: "left", newStatus: "administrator", chat})` | Same suffix buckets, on the bot's own membership |
| custom route | `e2e.handleUpdate(update)` | Inject the underlying event |
| `handleFreeText` / `handleFreePhoto` / … | Send the matching shape with data no static route matches | Only runs when defined on the page's own prototype; every matching page runs |
| `handleFree` | Send any unmatched update | Global last resort; every matching page runs |

`handleFree*`, `handleSession*`, and `handleChatMember*` are large generated
families. The authoritative runtime lists are
`bot.pages.listRouteDynamicSpesific`, `bot.pages.listRouteStaticSession`, and
`bot.pages.routeChatMember`. Scan `src/pages` for every `handle*` a page defines
and give each one a row; do not stop at the common examples above.

Pages with `intentTextMap` / `intentCommandTextMap` register one route per
language: send the mapped intent with a fixture carrying that `language_code`,
not just the default intent. With `optionsPage.shortCallbackQueryData: true`,
callback data is a short numeric index — press the rendered button or use
`Page.data.callbackQueryData(...).result` instead of hard-coding the page name.
An args route needs an args builder on the page, for example
`static data = this.buildData((a1, a2) => [a1, a2])`; colon-separated for
callbacks, space-separated for text and captions.

## Render routes

`renderText` defaults to `auto`: a callback edits the originating message, a
plain message sends a new one. Rich templates use `sendRichMessage` for a new
message and `editMessageText` with an `html` payload for an edit.

| Page call | From a callback | From a message | Assert |
| --- | --- | --- | --- |
| `renderText()` | `editMessageText` | `sendMessage` / `sendRichMessage` (rich) | Method + text |
| `renderText({mode: "reply"})` | `sendMessage` / `sendRichMessage` (rich) | `sendMessage` / `sendRichMessage` (rich) | No `editMessageText` |
| `renderText({mode: "edit"})` | `editMessageText` | `editMessageText` or the documented fallback | No `sendMessage` when the edit succeeds; assert the fallback otherwise |
| `renderPhoto` / `renderVideo` / `renderAudio` / `renderDocument` / `renderAnimation` | `editMessageMedia` | `sendPhoto` / `sendVideo` / … | `media.type`, `media.media`, `media.caption` |
| `renderVoice` / `renderVideoNote` / `renderSticker` / `renderLocation` / `renderContact` | `deleteMessage` + `sendVoice` / `sendVideoNote` / `sendSticker` / `sendLocation` / `sendContact` | The matching `send*` | Delete happened first; payload fields |
| `renderMediaGroup` / `renderPhotoGroup` / … (multi-src) | `deleteMessage` + `sendMediaGroup` | `sendMediaGroup` | `media[]` length and per-item type/caption |
| `renderEditCaption` | `editMessageCaption` | `deleteMessage` + reply fallback | `caption`, or the reply text on fallback |
| `renderEditKeyboard` | `editMessageReplyMarkup` | throws (no fallback) | `reply_markup` |
| `renderCallbackAnswer` | `answerCallbackQuery` | — | `text` / `show_alert` |
| `renderPreCheckout` | `answerPreCheckoutQuery` | — | `ok` / `error_message` |
| `renderShipping` | `answerShippingQuery` | — | `ok` / `error_message` |
| `renderGuestAnswer` | `answerGuestQuery` | — | result payload |
| `renderWebAppAnswer` | `answerWebAppQuery` | — | `result` |
| `renderInlineAnswer` | `answerInlineQuery` | — | `results` |
| `renderPoll` / `renderDice` / `renderGift` / `renderInvoice` / `renderPaidMedia` / `renderVenue` | the matching `send*` | the matching `send*` | payload fields |
| `renderBroadcastDelete` | `deleteMessage` per recipient | `deleteMessage` per recipient | One call per id |
| `replyWithStream` / `replyWithMarkdownStream` / `replyWithHtmlStream` | Drafts + final | Drafts + final | `streamCalls()` + final call |

For every other `render*` the page calls, read its JSDoc: it names the Bot API
method. Assert that method plus the payload field the template block produces.
Do not leave a render call unasserted because it is not in this table.

## Writing a test

A `send*` call returns the array of API calls the update produced. Clear between
tests, then assert the method, the payload, and the absence of the wrong route:

```ts
import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe("StartPage", () => {
  it("greets in the user's language", async () => {
    const responses = await e2e.sendText(`/start`, enUser)
    const reply = responses[0]!

    expect(responses.length).toBeGreaterThan(0)
    expect(e2e.extractText(reply)).toBe(e2e.gmsg(`start`, `default`, {userName: `testuser`}))
    expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(`start`, `default`, `inline`, {}))
  })
})
```

A callback renders through `editMessageText` (with an `html` payload for rich
templates); a plain message sends a new one. `answerCallbackQuery` is **not**
automatic: it appears only when the page calls `renderCallbackAnswer`. When the
route itself is the behavior under test, assert the method set and the absence of
the wrong method (`sendMessage` vs `editMessageText`).

`clearCalls()` empties the captured calls. `reset()` does that *and* rewinds the
update and message id counters, which is what you want when a test asserts on
idempotency rather than on output.

## A complete example: `sum-number`

The scaffold's `sum-number` page defines three handlers and three states
(`l` left, `r` right, `s` success). A complete test drives the real user path and
asserts the method and the template-derived payload at each step:

```ts
import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser} from "./setup"

const intent = `sum-number`

beforeEach(() => {
  e2e.clearCalls()
})

describe("SumNumberPage", () => {
  it("complete two-step sum flow and show result", async () => {
    await e2e.sendText(`/start`, enUser)
    e2e.clearCalls()

    const step1 = await e2e.sendCallbackQuery(intent, enUser)
    expect(step1[0]!.method).toBe(`editMessageText`)
    expect(e2e.extractText(step1[0]!)).toBe(e2e.gmsg(intent, `l`))
    e2e.clearCalls()

    const step2 = await e2e.sendText(`23`, enUser)
    expect(step2[0]!.method).toBe(`sendMessage`)
    expect(e2e.extractText(step2[0]!)).toBe(e2e.gmsg(intent, `r`))
    e2e.clearCalls()

    const result = await e2e.sendText(`10`, enUser)
    expect(e2e.extractText(result[0]!)).toContain(`33`)
    expect(e2e.extractButtonLabels(result[0]!)).toEqual(e2e.gkb(intent, `s`, `inline`, {}))
  })
})
```

The matching ledger rows name the trigger, the test case, and the concrete proof:

```markdown
| Page | Handler / state | Trigger | Test | Asserts |
| --- | --- | --- | --- | --- |
| sum-number | handleCallbackQueryData | callback `sum-number` | sum-number.test.ts › complete two-step sum flow and show result | `editMessageText` + `gmsg(l)` |
| sum-number | handleCommandText | `/sum-number` | sum-number.test.ts › answers the /sum-number command | `sendMessage` + `gmsg(l)` |
| sum-number | handleSessionFreeText | `23` then `10` | sum-number.test.ts › complete two-step sum flow and show result | `sendMessage` + `gmsg(r)` + result |
```

This one test covers the callback entry point and the free-text session path, but
it is not the whole page: the invalid-left and invalid-right branches, the
`/sum-number` command, and the Indonesian variant each need their own row and
test. That is the difference between a happy-path test and a coverage contract.

## Locales and fallbacks

Locale coverage is not "the page has an `id` block". Send a user with
`language_code: "id"` and compare against the same compiled template:

```ts
import {e2e, idUser} from "./setup"

await e2e.sendText(`/start`, idUser)
e2e.clearCalls()

const responses = await e2e.sendCallbackQuery(`sum-number`, idUser)
expect(e2e.extractText(responses[0]!)).toBe(e2e.gmsg(`sum-number`, `l`, {}, `id`))
expect(e2e.extractButtonLabels(responses[0]!)).toEqual(e2e.gkb(`sum-number`, `l`, `inline`, {}, `id`))
```

A page with a language fallback needs a third fixture. For example, a page that
uses English words for any language other than `en`/`id` should be tested with a
`fr` user and asserted against the default `gmsg`/`gkb`, not the Indonesian one.

Fallbacks are project-level behavior. The scaffold routes unknown callbacks,
commands, and free text to `StatusPage`; test each shape, not just the callback:

```ts
const unknownCommandUser = {user: {id: 93001, username: `unknownCommand`, language_code: `en`}}
const unknownTextUser = {user: {id: 93002, username: `unknownText`, language_code: `en`}}

expect(e2e.extractText((await e2e.sendText(`/does-not-exist`, unknownCommandUser))[0]!)).toBe(e2e.gmsg(`status`, `nf`))
expect(e2e.extractText((await e2e.sendText(`hello`, unknownTextUser))[0]!)).toBe(e2e.gmsg(`status`, `nf`))
```

Use a fresh user id for each fallback test. A pending session from another flow
can change which handler wins before the fallback is reached.

## Deny is silent by default

A page-level `hookBeforeRoute` that returns `false` renders nothing unless the
hook renders the denial itself. Both contracts are valid; assert the one the
page implements:

```ts
// A) silent deny
const denied = await e2e.sendText(`/admin`, plainUser)
expect(denied).toHaveLength(0)

// B) deny-and-explain for a text update (the hook rendered the denial)
e2e.clearCalls()
const deniedWithMessage = await e2e.sendText(`/admin`, plainUser)
expect(e2e.extractText(deniedWithMessage[0]!)).toBe(`Forbidden`)
expect(e2e.extractText(deniedWithMessage[0]!)).not.toBe(e2e.gmsg(`admin`, `default`, {}))
```

For a callback update, the denial render is usually `answerCallbackQuery`
(`renderCallbackAnswer`) rather than a new message; assert that method and the
absence of the page's normal `editMessageText` render instead.

Use one allowed user and one denied user. A single fixture makes the test pass
for the wrong reason.

<Warning>
  `extractText` and `extractButtonLabels` take the captured call as their
  argument. Calling them with no argument returns nothing: the signature is
  `extractText(call: IE2eApiCall)`, not `extractText()`.
</Warning>

## Assert a keyboard against the template

The strongest assertion available compares a rendered reply to the same compiled
template the page ships. `gkb` returns what the template declares, so a mismatch
is a real defect rather than a stale literal in your test:

```ts
const reply = (await e2e.sendText(`/start`, enUser))[0]!

expect(e2e.extractButtonLabels(reply)).toEqual(e2e.gkb(`start`, `default`, `inline`, {}))
```

That is the same property the whole approach rests on: **the assertion and the
output come from the same compiled block.** A test cannot pass against markup a
user would never see.

The `g*` family follows one shape (`gmsg`, `gkb`, `gmedia`), taking the page
name, the `AGBaseId`, then kind-specific arguments and an optional trailing
language:

```ts
e2e.gkb(`start`, `default`, `inline`, {}, `id`) // Indonesian variant
```

Missing base/message blocks are not loud: `gmsg`/`gkb` return empty values and
`gmedia` throws. Assert non-empty text or labels when the block itself is part of
the contract.

## The send family

One method per update shape. All of them funnel into `handleUpdate` and return the
API calls produced by that update:

| Group | Methods |
| --- | --- |
| Text and media | `sendText`, `sendPhoto`, `sendVideo`, `sendAudio`, `sendDocument`, `sendAnimation`, `sendVoice`, `sendVideoNote`, `sendSticker`, `sendLocation`, `sendContact`, `sendDice` |
| Callback and inline | `sendCallbackQuery`, `sendInlineQuery`, `sendChosenInlineResult` |
| Membership | `sendNewChatMembers`, `sendChatMemberUpdate`, `sendMyChatMemberUpdate` |
| Channel and edit | `sendChannelPost`, `sendEditedText` |
| Poll and newer Bot API | `sendPollAnswer`, `sendStoppedGeneration`, `sendStoppedMessageGeneration`, `sendCommunityChatJoined`, `sendGiftInfo` |

The common options are `user`, `chat`, `date`, and `message_id` (`IE2eUpdateOptions`).
The caption-taking media methods (`sendPhoto`, `sendVideo`, `sendAudio`,
`sendDocument`, `sendAnimation`, `sendVoice`) add `caption`;
`sendLocation` adds `latitude`/`longitude`;
`sendContact` adds `phone_number`/`first_name`/`last_name`/`user_id`;
`sendDice` adds `emoji`; `sendCallbackQuery` adds `id` and `messageText`;
`sendChatMemberUpdate`/`sendMyChatMemberUpdate` add status fields. The exact
option type is in `gramstax`'s `IE2e*Options` exports.

A shape without a named helper still has an escape hatch. `handleUpdate` takes a
raw Telegram update and an optional settle delay:

```ts
await e2e.handleUpdate({message: {text: `/start`, chat: {id: 1}, from: {id: 1}}})
await e2e.handleUpdate(update, 50) // wait for deferred API calls
```

Every captured call has `{method, body, timestamp}`. Use `lastCall()` to reach
back at one without holding the return value, and `bodyOf` to narrow a call's
body when the extractors do not return the field you need.

## Running them

```bash
bun test e2e/            # the suite
bun test e2e/sum-number.test.ts  # one file
bun test -t "SumNumberPage" e2e/  # one suite
bun run test:e2e:check   # mirror + coverage ledger
bun run test:all         # checks, then unit + e2e
```

`test:e2e:check` runs `scripts/check-e2e-mirror.ts` and
`scripts/check-e2e-handlers.ts`. The generated `test:all` runs it first, so a
page or handler that is missing from `e2e/COVERAGE.md` fails the project's normal
test command rather than surviving as an untested route.

<Check>
  Tests are hermetic. There is no Telegram call, so they do not need a token, are
  not rate-limited, and give the same result on a laptop and on CI.
</Check>

## Debugging a failing test

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Received "sendRichMessage"` when you expected `sendMessage` | The page renders a rich template | Assert `sendRichMessage`, or use `extractText` for the payload |
| `[]` / zero calls | Guard denied the update, the intent did not match, or a session step was not armed | Inspect `e2e.calls`, the user fixture, and the preceding step |
| Extra `sendMessage` calls | `clearCalls()` is missing between steps, or the page renders twice | Clear between steps and assert the method set |
| `answerCallbackQuery` is absent | The page did not call `renderCallbackAnswer` | Do not expect it; only callback-answer blocks produce it |
| `test:e2e:check` reports a missing row | A new `handle*` has no ledger row | Add a row with the test file and the concrete assertion |
| `test:e2e:check` reports an orphan test | A test file has no page counterpart | Delete it, or add it to `EXTRA_TESTS` if it is a harness test |
| The suite passes but `test:e2e:check` fails | The mirror/ledger gate is separate from execution | Run `bun run test:e2e:check` and fix the inventory |
| A ledger row passes but the behavior is untested | The `Asserts` cell is too weak (`length > 0`) | Name the method, text, keyboard, media, or call count |

`e2e.calls` is the full ordered log. `e2e.lastCall(method)` is the last matching
call. `e2e.bodyOf<T>(call)` narrows a payload when you need a method-specific
field. Prefer the returned slice from `send*` over the global log when a test has
multiple updates: the slice is the calls from that update only.

## Pre-merge checklist

- [ ] `bun run test:e2e:check` exits 0.
- [ ] `bun run test:e2e` passes from a clean checkout.
- [ ] Every `handle*` in `src/pages` has a ledger row and a test.
- [ ] Every render route has a method-level assertion, and the wrong method is absent where it matters.
- [ ] Every interactive state has a success and a failure test.
- [ ] Every guard has allow and deny tests with two user ids.
- [ ] Every declared locale is asserted with `gmsg`/`gkb`/`gmedia`.
- [ ] Unknown callback, command, and free text each reach a fallback.
- [ ] No test relies on `length > 0` alone.
- [ ] No generated stub remains as the only test for a page.

## MockTelegramServer

`MockTelegramServer` is a standalone HTTP implementation of the API methods
gramstax actually calls, used by the bench harness when you want a real HTTP
boundary. `deploy: "test"` does **not** mount it: test mode attaches only
`E2eHelper`, which intercepts calls in-process with no HTTP at all. Reach for the
mock when you need a socket:

```ts
const server = new MockTelegramServer({port: 0})
const apiRoot = await server.start()
// point the bot's botConfig.apiRoot at apiRoot, then run the test
await server.stop()
```

`port: 0` binds an ephemeral port, which is what you want in a test that runs
alongside others. The lifecycle surface is `start()`, `stop()` and `reset()`; the
inspection surface is `requests`, `updates`, `pendingUpdates` and `lastRequest()`,
with `clearRequests()`, `clearUpdates()` and `clearAll()` to reset them.

## What the mock does not do

It implements the Bot API methods gramstax actually calls, not the whole API.
Unknown methods fall back to `{ok: true, result: true}` rather than failing, so a
typo or an unimplemented method can pass silently. Assert the captured request
(`server.requests`, `lastRequest(method)`) and its payload; do not trust a bare
`ok` response as proof that the method is modelled.

It also does not model Telegram's own behaviour: rate limits, flood waits,
message TTLs. A test that passes here can still hit a rate limit in production,
which is why [metrics](/guides/observability) exist for the things a test cannot
see.

## Keep the mirror honest

The scaffold ships two checks, and they answer different questions:

- `check-e2e-mirror.ts` proves every page under `src/pages` has a corresponding
  test file, and that no orphan test has lost its page.
- `check-e2e-handlers.ts` proves every `handle*` in the page tree has a row in
  `e2e/COVERAGE.md` naming a test file, and that every test file is referenced by
  at least one row. It does not read the test body; the row's `Asserts` cell is
  the concrete-proof contract.

The mirror alone cannot stop coverage rot: a mirrored stub that only asserts page
registration passes it. The ledger is what makes *behavior* coverage checkable.
For a new page, add the mirrored test and one row per handler/state; run
`bun run test:e2e:check` before claiming the page is done.

## Related

- [The render contract](/concepts/render-contract): why an assertion can know
  which method ran
- [Deploy](/concepts/deploy): what `deploy: "test"` actually changes
- [ADR-0006: In-process E2E testing](/guides/adr/0006-in-process-e2e): why this
  approach was chosen