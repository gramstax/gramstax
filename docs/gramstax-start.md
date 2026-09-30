# `gramstax start`

Boot a polling/webhook bot from `gramstax.config.ts` alone — no `src/index.ts`.
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
import {Gramstax} from `gramstax`

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
mirroring `ITGramstaxParams.token`). The scaffold writes
`token: process.env.TELEGRAM_BOT_TOKEN ?? ``` — `start` boots from
`config.token` and a missing/empty value throws the constructor message
verbatim:

```text
Token is not valid or empty
```

Load accepts `token` as any string including `""` (so env-less
`gramstax build` keeps working when `TELEGRAM_BOT_TOKEN` is unset);
only `start` enforces non-empty. Same pass-through rule for
`webhookSecretToken` → `webhookSecretToken`. Never commit real
token/secret values; keep them in `.env` (see `.env.example`). The
framework cannot distinguish a literal from an env-derived value, so no
warning is possible — the caution above is the whole guardrail.

## Path-ref form

INSTANCE slots accept a bare string (default export, zero args) or
`{module, export?, args?}` (named export, spread args). Paths resolve relative
to the project root (cwd).

```ts
import type {GramstaxConfig} from "gramstax"

const config: GramstaxConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN ?? ``,
  cacheSession: `./src/cache.ts`,
  templateManager: {module: `./src/templates.ts`, export: `SharedManager`, args: []},
  log: {module: `./src/helpers/log.ts`, export: `LogHe`}
}

export default config
```

The annotated `: GramstaxConfig` type (an alias of `ITGramstaxConfig`)
typo-checks every key. The scaffolded `gramstax.config.ts`
(`packages/create-gramstax/src/templates/gramstax.config.ts`) lists all
23 keys and is the canonical full listing.

A ref resolving to an already-built instance (like the `LogHe` singleton) is
used directly. Anything else is constructed with `new Export(...args)`.

## `instanceof` rules

Every materialized slot is checked against its expected base. Failures throw
naming the slot plus the base:

```text
gramstax start: invalid `cacheSession` from ./src/cache.ts#NotACache — expected instance of CacheExternal
```

| Slot              | Expected base    | Builtin params form (no `module` key)              |
| ----------------- | ---------------- | -------------------------------------------------- |
| `cacheSession`    | `CacheExternal`  | `{store, ttlMs?, namespace?}` → `new CacheExternal(store, ttlMs, namespace)` |
| `cacheKeyboard`   | `Map`            | entries array or plain object → `new Map(...)`     |
| `templateManager` | `TemplateManager`| `ITTemplateOptions` (`path` required)              |
| `log`             | `LoggingHelper`  | `true` → default logger, `false`/omitted → silent, options → `new LoggingHelper(opts)` |
| `sessionLock`     | — (scalars)      | `{enabled?, leaseMs?, onContended?, key?}` where `key` is a path-ref to a `(ctx) => string` factory |

`manifest` is NOT a config field — unknown fields (including `manifest`) throw
`Invalid gramstax config`.

## Start-only resolution

Path-ref IMPORT happens only in `gramstax start`, never in `gramstax build`.
Builds stay static: when the config carries any override slot and the target
set includes `cloudflare-workers` (or no `--target`), `gramstax build` prints a
non-blocking warning per slot and keeps emitting:

```text
gramstax build: custom `cacheSession` ignored on cloudflare-workers (edge boots from frozen manifest output)
```

## Field reference

Scalar rules mirror the constructor `_validateConfig` where they exist;
violations throw `Invalid gramstax config at <file>: ...` naming the field.

| Field                   | Type                              | Default   | Rule                                    |
| ----------------------- | --------------------------------- | --------- | --------------------------------------- |
| `token`                 | `string`                          | —         | Any string incl. `""` at load; non-empty required for start |
| `deploy`                | `"polling" \| "webhook" \| "serverless" \| "raw" \| "test"` | `polling` | Bare literal; `--deploy` wins           |
| `optionsDeploy`         | `{adapter?, name?, url?}`             | —         | `webhook` needs `url`; `serverless` needs `adapter` + real `url`; `polling`/`raw`/`test` take `{}` or nothing |
| `mediaRoots`            | `string[] \| null`                | —         | Non-empty entries; empty jail off       |
| `botConfig`             | `object`                          | —         | Passed through                          |
| `webhookQueue`          | `object`                          | —         | `maxQueueSize`/`workerCount` positive, `enqueueTimeoutMs` non-negative |
| `autoRetry`             | `boolean`                         | —         | Passed through                          |
| `autoRetryOptions`      | `object`                          | —         | `maxRetryAttempts` positive             |
| `rateLimit`             | `{windowMs, max}`                 | —         | Both positive numbers                   |
| `throttle`              | `object`                          | —         | Passed through                          |
| `updateTimeoutMs`       | `number`                          | —         | Non-negative                            |
| `skipDuplicateUpdate`   | `boolean`                         | —         | Passed through                          |
| `webhookSecretToken`    | `string`                          | —         | Any string; passed straight through     |
| `maxTextLength`         | `number`                          | —         | Non-negative                            |
| `statusServerPort`      | `number`                          | —         | `0`–`65535`                             |
| `statusServerHostname`  | `string`                          | —         | Non-empty                               |
| `pollingMaxRetries`     | `number`                          | —         | `-1` or non-negative                    |
| `optionsPage`           | `{shortCallbackQueryData?}`       | —         | Boolean when present                    |

Scope: `polling` plus `webhook` (`serverless`/`test` behave exactly as the
constructor does today — no special-casing). `optionsDeploy`
(`adapter`/`name`/`url`), polling/webhook/test/raw sections, and real lambda fields
are unchanged; see `docs/gramstax-build.md` and `docs/serverless-deploy.md`.
Paths follow the `src/pages` + `.gramstax/` convention (no path knobs).

## `--watch`

Watches `src` (ignored until first change) and reboots on edit: stops the old
instance, then boots again with cache-busted imports. Boot errors during a
restart print and keep watching.

## Troubleshooting: `no Gramstax subclass export` for a correct `BotCore`

Symptom: `gramstax start` throws `no Gramstax subclass export found in
<bot-file>` even though `src/core/bot.ts` clearly exports
`class BotCore extends Gramstax`, and the error now also names the CLI's own
gramstax entry. Cause: TWO `gramstax` copies — the bot file loaded one copy
(e.g. a repo-root `tsconfig` `paths` entry redirecting `gramstax` to
`packages/gramstax/src/index.ts`) while the CLI runs from another (the built
`dist` entry), so `prototype instanceof Gramstax` compares across copies and
fails. Fix: make the bot file resolve to the same `dist` copy the CLI uses —
remove any `gramstax` → `src` mapping from the active `tsconfig` `paths`
(scaffolded projects already strip these mappings at generation, so a
registry-installed `gramstax` in `node_modules` wins) and re-run.

## Implementation map

- `packages/gramstax/src/cli/start.ts` — `GramstaxStart.run(argv, cwd)` / `boot(argv, cwd)`
- `packages/gramstax/src/cli/config.ts` — `ITGramstaxConfig` plus the `GramstaxConfig` alias, loader, strict validation, `CONFIG_OVERRIDE_SLOTS`
- `packages/gramstax/src/cli/gramstax.ts` — `start` command wiring (`--deploy`/`--watch`)
- `packages/gramstax/src/cli/build.ts` — R3a workers guardrail warning only
