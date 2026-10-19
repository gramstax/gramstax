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
  token, and the stream and retry behaviour a test wants.
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

## Writing a test

A `send*` call returns the array of API calls the update produced. Clear between
tests, then assert on element zero:

```ts
import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser} from "./setup"

beforeEach(() => {
  e2e.clearCalls()
})

describe("StartPage", () => {
  it("greets in the user's language", async () => {
    const responses = await e2e.sendText(`/start`, enUser)
    expect(responses[0]?.body?.rich_message.html).toContain(`Welcome`)
  })
})
```

`clearCalls()` empties the captured calls. `reset()` does that *and* rewinds the
update and message id counters, which is what you want when a test asserts on
idempotency rather than on output.

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
bun test e2e/
```

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
// …
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
which is why [metrics](/guides/configuration) exist for the things a test cannot
see.

## Keep the mirror honest

The scaffold ships a mirror check that verifies every page under `src/pages` has a
corresponding test. A page added without one fails the check, so coverage cannot
quietly rot as the page tree grows.

## Related

- [The render contract](/concepts/render-contract): why an assertion can know
  which method ran
- [Deploy](/concepts/deploy): what `deploy: "test"` actually changes
- [ADR-0006: In-process E2E testing](/guides/adr/0006-in-process-e2e): why this
  approach was chosen