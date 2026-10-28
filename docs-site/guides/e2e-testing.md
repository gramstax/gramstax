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

The scaffold's `e2e/setup.ts` is the whole harness. It exports four things:

| Export | What it is |
| --- | --- |
| `bot` | The constructed bot, in `deploy: "test"` |
| `e2e` | `bot.e2e`: the helper you drive |
| `enUser` | A user fixture with `language_code: "en"` |
| `idUser` | The same user in Indonesian, for language assertions |

The user fixtures matter more than they look. The template suite ships both so a
test can prove a language actually switched rather than asserting against the
only string it happened to have.

## Mirroring is not coverage

A mirrored test file proves a page is *registered*. It does not prove that any
handler on that page runs, that a declined tap is denied, or that the Indonesian
message exists. A complete suite covers seven layers:

| Layer | What it proves |
| --- | --- |
| Mirror | Every `src/pages` file has an `e2e/*.test.ts` counterpart |
| Entry points | Every `handle*` on the page is triggered by a real update shape |
| Render routes | Every `render*` call produces the intended Bot API method |
| States | Every `show`/`process` branch, including invalid input and cancel |
| Guards | Both allow and deny behave as designed |
| Locales | Every declared `lang` variant renders |
| Fallbacks | Unknown callbacks, commands, text, and media land somewhere safe |

The scaffold ships `e2e/COVERAGE.md` as the ledger: one row per handler, state,
or hook-driven page, naming the test that proves it. `check-e2e-handlers.ts`
fails when a handler under `src/pages` has no row, a row names a missing test,
or a test file is not referenced at all.

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

## Deny is silent by default

A page-level `hookBeforeRoute` that returns `false` renders nothing unless the
hook renders the denial itself. Both contracts are valid; assert the one the
page implements:

```ts
// A) silent deny
const denied = await e2e.sendText(`/admin`, plainUser)
expect(denied).toHaveLength(0)

// B) deny-and-explain
expect(e2e.lastCall(`answerCallbackQuery`)?.body?.text).toBe(`Forbidden`)
expect(e2e.calls.map((call) => call.method)).not.toContain(`editMessageText`)
```

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

## The send family

`sendText`, `sendPhoto`, `sendVideo`, `sendAudio`, `sendDocument`,
`sendAnimation`, `sendVoice`, `sendVideoNote`, `sendSticker`, `sendLocation`,
`sendContact`, `sendPollAnswer`, `sendDice`, `sendCallbackQuery`, `sendInlineQuery`,
`sendNewChatMembers`, `sendChannelPost` and others: one per update shape, each
taking the payload plus an optional `IE2eUpdateOptions` carrying the sender.
They all funnel into `handleUpdate`, so a shape without a named sender still has
an escape hatch:

```ts
await e2e.handleUpdate({message: {text: `/start`, chat: {id: 1}, from: {id: 1}}})
```

Use `lastCall()` to reach back at a captured call without holding the return
value, and `bodyOf` to narrow a call's body when you need a field the extractors
do not return.

## Running them

```bash
bun test e2e/            # the suite
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

It implements the Bot API methods gramstax actually calls, not the whole API. If
you reach for something it does not implement, the test fails loudly rather than
passing against a stub that answers anything.

It also does not model Telegram's own behaviour: rate limits, flood waits,
message TTLs. A test that passes here can still hit a rate limit in production,
which is why [metrics](/guides/observability) exist for the things a test cannot
see.

## Keep the mirror honest

The scaffold ships two checks, and they answer different questions:

- `check-e2e-mirror.ts` proves every page under `src/pages` has a corresponding
  test file, and that no orphan test has lost its page.
- `check-e2e-handlers.ts` proves every `handle*` in the page tree has a row in
  `e2e/COVERAGE.md` naming the test that exercises it, and that every test file
  is referenced by at least one row.

The mirror alone cannot stop coverage rot: a mirrored stub that only asserts page
registration passes it. The ledger is what makes *behavior* coverage checkable.
For a new page, add the mirrored test and one row per handler; run
`bun run test:e2e:check` before claiming the page is done.

## Related

- [The render contract](/concepts/render-contract): why an assertion can know
  which method ran
- [Deploy](/concepts/deploy): what `deploy: "test"` actually changes
- [ADR-0006: In-process E2E testing](/guides/adr/0006-in-process-e2e): why this
  approach was chosen