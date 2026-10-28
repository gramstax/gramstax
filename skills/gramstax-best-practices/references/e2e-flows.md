# e2e-flows

**Verdict:** test the flow a user actually takes — start, step, invalid input, cancel, interruption, isolation, denial, fallback, language — not just the first screen.

## Why

Most escaped bugs are not "the happy path renders nothing". They are: a session step that survives `/start`; user A's pending input answering user B; an admin gate that silently allows everyone; an unknown callback that throws; a language variant that falls back to English on one screen and not the next. These only appear when the test drives multiple updates and asserts after each one.

## Flow 1 — fresh start clears prior state

```typescript
it(`starts clean after a pending step`, async () => {
  await e2e.sendCallbackQuery(`sum-number`, enUser) // arms step left
  e2e.clearCalls()

  const restarted = await e2e.sendText(`/start`, enUser)
  expect(restarted[0]!.body?.text).toBe(e2e.gmsg(`start`, `default`, {userName: `testuser`}))

  e2e.clearCalls()
  const next = await e2e.sendText(`10`, enUser) // must NOT continue the old flow
  expect(next[0]!.body?.text).not.toBe(e2e.gmsg(`sum-number`, `r`, {}))
})
```

Why this works: every non-session route auto-clears the pending session once per dispatch (`_clearSessionOnNonSession`), and the scaffold's `StartPage` also calls `clearSession()`. Session routes never auto-clear.

## Flow 2 — multi-step form

Cover all five outcomes:

```typescript
describe(`E2E: CheckoutPage`, () => {
  async function enterCheckout(user: typeof enUser) {
    await e2e.sendText(`/start`, user)
    await e2e.sendCallbackQuery(`checkout`, user)
  }

  beforeEach(async () => {
    e2e.clearCalls()
    await resetEnv()
  })

  it(`rejects empty input and re-prompts`, async () => {
    await enterCheckout(enUser)
    const retry = await e2e.sendText(``, enUser)
    expect(retry[0]!.body?.text).toBe(e2e.gmsg(`checkout`, `retry`, {}))
  })

  it(`rejects invalid input without losing the step`, async () => {
    await enterCheckout(enUser)
    const retry = await e2e.sendText(`not-an-address`, enUser)
    expect(retry[0]!.body?.text).toBe(e2e.gmsg(`checkout`, `retry`, {}))
  })

  it(`advances on valid input`, async () => {
    await enterCheckout(enUser)
    const next = await e2e.sendText(`Jl. Merdeka 1`, enUser)
    expect(next[0]!.body?.text).toBe(e2e.gmsg(`checkout`, `confirm`, {address: `Jl. Merdeka 1`}))
  })

  it(`cancels and clears the step`, async () => {
    await enterCheckout(enUser)
    const cancelled = await e2e.sendCallbackQuery(`checkout:cancel`, enUser)
    expect(cancelled[0]!.body?.text).toBe(e2e.gmsg(`start`, `default`, {userName: `testuser`}))
  })

  it(`does not continue another user's step`, async () => {
    await enterCheckout(enUser)          // 4001 is waiting for an address
    const other = await e2e.sendText(`hello`, idUser)
    expect(other.length).toBeGreaterThan(0) // idUser is not in 4001's flow
  })
})
```

Rules:

- Clear calls between steps so the previous step cannot satisfy the next assertion.
- After an invalid input, prove **both** that the step was retained and that a later valid input still completes the flow. A test that stops after the re-prompt can pass while the state was wiped.
- Exercise cancel/back through the button the user actually presses (`callback_data` from `gkb` / the rendered keyboard), not by calling `clearSession()`.
- If the page sets a TTL, advance time or assert the documented fallback; do not assume expiry.

## Flow 3 — session isolation

The session key includes the user (and chat, when the page keys by chat). Two users must never see each other's state.

```typescript
it(`keeps sessions isolated`, async () => {
  await e2e.sendText(`/start`, enUser)
  await e2e.sendText(`/start`, idUser)
  e2e.clearCalls()

  await e2e.sendCallbackQuery(`sum-number`, enUser) // 4001 enters step left
  const other = await e2e.sendText(`10`, idUser)    // 5001 sends the same input
  expect(other[0]!.body?.text).not.toBe(e2e.gmsg(`sum-number`, `r`, {}))
})
```

- Use ids from the same file consistently; never share a fixture id with another file.
- If the page keys by chat, set `chat: {id}` explicitly and test two users in one chat and one user in two chats only if the product supports it.
- A session leak is a data bug, not a UI bug: assert the next render, not the cache.

## Flow 4 — gates, both directions

### Page-level gate (`hookBeforeRoute` on a base class)

```typescript
const allowed = await e2e.sendText(`/admin`, adminUser)
expect(allowed[0]!.body?.text).toBe(e2e.gmsg(`admin`, `default`, {}))

e2e.clearCalls()
const denied = await e2e.sendText(`/admin`, plainUser)

// Silent-deny contract (the framework default):
expect(denied).toHaveLength(0)

// OR deny-and-explain contract (the hook answered before returning false):
// expect(e2e.lastCall(`answerCallbackQuery`)?.body?.text).toBe(`Forbidden`)
// expect(e2e.calls.map((c) => c.method)).not.toContain(`editMessageText`)
```

Pick the contract the page implements. Asserting both is impossible; asserting neither leaves the gate untested.

### Bot-level gate (`hookBeforeRoute` on `BotCore`)

Same two users, but the whole update is dropped before routing: no page render, no `hookAfterRoute`, no `hookNotFoundPage`. If the bot gate increments `metrics.counts.blocked`, you may assert it; do not use metrics for a page-level gate (it does not increment).

### `GuardBase` inside a handler

A guard that returns early inside one handler is not a route gate. Test the allowed path and the guard's own denial output; the handler may render a message instead of dropping silently.

## Flow 5 — fallbacks and recovery

Every project needs all three:

```typescript
it(`routes unknown callbacks to StatusPage`, async () => {
  const res = await e2e.sendCallbackQuery(`nonexistent-callback-data`, enUser)
  expect(res[0]!.body?.text).toBe(e2e.gmsg(`status`, `nf`, {}))
})
it(`routes unknown commands to StatusPage`, async () => {
  const res = await e2e.sendText(`/definitely-not-a-command`, enUser)
  expect(res[0]!.body?.text).toBe(e2e.gmsg(`status`, `nf`, {}))
})

it(`recovers after a fallback`, async () => {
  await e2e.sendCallbackQuery(`nonexistent-callback-data`, enUser)
  e2e.clearCalls()
  const res = await e2e.sendText(`/start`, enUser)
  expect(res[0]!.body?.text).toBe(e2e.gmsg(`start`, `default`, {userName: `testuser`}))
})
```

Add `handleFree` / `handleFree*` coverage only when the project defines them. A fallback that produces no call and no throw is acceptable only when it is the documented `hookBeforeRoute` deny; routing `no-match` should normally render `StatusPage` (`status`/`nf` is the scaffold's fallback block — substitute the app's page and block id).

## Flow 6 — language variants

For every page with translations:

```typescript
it(`renders the Indonesian variant`, async () => {
  const en = await e2e.sendCallbackQuery(`start/random`, enUser)
  const id = await e2e.sendCallbackQuery(`start/random`, idUser)

  expect(e2e.extractText(en[0]!)).toBe(e2e.gmsg(`start/random`, `default`, {}, `en`))
  expect(e2e.extractText(id[0]!)).toBe(e2e.gmsg(`start/random`, `default`, {}, `id`))
  expect(e2e.extractButtonLabels(id[0]!)).toEqual(e2e.gkb(`start/random`, `default`, `inline`, {}, `id`))
})

it(`falls back to the default block for an unsupported language`, async () => {
  const fr = await e2e.sendCallbackQuery(`start/random`, {user: {id: 4301, username: `francais`, language_code: `fr`}})
  expect(e2e.extractText(fr[0]!)).toBe(e2e.gmsg(`start/random`, `default`, {}, `default`))
})
```

- Language routing: `intentTextMap` / `intentCommandTextMap` are keyed by language; a user with `language_code: 'id'` must reach the translated intent.
- Do not assert a literal translation. The template is the source of truth.
- If one state is translated and another is not, assert both — partial translation is the common bug.

## Flow 7 — args routes

```typescript
// callback args: colon-separated
await e2e.sendCallbackQuery(`product:42`, enUser)

// text args: space-separated
await e2e.sendText(`search blue shoes`, enUser)

// command args
await e2e.sendText(`/ban 42`, enUser)
```

Test the exact route and the args route separately. A page that defines only `handleArgsCallbackQueryData` must be exercised with args; sending the bare intent is a different (usually fallback) route.

## Flow 8 — mixed media and captions

```typescript
// command captions match `/command`; plain caption routes match the bare page name
await e2e.sendPhoto({caption: `/upload`, user: enUser})       // handleCommandCaptionPhoto
await e2e.sendPhoto({caption: `checkout`, user: enUser})       // handleCaptionPhoto
await e2e.sendDocument({caption: `checkout`, user: enUser})    // handleCaptionDocument
await e2e.sendVoice({user: enUser})                             // handleFreeVoice
await e2e.sendVideoNote({user: enUser})                         // handleFreeVideoNote
```

For every media handler the page defines, send that media type. A text-only suite cannot prove a `handleCaptionPhoto` or `handleSessionFreeVoice` route.

## Flow 9 — broadcast

```typescript
it(`fans out one send per recipient in each language`, async () => {
  const res = await e2e.sendCallbackQuery(`broadcast:confirm`, adminUser)
  const sends = res.filter((call) => call.method === `sendMessage`)

  expect(sends).toHaveLength(2)
  expect(sends.map((call) => call.body?.chat_id)).toEqual([4001, 5001])
  expect(String(sends[0]!.body?.text)).toBe(e2e.gmsg(`broadcast`, `sent`, {}))
})
```

- Assert the recipient list and count, not only "a message was sent".
- When `broadcast.languageCode` is used, assert each recipient receives the variant for their language.
- Broadcast sends are real captured calls; no network is involved.
- If the page throttles, the assertion still sees every call in the same update; do not sleep.

## Flow 10 — workers, LMDB, HTTP

```typescript
import {beforeAll, describe, expect, it} from "bun:test"
import {bot, e2e, enUser, resetEnv} from "./setup"

beforeAll(async () => {
  await bot.ready // hookBeforeStart/hookAfterStart completed; workers and DB handles are live
})

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

it(`returns a worker-computed counter`, async () => {
  const res = await e2e.sendCallbackQuery(`start/counter/thread`, enUser)
  expect(e2e.extractText(res[0]!)).toContain(`Count:`)
}, 15_000)
```

- Await `bot.ready` before the first update when startup does async work.
- Give worker/DB/HTTP tests a timeout; the default can be too short on CI.
- Assert the rendered result, not the worker's internal state.
- A real HTTP dependency: start on port `0`, inject the URL before bot construction, stop in `afterAll`.
- A real DB: seed before the first update, purge by user id in `beforeEach`, assert through the next render.

## Flow 11 — chat member transitions

```typescript
await e2e.sendChatMemberUpdate({oldStatus: `kicked`, newStatus: `member`, user: enUser.user, chat: {id: -1001, type: `supergroup`}})
await e2e.sendMyChatMemberUpdate({oldStatus: `member`, newStatus: `administrator`, chat: {id: -1001, type: `supergroup`}})
```

Handler names encode bucket transitions, not raw statuses: `handleChatMemberOutIn`, `handleMyChatMemberOutRegular`, `handleMyChatMemberRegularAdmin`, `handleMyChatMemberAdminRegular`, `handleMyChatMemberOutAdmin`. Use the matching `oldStatus`/`newStatus` for the handler under test.

Service updates do not carry a user `username`: `channel_post` has no `from`, and `my_chat_member` carries the bot. If the app's bot-level `hookBeforeRoute` requires `ctx.from.username`, it must exempt these listeners (or allow bots) — otherwise every service-update test is denied before routing and the assertion fails for the wrong reason.

## Flow 12 — errors

If the app implements `hookErrorPage`, force a handler to throw through a dependency you control (a repository stub registered before bot construction, or a test-only page); do not edit production code to add a throw switch. Assert the rendered error page or the hook's captured output. Do not assert on a swallowed exception: `e2e.handleUpdate` resolves when grammY's error boundary handles the update, so a green test with no output is a failure, not a pass.

## Test file shape

```typescript
import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, idUser, resetEnv} from "./setup"

const intent = `page-name`

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})

describe(`E2E: PageName`, () => {
  it(`does the specific thing`, async () => { /* one behavior */ })
})
```

- One `describe` per page, named after the class.
- One `it` per behavior; the name states the expected outcome.
- `beforeEach` always clears calls; add state reset when the page touches persistent data.
- No shared mutable variables between tests. If a helper enters a flow, it takes a user fixture and returns the responses.

## Anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Testing only the first screen | Later steps, invalid input, and cancel are where bugs live |
| One user id for every flow | Sessions collide across tests and files |
| Asserting a denial as "no crash" | A gate that allows everyone also does not crash |
| Assuming a page-level deny renders | `hookBeforeRoute` is silent unless the hook renders |
| Skipping the invalid-input recovery | Re-prompt can pass while the step was cleared |
| Using `Bun.sleep` for session/worker timing | Flaky; use `settleMs`, `bot.ready`, or await the update |
| Reimplementing the flow in the test | Test the user's buttons and text, not private methods |
| Asserting literal translations | Drifts from the template and hides missing locales |

## Checklist

- [ ] Fresh-start clears any pending step.
- [ ] Every multi-step flow covers success, empty, invalid, cancel, and cross-user isolation.
- [ ] Every gate covers allow and deny with two users, asserting the chosen deny contract.
- [ ] Unknown callback, unknown command, and one unsupported shape fall back and recover.
- [ ] Every declared locale is asserted; unsupported language falls back to default.
- [ ] Args routes are triggered with args; exact routes without.
- [ ] Every media handler the page defines is triggered with that media.
- [ ] External boundaries await `bot.ready`, use real services, and clean up.
- [ ] Error paths produce the documented output, not silence.
