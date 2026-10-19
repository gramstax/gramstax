---
title: "ADR-0006: In-Process E2E Testing via the Test Deploy Mode"
description: Why test mode attaches an E2eHelper that intercepts Bot API calls in-process, so tests need no token, network, or port binding.
icon: beaker
---

# ADR-0006: In-process E2E testing via `deploy:"test"`

<Info>
  **Status:** Accepted

  **Date:** 2025 (inferred from package history)
</Info>

## Context

Testing a Telegram bot normally requires a live bot token and a reachable webhook/polling endpoint, or standing up a mock HTTP server. Both add flakiness and setup cost to unit/E2E tests. The framework wants to exercise full update→handler→Bot-API-call flows **in-process, with zero HTTP**.

## Decision

When a bot is created with **`deploy: "test"`**, `Gramstax` attaches an **`E2eHelper`** instance (`src/e2e/helper.ts:62`) to `bot.e2e` instead of starting a real transport. The helper installs a grammY API interceptor via `bot.bot.api.config.use(...)` (`helper.ts:78`) that captures every outbound call into `calls` and returns canned success objects (e.g. `getMe`, `setWebhook`). Tests then "send" updates with `sendText` / `sendPhoto` / `sendCallbackQuery` / … which build a raw Telegram `Update` and feed it through `bot.bot.handleUpdate()`; assertions read `e2e.lastCall("sendMessage")`, `e2e.extractText(call)`, `e2e.extractButtonLabels(call)`.

A complementary **`MockTelegramServer`** (`src/mock/telegram-server.ts`) provides a lightweight HTTP mock of the Bot API for offline _integration_ tests that do want a server.

<Warning>
  `bot.e2e` is typed as `undefined` unless `deploy` is a `"test"` variant
  (`core/bot.ts:184`), so the helper will not type-check outside test mode. The
  interceptor must also stay in sync with grammY's `api.config.use` contract.
</Warning>

## Consequences

### Benefits

- No token, no network, no port binding in tests: fast and deterministic.
- Full handler logic is exercised (routing, templates, sessions) not just unit slices.
- Captured `calls` give precise assertions on rendered text and keyboard labels.

### Trade-offs

- The interceptor must stay in sync with grammY's `api.config.use` contract.
- `E2eHelper` is typed as `undefined` unless `deploy` is a `"test"` variant (`core/bot.ts:184`), so it's only present in test mode.

### Alternatives Considered

| Alternative                     | Why Not Chosen                                    |
| ------------------------------- | ------------------------------------------------- |
| Live polling against a real bot | Needs a token + network; flaky, rate-limited.     |
| Always-on mock HTTP server      | More moving parts than an in-process interceptor. |

## Sources

| Source Type | Reference                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| Code        | `src/e2e/helper.ts:62,78`: `E2eHelper` + `bot.bot.api.config.use(...)` interceptor                  |
| Code        | `src/e2e/helper.ts:283-567`: `sendText`, `sendPhoto`, `sendCallbackQuery`, `sendDice`, … simulators |
| Code        | `src/core/bot.ts:184`: `e2e?: E2eHelper` (typed only for `deploy:"test"`)                           |
| Code        | `src/types/bot.ts`: `deploy: "test"` documented as E2E mode                                      |
| Code        | `src/mock/telegram-server.ts`: `MockTelegramServer` HTTP mock                                       |
| Docs        | `AGENTS.md`: "Test mode via `deploy: 'test'` + `MockTelegramServer`."                               |

## Related

- [Architecture](../architecture.md): Components: E2eHelper, MockTelegramServer
- [ADR-0007](/guides/adr/0007-bun-tsup-nx-toolchain.md): `bun test` runs these suites
