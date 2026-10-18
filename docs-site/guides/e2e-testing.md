---
title: E2E testing
description: Testing a page by driving the compiled template against an in-process mock of the Telegram API.
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

## How it works

`deploy: "test"` swaps the Telegram API for `MockTelegramServer`, an in-process
implementation that speaks the same methods. The page's `static template` is
compiled exactly as it is in production, so what your test reads is what a user
receives.

That is the part that matters: **the assertion and the output come from the same
compiled block.** A test cannot pass against markup the user would never see.

## Writing a test

The scaffold puts these under `e2e/`. A test sends an update and asserts on the
captured call:

```ts
import {describe, expect, it} from "bun:test"
import {e} from "./setup"

describe("start", () => {
  it("greets by name", async () => {
    e.text("/start Dengklek")
    expect(await e.extractText()).toContain("Hello Dengklek")
  })
})
```

For a keyboard, assert on the labels rather than the markup:

```ts
it("offers three choices", async () => {
  e.text("/start")
  expect(await e.extractButtonLabels()).toEqual(["1", "2", "3"])
})
```

## Running them

```bash
bun test e2e/
```

<Check>
  Tests are hermetic. There is no Telegram call, so they do not need a token, are
  not rate-limited, and give the same result on a laptop and on CI.
</Check>

## What the mock does not do

It implements the Bot API methods gramstax actually calls, not the whole API. If
you reach for something it does not implement, the test fails loudly rather than
passing against a stub that answers anything.

It also does not model Telegram's own behaviour — rate limits, flood waits,
message TTLs. A test that passes here can still hit a rate limit in production,
which is why [metrics](/concepts/deploy) exist for the things a test cannot see.

## Keep the mirror honest

The scaffold ships `scripts/check-e2e-mirror.ts`, which verifies that every page
under `src/pages` has a corresponding test. A page added without one fails the
check, so coverage cannot quietly rot as the page tree grows.

## Related

- [The render contract](/concepts/render-contract) — why an assertion can know
  which Telegram method ran
- [Deploy](/concepts/deploy) — what `deploy: "test"` actually changes
- [ADR-0006: In-process E2E testing](/guides/adr/0006-in-process-e2e) — why this
  approach was chosen