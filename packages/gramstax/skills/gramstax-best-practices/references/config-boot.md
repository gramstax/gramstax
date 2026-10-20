# config-boot

Every project boots from a typed `gramstax.config.ts` default export plus `src/core/bot.ts`. There is no `src/index.ts` and no hand-written `new Gramstax({...})`.

## Why

v2.2.0 made the config file the single composition point. One file holds the token, deploy mode, caches, and runtime tuning as *data*, and the CLI builds the instances from it. That removes a whole class of boot bugs — a stale constructor call in an entry file cannot drift from `.env` — but it means an incorrect config is the first thing that breaks, and it breaks before any page loads.

## Shape

```typescript
// gramstax.config.ts — project root, default export, annotated with the type
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {store: process.env.CACHE_SESSION_STORE ?? `memory`, ttlMs: 4 * 60 * 60 * 1000, namespace: `s`},
  log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}},
  optionsPage: {shortCallbackQueryData: true},
  optionsDeploy: {
    polling: {maxRetries: undefined, queue: undefined},
    webhook: {url: undefined, secretToken: undefined, queue: undefined},
    serverless: undefined,
    raw: undefined,
    test: undefined
  },
  mediaRoots: undefined,
  botConfig: undefined,
  autoRetry: undefined,
  autoRetryOptions: undefined,
  rateLimit: undefined,
  throttle: undefined,
  updateTimeoutMs: undefined,
  skipDuplicateUpdate: undefined,
  maxTextLength: undefined,
  statusServerPort: undefined,
  statusServerHostname: undefined,
  cacheKeyboard: undefined,
  templateManager: undefined,
  sessionLock: undefined
}

export default config
```

That is the scaffolded file from `create-gramstax`, verbatim. Every key is listed, unset ones explicitly `undefined`. Copy it and edit; do not hand-roll a shorter config and assume the rest defaults — the explicit `undefined` is what makes the branches *empty* rather than *present* (see `deploy-modes.md`).

## Scripts

```json
"dev": "bun --bun gramstax start --watch",
"start": "bun --bun gramstax start",
"build:gramstax": "gramstax build"
```

`bun --bun` is required: plain node cannot resolve TS paths or the `~` alias.

## Incorrect

```typescript
// src/index.ts — removed in v2.2.0; nothing discovers it
import {Gramstax} from "gramstax"

const bot = new Gramstax({token: process.env.BOT_TOKEN, deploy: `webhook:https://x/hook`, templateManager})
bot.start()
```

```typescript
// gramstax.config.ts — untyped, and a bare module ref is rejected
const config = {
  log: {module: `./src/helpers/log.ts`, export: `LogHe`} // removed bare form
}
export default config
```

## Correct

```typescript
// gramstax.config.ts — annotated, so every key is typo-checked at compile time
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}}
}

export default config
```

```typescript
// src/core/bot.ts — the ONLY class the CLI constructs; construction IS boot
import {Gramstax} from "gramstax"
import type {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore) {
    return true
  }
}
```

No `.run()`, no `await`, no export default — `gramstax start` imports `src/core/bot.ts` (then `.js`), takes the **first export whose `prototype instanceof Gramstax`**, and constructs it with the materialized config.

## Rules

- **Type it.** `GramstaxConfig` is an alias of `IGramstaxConfig`; the annotation is what catches misspelled keys. `tsc --noEmit` covers it via `bun run ci:check` — note the gate pins `typescript@7.0.2` through `bunx --package`, so a bare `bunx tsc` checks a different major version than CI.
- **Default export only.** Named exports are ignored. A non-object default export throws.
- **Only the 19 known fields.** Anything else — including `manifest` — throws `unknown field`. `manifest` is a *constructor* param, not a config field.
- **Missing file is legal** and means `{deploy: 'polling'}`. That is what keeps zero-config `gramstax build` working.
- **`token` holds the value, not a variable name.** `process.env.X ?? ``` is correct; a literal is a committed secret. Empty string is accepted at load (env-less build still works) but `gramstax start` throws `Token is not valid or empty`.
- **Paths resolve from the project root**, not from the config file.
- **Secrets are never literals.** `secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``` — same reason as `token`.

## Instance slots use path-refs

Five slots accept a module reference the CLI resolves and instantiates for you: `cacheSession`, `cacheKeyboard`, `templateManager`, `log`, `sessionLock.key`.

| Form | Meaning |
| --- | --- |
| `"path string"` | default export, zero-arg constructor |
| `{override: {module, export?, args?}}` | named export, spread into `new Export(...args)` |
| `{module, ...}` bare | **rejected** — `uses removed bare {module, ...} form` |
| plain data (`{store, ttlMs, namespace}`, `true`/`false`, `ITemplateOptions`) | built with the builtin constructor |

```typescript
log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}} // named export
cacheSession: {store: `redis://localhost:6379`, ttlMs: 3600000, namespace: `sess`} // builtin form
templateManager: {override: {module: `./src/templates.ts`, export: `SharedManager`, args: []}}
```

Every materialized slot is `instanceof`-checked against its expected base and fails loudly:

```text
gramstax start: invalid `cacheSession` from ./src/cache.ts#NotACache - expected instance of CacheExternal
```

| Slot | Expected base |
| --- | --- |
| `cacheSession` | `CacheExternal` |
| `cacheKeyboard` | `Map` |
| `templateManager` | `TemplateManager` |
| `log` | `LoggingHelper` |
| `sessionLock.key` | a non-class function |

A ref that resolves to an already-built instance is used as-is; anything else is constructed. See `cache-store.md`.

## Boot precedence

One channel, no surprises:

1. `--deploy <mode>` flag
2. config `deploy`
3. `polling`

`--watch` watches `src`, stops the instance, and reboots with cache-busted imports; boot errors during a restart print and keep watching.

If `no Gramstax subclass export found in <bot-file>` fires for a correct-looking `BotCore`, you have two `gramstax` copies: a `tsconfig` `paths` entry redirects `gramstax` to `packages/gramstax/src/index.ts` while the CLI runs from `dist`, so `instanceof` compares across copies. Remove the mapping — scaffolded projects already strip it.

## Notes

- e2e does **not** use this file. `e2e/setup.ts` constructs `BotCore` directly with `deploy: 'test'` — see `e2e-setup.md`.
- `templateManager` defaults to `new TemplateManager({path: [<cwd>/src/pages]})` when omitted; set it only to share one manager across several page directories.
- Field-by-field defaults and the full `optionsDeploy` branch rules are in `deploy-modes.md`; production tuning in `deploy-runtime.md`; the build side in `deploy-build.md`.
- `gramstax start` imports path-refs; `gramstax build` never does. Builds stay static — see `deploy-build.md` for what reaches a deployed entry.