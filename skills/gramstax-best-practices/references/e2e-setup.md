# e2e-setup

**Verdict:** one `e2e/setup.ts` constructs `BotCore` with `deploy: "test"`, every page gets a mirrored test file, and every test isolates calls, session, and persistent state before it asserts.

## Why

`deploy: "test"` injects updates through `bot.bot.handleUpdate()` in-process and intercepts every outbound Bot API call with `bot.api.config.use()`. There is no HTTP server, no port, no polling, no `beforeAll` wait. A test is a function from update to captured calls, so it runs identically on a laptop and CI.

The harness also decides what the suite *can* prove. A setup that imports the real config, shares one user id across files, or leaks a session between tests produces green suites that hide production bugs.

## Harness contract

`e2e/setup.ts` exports at least these symbols. Test files import only from `./setup` (or `../../setup`), never construct their own bot.

| Export | Type | Purpose |
| --- | --- | --- |
| `bot` | `BotCore` | The constructed bot; used for `bot.pages.all` and project state handles |
| `e2e` | `E2eHelper` | The driver: `send*`, `calls`, `gmsg`, `gkb`, `gmedia` |
| `enUser` | `{user, chat?}` | Default-language fixture (`language_code: "en"`) |
| `idUser` | `{user, chat?}` | Second-language fixture (`language_code: "id"`) |
| `resetEnv` | `() => Promise<void>` | Project-specific state cleanup; call from `beforeEach` |

Add more fixtures only when a test needs a distinct identity (admin, banned, no-username). Export the type re-exports so tests do not reach into the package:

```typescript
export type {IE2eApiCall, IE2eUpdateOptions} from "gramstax"
```

## Correct setup

```typescript
// e2e/setup.ts
import {join} from "node:path"
import {TemplateManager} from "gramstax"
import {BotCore} from "../src/core/bot"

export type {IE2eApiCall, IE2eUpdateOptions} from "gramstax"

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  autoRetry: true,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)]
  })
})

export const e2e = bot.e2e!

// `username` is required by the template UserGuard; `chat` is omitted because
// sessions are keyed by user id.
export const enUser = {user: {id: 4001, username: `testuser`, language_code: `en`}}
export const idUser = {user: {id: 5001, username: `pengguna`, language_code: `id`}}
```

Why each field:

| Field | Why it must be there |
| --- | --- |
| `deploy: "test"` | Attaches `bot.e2e`, injects updates in-process, skips polling/webhook/serverless |
| `token: "test"` | grammY requires a token; no network call is made |
| `log: false` | Keeps test output readable and prevents logger I/O from masking ordering bugs |
| `autoRetry: true` | Mounts the production retry wrapper; the in-process interceptor answers success, so no retry traffic is generated |
| `templateManager` | Points at `src/pages`; without it, no pages or templates load |

Streaming is **not** a constructor flag. `Gramstax` mounts `@grammyjs/stream` unconditionally, so `replyWithStream` and the draft API methods are always available. `stream` is not part of `IGramstaxParams`; do not add `stream: true` to a harness.

### e2e does NOT use `gramstax.config.ts`

This is the one place the constructor form is correct. `gramstax start` builds the bot from config *data*; e2e must construct the bot directly so it can force `deploy: "test"`, `token: "test"`, `autoRetry`, and `log: false`. Loading the real config would pull in a real token, a real deploy mode, and real network risk.

| | Production / local run | e2e |
| --- | --- | --- |
| Entry | `gramstax start` reads `gramstax.config.ts` | `e2e/setup.ts` constructs `BotCore` |
| Token | `process.env.BOT_TOKEN` | `test` |
| Deploy | `polling` / `webhook` / `serverless` | `test` |
| Extras | from config | `autoRetry: true`, `log: false` |

The trade-off: config-level mistakes (a bad `optionsDeploy` branch, a wrong path-ref) are **not** exercised by e2e. Cover the config itself with `tsc --noEmit` plus a real `gramstax build --dry-run` in CI.

```typescript
// INCORRECT: e2e loading the real config
import config from "../gramstax.config"
export const bot = new BotCore({...config, deploy: `test`})
```

```typescript
// INCORRECT: spinning up an HTTP mock for an in-process test
import {MockTelegramServer} from "gramstax"
const mock = new MockTelegramServer()
await mock.start()
```

`MockTelegramServer` is for the bench harness and for tests that need a real socket. `deploy: "test"` never mounts it.

## Lifecycle

| Stage | What happens | What the test must do |
| --- | --- | --- |
| Module load | `new BotCore(...)` registers middleware, loads pages, and sets `bot.ready` | Nothing |
| `bot.ready` | Resolves after `hookBeforeStart` + `hookAfterStart` (test mode runs them immediately) | `await bot.ready` at the top of a suite that depends on async startup (workers, DB open, HTTP server) |
| First `send*` | `_ensureInit()` calls `bot.bot.init()` once, which fetches bot info through the interceptor | Nothing; `getMe` is answered internally, never recorded |
| Each update | `handleUpdate` records calls from the update's start index and returns that slice | Assert on the returned slice or on `e2e.calls` |
| `clearCalls()` | Empties `e2e.calls`; counters and sessions untouched | Call in `beforeEach` |
| `reset()` | Empties calls, restores update/message/api id counters to `1`, forces re-init | Use only when a test asserts ids or boot idempotency |

If a page defers its API calls (a timer, a worker round-trip, a queued job), wait deterministically:

```typescript
await e2e.handleUpdate(update, 50) // typed second argument: settle ms
```

`settleMs` is also read from `send*` options at runtime, but it is not declared on `IE2eUpdateOptions`; prefer the `handleUpdate` argument in TypeScript.

## Fixtures and ids

- Defaults when a field is omitted: user `{id: 1001, first_name: "Test", is_bot: false, language_code: "en"}`, chat `{id: 1001, type: "private", first_name: "Test"}`.
- **Allocate a unique `user.id` block per test file.** The `bot` instance and its session store live at module scope and are shared by every file in the run. Two files using `4001` for different flows will answer each other's pending steps.
- Chat id defaults to `1001`, not the user id. Sessions are keyed by `userId:chatId`, so omitting `chat` still isolates fixtures by user id; set `chat` explicitly when a page keys state by chat.
- A fixture with no `username` deliberately exercises the username guard.
- Keep fixture objects immutable; clone when a test needs an override: `{user: {...enUser.user, id: 4100}}`.

## Isolation, in three layers

| Layer | Shared by | Reset with |
| --- | --- | --- |
| Captured calls | every test in the run | `beforeEach(() => e2e.clearCalls())` |
| Session | every update for the same user id | unique ids per file; a routed non-session update auto-clears the pending session; `/start` in the scaffold explicitly clears it |
| Persistent state (DB, cache, files) | every test in the run | `await resetEnv()` in `beforeEach`; scope rows by user id |

Never rely on test order. Bun may run files in a different order than you wrote them, and a retried test starts with whatever the previous one left behind.

```typescript
// e2e/create.test.ts
import {beforeEach, describe, expect, it} from "bun:test"
import {e2e, enUser, resetEnv} from "./setup"

beforeEach(async () => {
  e2e.clearCalls()
  await resetEnv()
})
```

## Structure mirroring — `e2e/` MUST mirror `src/pages/`

```
src/pages/                   e2e/
├── start.ts      ──────▶    ├── start.test.ts
├── start/                   ├── start/
│   ├── index.ts  ──▶        │   ├── index.test.ts
│   └── counter/             │   └── counter/
│       └── index.ts  ──▶    │       └── index.test.ts
├── help.ts        ──────▶    ├── help.test.ts
└── sum-number.ts  ──────▶    └── sum-number.test.ts
```

Rules:

- `foo.ts` → `foo.test.ts`; `foo/bar.ts` → `foo/bar.test.ts`; `foo/index.ts` → `foo/index.test.ts` in the same folder (never at the parent level).
- `.js` pages get `.test.js`.
- `setup.ts` is the harness, not a page test — it is not mirrored.
- `COVERAGE.md` is the ledger (`e2e/COVERAGE.md`), not a page test — it is not mirrored.
- A test file **must** have a page counterpart, or the check reports it as an orphan. Boot/harness tests that intentionally have no page go in the checker's `EXTRA_TESTS` list.
- The generated stub only asserts registration. Replace it with behavioral tests; a stub left in place is a coverage hole.

Commands (shipped in generated projects and in the repo root):

```bash
bun run scripts/check-e2e-mirror.ts --path .   # fail on missing/orphan
bun run scripts/check-e2e-mirror.ts --path . --fix  # scaffold missing stubs
bun run scripts/check-e2e-handlers.ts --path . # ledger audit
bun run test:e2e:check                          # both, as test:all runs them
bun run scripts/generate-e2e-structure.ts      # bulk-generate stubs
```

The checker's page key is the relative path without the extension, so nested pages are accessed as `bot.pages.all["start/random"]`.

## Project extras

Put project-specific setup after the harness exports:

```typescript
export async function resetEnv() {
  await bot.db.items.purgeAll()
}
```

- Seed deterministic state before the **first** update of a test, not in the middle of a flow.
- Monkey-patch page dependencies **before** `new BotCore(...)`; pages are constructed per update but their imports are resolved at module load.
- A real HTTP fixture uses port `0` and `afterAll(() => server.stop())`.

## Anti-patterns

| Anti-pattern | Why it fails |
| --- | --- |
| Importing `gramstax.config.ts` | Real token/deploy mode; boot paths diverge from the suite |
| One global user id for every flow | Pending sessions leak across files and tests |
| `beforeEach` missing `clearCalls` | Assertions see previous updates' calls |
| Asserting `responses.length > 0` only | Proves nothing about text, method, keyboard, or route |
| Using `Bun.sleep` to wait for deferred work | Flaky; use `handleUpdate(update, settleMs)` or `await bot.ready` |
| Starting `MockTelegramServer` | Adds HTTP flakiness for no coverage gain |
| Reading DB rows to verify a handler | Tests internals; assert the next rendered message instead |
| Sharing mutable fixture objects | One test's override changes another's expectation |

## Checklist

- [ ] `e2e/setup.ts` constructs `BotCore` with `deploy: "test"`, `token: "test"`, `log: false`, `autoRetry: true`, and the correct `TemplateManager` path.
- [ ] `enUser`, `idUser`, and any role fixtures have unique ids per file.
- [ ] `bot.ready` is awaited when startup does async work.
- [ ] `beforeEach` clears calls and resets persistent state.
- [ ] The mirror check exits 0, and no generated stub remains as the only test for a page.
- [ ] `bun run test:e2e` passes from a clean checkout.
