# deploy-modes

Pick the mode with the config's `deploy`, then fill **exactly one** matching `optionsDeploy` branch. The colon grammar is gone.

## Why

Each mode wires a different startup path — polling loop, webhook server, serverless handler, nothing, in-process harness — and each branch of `optionsDeploy` is validated against the mode. That strictness is the point: a webhook deployment with no secret is a forged-request hole, and `deploy: 'webhook'` with the URL buried in a mode string is exactly the shape of bug this config shape removes. Getting branch/mode agreement wrong fails at boot with an explicit error rather than a silent misconfiguration.

## Modes

| `deploy` | Boots | Startup hooks | `optionsDeploy` branch |
| --- | --- | --- | --- |
| `polling` (default) | long-poll loop | `hookBeforeStart` → `hookAfterStart` | `{maxRetries?, queue?}` |
| `webhook` | HTTP server + queue | `hookBeforeStart` → `hookAfterStart` | `{url, secretToken, queue?}` — url and secretToken both mandatory |
| `serverless` | platform handler | `hookBeforeStart` → `hookAfterStart` | `{[adapter]: {url, secretToken, ...}}` — adapter is the KEY |
| `raw` | nothing (no pages, no auto-start) | `hookBeforeStart` only | `{}` |
| `test` | in-process harness | both, no network | `{}` |

`--deploy <mode>` on `gramstax start` overrides the config; there is no env-var override channel.

## The one-branch rule

- At most **one** branch may be non-empty. A branch counts as empty when every key is `undefined`.
- If one branch is non-empty it must equal `deploy`, else: `optionsDeploy branch 'webhook' does not match deploy 'polling'`.
- Zero branches is only legal for `polling`, `raw`, `test`.
- `raw` and `test` are `Record<string, never>` — any key throws.
- Unknown branch names and unknown fields inside a branch throw.

That is why the scaffolded config lists all five branches with `undefined` values: the keys are present, the branches are empty, and switching `deploy` to `webhook` means filling in *that* branch rather than adding a new key.

## Incorrect

```typescript
// removed colon grammar — throws
const config: GramstaxConfig = {
  deploy: `webhook:https://x/hook`
}
```

```typescript
// webhook branch without a secret: every request is unauthenticated
const config: GramstaxConfig = {
  deploy: `webhook`,
  optionsDeploy: {webhook: {url: `https://x/hook`}}
}
```

```typescript
// flat adapter field — the adapter IS the key
const config: GramstaxConfig = {
  deploy: `serverless`,
  optionsDeploy: {serverless: {adapter: `cloudflare-mod`, url: `https://x/hook`, secretToken: s}}
}
```

```typescript
// two live branches: which one is real?
const config: GramstaxConfig = {
  deploy: `polling`,
  optionsDeploy: {
    polling: {maxRetries: 3},
    webhook: {url: `https://x/hook`, secretToken: s}
  }
}
```

## Correct

```typescript
// webhook: url + secretToken both required
const config: GramstaxConfig = {
  deploy: `webhook`,
  optionsDeploy: {
    webhook: {
      url: `https://bot.example.com/hook`,
      secretToken: process.env.BOT_WEBHOOK_SECRET ?? `` // never a literal
    }
  }
}
```

```typescript
// serverless: adapter is the key, exactly one, and each key accepts only its own fields
const config: GramstaxConfig = {
  deploy: `serverless`,
  optionsDeploy: {
    serverless: {
      'cloudflare-mod': {
        name: `gramstax-worker`,
        url: `https://gramstax-worker.workers.dev/webhook`,
        secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``,
        compatibilityDate: `2026-01-01`,
        compatibilityFlags: [`nodejs_compat`]
      }
    }
  }
}
```

```typescript
// polling: nothing mandatory
const config: GramstaxConfig = {
  deploy: `polling`,
  optionsDeploy: {polling: {maxRetries: 5}}
}
```

## Serverless adapters

`serverless` is a union keyed by adapter. Supported: `cloudflare-mod`, `aws-lambda-async`.

| Key | Accepted fields |
| --- | --- |
| `cloudflare-mod` | `url`, `secretToken` (required) + `name`, `compatibilityDate`, `compatibilityFlags`, `toml` |
| `aws-lambda-async` | `url`, `secretToken` (required) only |

A field that does not apply to the chosen adapter is **rejected**, not ignored. `url` must be a real `https?://` value with no `<placeholder>`; `secretToken` must match `/^[A-Za-z0-9_-]{1,256}$/` — generate with `openssl rand -hex 32`.

`url` and `secretToken` are type-optional but runtime-required for `serverless`/`webhook`, so `process.env.X ?? ``` expressions typecheck while the loader and constructor still enforce presence. `toml` is flat-merged **last** into the emitted `wrangler.toml`, so it overrides every typed field.

## Secrets

`secretToken` has a duality that trips people up:

- The **config value** sets the webhook locally and during `gramstax start`.
- The **deployed entry reads the `BOT_WEBHOOK_SECRET` runtime binding**, never a baked value. Never emit it into a bundle or a `[vars]` entry.
- The value is never a literal in the config file — always an env expression.

`sessionLock` and `mediaRoots` are rejected for deployed entries with a build-time warning; see `deploy-build.md`.

## raw and test

```typescript
// raw: no pages, no templates, no routing, no auto-start — just a grammY Bot
const config: GramstaxConfig = {token, deploy: `raw`, optionsDeploy: {raw: {}}}
// then write raw grammY handlers on bot.bot and start it yourself
```

`raw` still enforces a non-empty token and still runs `hookBeforeStart`, but registers no listeners, loads no pages, and never starts. It is the right mode for a scheduled job that only needs `bot.bot.api`.

`test` is the e2e harness: updates go through `handleUpdate` in-process, no ports, no network. **e2e does not go through this config** — `e2e/setup.ts` constructs `BotCore` directly so it can inject `stream`/`autoRetry`. See `e2e-setup.md`.

## Notes

- Non-`raw` modes require a real `TemplateManager` instance — omit `templateManager` in config and the CLI builds one from `src/pages` for you.
- Invalid deploy strings throw: `must be one of polling, webhook, serverless, raw, test`.
- The status server (`statusServerPort`) starts in every mode except where noted; see `deploy-runtime.md`.
- `queue` on **either** the `polling` or the `webhook` branch tunes `UpdateQueue`: `{enabled?, maxQueueSize?, workerCount?, perChatConcurrency?, blockWhenFull?, enqueueTimeoutMs?, waiterTimeoutMs?, drainTimeoutMs?}`. One class, two independent instances — the two modes never contend. It is **opt-in** (`enabled` defaults to `false`): with the queue absent both modes drain strictly sequentially. Measured with `packages/gramstax/bench/bench.ts`: at a 600 users/s target the sequential drain managed 377 users/s at p95 1828 ms versus 601 users/s at p95 124 ms with the queue.
- `optionsDeploy.polling.maxRetries` semantics: `-1` retries forever, default `5`.
- Serverless build/deploy chain: `deploy-build.md`.