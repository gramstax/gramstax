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

## Notes

- The status server starts in every mode; there is none in a deployed serverless entry, so `statusServerPort`/`statusServerHostname` are dropped there with a warning.
- `rateLimit` counts inbound updates; `throttle` shapes outbound API calls. They solve different problems — do not use one to compensate for the other.
- `hookKeyGenerator` returning `undefined` falls back to the default bucket. It cannot be async.
- Deployment topology belongs in `cacheSession`; pair a Redis store with `sessionLock`. See `cache-store.md`.
- `log` config accepts `true` (default logger), `false` (silent), an options object, or a `{override: {...}}` path-ref. Options that write to disk (`pathFile`, `force: 'file'|'all'`) are dropped from deployed entries. See `config-boot.md`.