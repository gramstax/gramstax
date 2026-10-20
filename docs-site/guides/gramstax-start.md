---
title: gramstax start
description: How the start command boots a bot from gramstax.config.ts alone, discovers the bot class, and validates every materialized config slot.
icon: play
---

# `gramstax start`

Boot a polling/webhook bot from `gramstax.config.ts` alone: no `src/index.ts`.
`gramstax start` composes the bot from raw config DATA plus file-path INSTANCE
refs, discovers the `Gramstax` subclass at `src/core/bot.ts`, and constructs it
(constructor-driven boot, no `.run()` call).

```bash
gramstax start [--deploy <mode>] [--watch]
```

| Flag       | Effect                                            |
| ---------- | ------------------------------------------------- |
| `--deploy` | Deploy mode for this boot (beats config `deploy`) |
| `--watch`  | Restart the bot on `src` change                   |

Requires Bun: `bun --bun gramstax start`. Plain node breaks TS paths plus the
`~` alias, so template scripts always force the Bun runtime.

## Discovery

`src/core/bot.ts` must export a class extending `Gramstax` (conventionally
`BotCore`). The first value export whose `prototype instanceof Gramstax` wins,
mirroring the `PageManager._getFile` first-export rule.

```ts
import {Gramstax} from "gramstax"

export class BotCore extends Gramstax {
}
```

Missing file or no `Gramstax` subclass throws a clear error naming the file.

## Precedence (single channel)

`--deploy` beats config `deploy`, which defaults to `polling`. One channel only:
there is no env-var deploy override at boot (config files may read env
themselves, as the template does for local defaults).

## Secrets are values, not names

`token` holds the bot token VALUE itself (author-written env-or-literal,
mirroring `IGramstaxParams.token`). The scaffold writes
`token: process.env.BOT_TOKEN ?? ""`: `start` boots from
`config.token` and a missing/empty value throws the constructor message
verbatim:

```text
Token is not valid or empty
```

Load accepts `token` as any string including `""`, so an env-less
`gramstax build` keeps working when `BOT_TOKEN` is unset; only `start` enforces
a non-empty value. The webhook and serverless secret fields follow the same
pass-through rule: use an env expression, never a literal. For serverless, the
config value sets the webhook and local start, while the deployed worker reads
the `BOT_WEBHOOK_SECRET` binding. See
[Serverless deploy](/guides/serverless-deploy).

<Warning>
  Never commit real token/secret values; keep them in `.env`. The scaffold
  creates that file from the template's `.env.example`. The framework cannot
  distinguish a literal from an env-derived value, so no warning is possible:
  that caution is the whole guardrail.
</Warning>

## Path-ref form

<Warning>
  INSTANCE slots accept a bare string (default export, zero args) or
  `{override: {module, export?, args?}}` (named export, spread args). Paths
  resolve relative to the project root (cwd). A bare module ref **without** the
  `override` wrapper is rejected.
</Warning>

```ts
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  cacheSession: `./src/cache.ts`,
  templateManager: {override: {module: `./src/templates.ts`, export: `SharedManager`, args: []}},
  log: {override: {module: `./src/helpers/log.ts`, export: `LogHe`}}
}

export default config
```

The annotated `: GramstaxConfig` type (an alias of `IGramstaxConfig`)
typo-checks every key. The scaffolded `gramstax.config.ts`
(`packages/create-gramstax/src/templates/gramstax.config.ts`) lists all
20 keys and is the canonical full listing.

A ref resolving to an already-built instance (like the `LogHe` singleton) is
used directly. Anything else is constructed with `new Export(...args)`.

## `instanceof` rules

Every materialized slot is checked against its expected base. Failures throw
naming the slot plus the base:

```text
gramstax start: invalid `cacheSession` from ./src/cache.ts#NotACache - expected instance of CacheExternal
```

| Slot              | Expected base    | Builtin params form (no `module` key)              |
| ----------------- | ---------------- | -------------------------------------------------- |
| `cacheSession`    | `CacheExternal`  | `{store, ttlMs?, namespace?}` → `new CacheExternal(store, ttlMs, namespace)` |
| `cacheKeyboard`   | `Map`            | entries array or plain object → `new Map(...)`     |
| `templateManager` | `TemplateManager`| `ITemplateOptions` (`path` required)              |
| `log`             | `LoggingHelper`  | `true` → default logger, `false`/omitted → silent, options → `new LoggingHelper(opts)` |
| `sessionLock`     | _none_ (scalars) | `{enabled?, leaseMs?, onContended?, key?}` where `key` is a path-ref to a `(ctx) => string` factory |

`manifest` is NOT a config field: unknown fields (including `manifest`) throw
`Invalid gramstax config`.

## Start-only resolution

<Info>
  Path-ref IMPORT happens only in `gramstax start`, never in `gramstax build`.
  Builds stay static: when the config carries any override slot and the target set
  includes `cloudflare-mod`, `gramstax build` prints a non-blocking warning per
  slot and keeps emitting.
</Info>

```text
gramstax build: custom `cacheSession` ignored on cloudflare-mod (edge boots from frozen manifest output)
```

## Field reference

Scalar rules mirror the constructor `_validateConfig` where they exist;
violations throw `Invalid gramstax config at <file>: ...` naming the field.

| Field                   | Type                              | Default   | Rule                                    |
| ----------------------- | --------------------------------- | --------- | --------------------------------------- |
| `token`                 | `string`                          | _none_    | Any string incl. `""` at load; non-empty required for start |
| `deploy`                | `string`                          | `polling` | One of `polling`, `webhook`, `serverless`, `raw` or `test`; `--deploy` wins |
| `optionsDeploy`         | `{polling?: {maxRetries?, dropPendingUpdates?, queue?}, webhook?: {url?, secretToken?, queue?}, serverless?: {'cloudflare-mod'?: {url?, secretToken?, name?, compatibilityDate?, compatibilityFlags?, toml?}, 'aws-lambda-async'?: {url?, secretToken?}}, raw?: {}, test?: {}}` | _none_    | `webhook` needs `url` + `secretToken`; `serverless` is keyed by adapter (exactly one key) and needs a real `url` + `secretToken` (runtime-required, type-optional); see `docs-site/guides/serverless-deploy.md`; `polling` also takes `dropPendingUpdates?`; `raw`/`test` take `{}` or nothing |
| `mediaRoots`            | `string[] \| null`                | `null` (off) | Non-empty entries; empty jail off    |
| `botConfig`             | `object`                          | _none_    | Passed through                          |
| `autoRetry`             | `boolean`                         | `true`    | `false` disables automatic retries      |
| `autoRetryOptions`      | `object`                          | `{}`      | `maxRetryAttempts` positive             |
| `rateLimit`             | `{windowMs, max}`                 | off       | Both positive numbers                   |
| `throttle`              | `object`                          | off       | Passed through                          |
| `updateTimeoutMs`       | `number`                          | `30000`   | Non-negative                            |
| `skipDuplicateUpdate`   | `boolean`                         | `false`   | `true` drops repeated updates           |
| `maxTextLength`         | `number`                          | `0`       | Non-negative; `0` means no limit        |
| `statusServerPort`      | `number`                          | _none_    | `0`-`65535`                              |
| `statusServerHostname`  | `string`                          | `127.0.0.1` | Non-empty                             |
| `optionsPage`           | `{shortCallbackQueryData?}`       | flag off  | Boolean when present                    |

<Note>
  These scalar fields apply in every deploy mode. The five instance and ref
  slots are described in the `instanceof` table above. `serverless` and `test`
  add no different scalar rules; their deploy-specific options are covered in
  [Serverless deploy](/guides/serverless-deploy) and
  [gramstax build](/guides/gramstax-build).
</Note>

### The update queue (`queue?` on `polling` and `webhook`)

Both branches accept the same `queue` object, and both configure the same
class (`UpdateQueue`), each mode keeping its own instance, so the two never
contend. Fields: `{enabled?, maxQueueSize?, workerCount?, perChatConcurrency?,
blockWhenFull?, enqueueTimeoutMs?, waiterTimeoutMs?, drainTimeoutMs?}`.

| Field | Default | Effect |
| --- | --- | --- |
| `enabled` | `false` | Opt-in. Both modes drain strictly sequentially with the queue absent or `enabled: false`. |
| `maxQueueSize` | `5000` | Bounded queue capacity. |
| `workerCount` | `8` | Concurrent in-process async drain loops (not OS threads). |
| `perChatConcurrency` | `1` | `1` preserves ordering per chat; `0` disables the per-chat gate. |
| `blockWhenFull` | `true` | `true` = the producer waits. `false` applies to webhook, which replies HTTP 429. Polling has no drop path and always waits. |
| `enqueueTimeoutMs` | `10000` | How long a blocking producer waits for a free slot before failing (429 / dropped). |
| `waiterTimeoutMs` | `30000` | How long a worker waits for a per-chat slot before bypassing the gate. |
| `drainTimeoutMs` | `10000` | How long `stop()` waits for in-flight handlers before giving up on the drain. |

Reading live state: `getWebhookQueueStats()` and `getPollingQueueStats()` each
return `null` while their queue is disabled.

`packages/gramstax/bench/bench.ts` compares the two modes. k6 drives a
`MockTelegramServer` in its own process, and the mock forwards each update to the
bot. The queue is neutral below saturation; the difference appears when the
arrival rate exceeds what one handler at a time can drain. Run the benchmark on
your own host rather than trusting a number from another machine, because the
repository does not commit a result table.

## `--watch`

Watches `src` (ignored until the first change) and restarts on edit: it stops
the old instance, re-imports the bot module and constructs a fresh instance.
Boot errors during a restart print and keep watching.

## Troubleshooting: `no Gramstax subclass export` for a correct `BotCore`

Symptom: `gramstax start` throws `no Gramstax subclass export found in
<bot-file>` even though `src/core/bot.ts` clearly exports
`class BotCore extends Gramstax`, and the error also names the CLI's own
gramstax entry. Cause: TWO `gramstax` copies: the bot file loaded one copy
(e.g. a repo-root `tsconfig` `paths` entry redirecting `gramstax` to
`packages/gramstax/src/index.ts`) while the CLI runs from another (the built
`dist` entry), so `prototype instanceof Gramstax` compares across copies and
fails. Fix: make the bot file resolve to the same `dist` copy the CLI uses:
remove any `gramstax` → `src` mapping from the active `tsconfig` `paths`
(scaffolded projects already strip these mappings at generation, so a
registry-installed `gramstax` in `node_modules` wins) and re-run.

## Implementation map

- `packages/gramstax/src/cli/start.ts`: `GramstaxStart.run(argv, cwd)` / `boot(argv, cwd)`
- `packages/gramstax/src/cli/config.ts`: `IGramstaxConfig` plus the `GramstaxConfig` alias, loader, strict validation, `CONFIG_OVERRIDE_SLOTS`
- `packages/gramstax/src/cli/gramstax.ts`: `start` command wiring (`--deploy`/`--watch`)
- `packages/gramstax/src/cli/build.ts`: R3a workers guardrail warning only
