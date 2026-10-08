# deploy-runtime

Guard production traffic (`rateLimit`, `throttle`, `sessionLock`) and observe it (`statusServerPort`) — as `gramstax.config.ts` fields, not constructor arguments.

## Why

Telegram enforces per-bot rate limits — one viral hour without throttling means 429s and dropped updates. Concurrent updates for the same user race session state unless serialized. An operator-blind bot cannot be paged. These are top-level config fields in v2.2.0, so a production deployment that omits them fails open, not loudly.

## Incorrect

```typescript
// constructor form — removed in v2.2.0; nothing reads this
const bot = new Gramstax({token, deploy: `webhook:https://x/hook`, templateManager, rateLimit, log: false})
```

```typescript
// config that boots but guards nothing: no inbound limit, no outgoing
// throttle, concurrent same-user updates race, no health endpoint
const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `webhook`,
  optionsDeploy: {webhook: {url: `https://bot.example.com/hook`, secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``}}
}
```

## Correct

```typescript
const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `webhook`,
  optionsDeploy: {
    webhook: {
      url: `https://bot.example.com/hook`,
      secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``
    }
  },
  rateLimit: {windowMs: 1000, max: 5}, // inbound: @grammyjs/ratelimiter
  throttle: {global: 30}, // outbound: @grammyjs/transformer-throttler
  sessionLock: {enabled: true, leaseMs: 5000, onContended: `serialize`}, // Redis-backed
  statusServerPort: 3001, // GET /health, /stats, /metrics
  statusServerHostname: `127.0.0.1` // default; set explicitly if exposed
}
```

```typescript
// Redis session lock keyed per-tenant instead of per-user
sessionLock: {
  enabled: true,
  leaseMs: 5000,
  onContended: `serialize`,
  key: {override: {module: `./src/helpers/lock-key.ts`, export: `tenantKey`}}
}
```

`key` is the one `sessionLock` path-ref: it resolves to a `(ctx) => string` factory. It must not be a class, and it takes no `args`.

## Fields

| Field | Shape | Notes |
| --- | --- | --- |
| `rateLimit` | `{windowMs, max}` | both must be positive; mounts `limit({timeFrame, limit})` |
| `throttle` | `APIThrottlerOptions` | mounts `apiThrottler`; composes with `autoRetry` |
| `sessionLock` | `{enabled?, leaseMs?, onContended?, key?}` | Redis-only; off by default |
| `statusServerPort` | `0`–`65535` | `0` disables |
| `statusServerHostname` | non-empty string | default `127.0.0.1` |
| `autoRetry` / `autoRetryOptions` | `boolean` / `{maxRetryAttempts?, retryOnInternalServerErrors?}` | `maxRetryAttempts` positive |
| `updateTimeoutMs` | non-negative | default `30000`; routes past it land in `timeout` state |
| `maxTextLength` | non-negative | `0` = unlimited |
| `skipDuplicateUpdate` | `boolean` | default `false` |

## Behavior hooks

```typescript
export class BotCore extends Gramstax {
  // EXCEPTION to the render* rule: this hook runs on a bare ctx with no page
  // loaded, so there is no template to resolve a block from.
  async hookRateLimited(ctx: CtxCore) {
    await ctx.answerCallbackQuery({text: `Slow down`}) // default is a silent drop
  }

  hookKeyGenerator(ctx: CtxCore) {
    return `${ctx.from?.id}` // MUST be synchronous; defaults to sender id
  }
}
```

`hookRateLimited` is the one place raw grammY is correct. It is invoked from the `onLimitExceeded` middleware with `getRateCtx(raw)` — a fresh `createCtx(raw)` whose `data` is `undefined` (`sendPageName()` returns `unknown`). Every `render*` method resolves its text from a **page** template via `this.data.name`, so `renderCallbackAnswer` here would look up a template literally named `undefined` and resolve to an empty string. Use the raw grammY method for pre-page, bot-level replies; use `render*` everywhere else.

`sessionLock` contention modes:

| `onContended` | Effect |
| --- | --- |
| `skip` | drop the update (counted in `metrics.blocked`) |
| `wait` | retry after the lease expires |
| `serialize` | queue per key |

`sessionLock` requires a Redis client over TCP, so it is **dropped from deployed serverless entries** with a build-time warning. It is also auto-disabled with a warning when the session store is in-memory — a memory store has nothing to coordinate across.

## Observability

`GET /metrics` emits Prometheus exposition text (per-listener counters, cumulative totals, latency avg/max, uptime, queue stats). `hookTrace` fires an OTel-style span after every routed update.

Careful when reading `metrics.counts.blocked`: it counts **session-lock contention** and **bot-level `hookBeforeRoute` denials** only. A page-level gate denial does not increment it — see `route-hooks.md`.

## Update queue (polling and webhook)

`optionsDeploy.polling.queue` and `optionsDeploy.webhook.queue` configure the **same** class — `UpdateQueue` (`src/update/queue.ts`) — one independent instance per mode, so the two never contend. `WebhookQueue` and `IWebhookQueueConfig` remain as deprecated aliases in the public barrel; do not remove them.

| Field | Default | Effect |
| --- | --- | --- |
| `enabled` | `false` | Opt-in. Absent or `false`, both modes drain strictly sequentially — polling is unchanged from before the queue existed. |
| `maxQueueSize` | `5000` | Bounded queue capacity. |
| `workerCount` | `8` | Concurrent in-process async drain loops (not OS threads). |
| `perChatConcurrency` | `1` | `1` preserves ordering per chat; `0` disables the per-chat gate. |
| `blockWhenFull` | `true` | `true` = the producer waits; `false` = webhook replies HTTP 429, polling drops the update. |
| `enqueueTimeoutMs` | `10000` | How long a blocking producer waits for a free slot before failing (429 / dropped). |
| `waiterTimeoutMs` | `30000` | How long a worker waits for a per-chat slot before bypassing the gate. |
| `drainTimeoutMs` | `10000` | How long `stop()` waits for in-flight handlers before giving up on the drain. |

Defaults are identical for both branches — they are read from the same literals in `core/bot.ts`.

Why opt-in: measured with `packages/gramstax/bench/bench.ts`, the queue is neutral below saturation but holds p95 flat past it — at a 600 users/s target, sequential managed 377 users/s at p95 1828 ms while the queue sustained 601 users/s at p95 124 ms. A default flip would tax every bot that never needed it.

How each mode reaches the sink differs, which matters when you read a delivery guarantee:

- **Webhook** wraps `handleUpdate` in the HTTP handler, so many concurrent POSTs keep the pool saturated. `blockWhenFull: false` answers HTTP 429.
- **Polling** replaces `bot.handleUpdate` — grammY keeps owning the `getUpdates` loop and the `offset`, and `handleUpdates` calls the replaced method. A middleware would not work: `Composer.use` appends to the end of the chain and gramstax's routing middleware is terminal. Because grammY advances `offset` when the update is *buffered*, delivery is **at-least-once at the enqueue boundary** — a crash re-delivers whatever Telegram had not yet handed over, while an update dropped by `blockWhenFull: false` is lost.

Live state: `getWebhookQueueStats()` and `getPollingQueueStats()` each return `null` while their queue is disabled. `stop()` drains both dispatchers before `templateManager.destroy()`; a drain that times out is counted in `metrics.counts.dropped` and logged.

## Notes

- The status server starts in every mode; there is none in a deployed serverless entry, so `statusServerPort`/`statusServerHostname` are dropped there with a warning.
- `rateLimit` counts inbound updates; `throttle` shapes outbound API calls. They solve different problems — do not use one to compensate for the other.
- `hookKeyGenerator` returning `undefined` falls back to the default bucket. It cannot be async.
- Deployment topology belongs in `cacheSession`; pair a Redis store with `sessionLock`. See `cache-store.md`.
- `log` config accepts `true` (default logger), `false` (silent), an options object, or a `{override: {...}}` path-ref. Options that write to disk (`pathFile`, `force: 'file'|'all'`) are dropped from deployed entries. See `config-boot.md`.