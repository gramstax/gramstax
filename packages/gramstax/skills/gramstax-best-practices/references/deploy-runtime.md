# deploy-runtime

Guard production traffic (rate limits, throttling, session lock) and observe it (status server).

## Why

Telegram enforces per-bot rate limits — one viral hour without throttling means 429s and dropped updates. Concurrent updates for the same user race session state unless serialized. An operator-blind bot cannot be paged.

## Incorrect

```typescript
// naked bot: no inbound guard, no outgoing throttle, concurrent same-user
// updates race, no health endpoint
const bot = new Gramstax({token, deploy: `webhook:https://x/hook`, templateManager, log: false})
```

## Correct

```typescript
const bot = new Gramstax({
  token,
  deploy: `webhook:https://x/hook`,
  templateManager,
  log: false,
  rateLimit: {windowMs: 1000, max: 5}, // inbound: @grammyjs/ratelimiter
  throttle: {global: 30}, // outbound: @grammyjs/transformer-throttler
  sessionLock: {leaseMs: 5000, onContended: `serialize`}, // Redis-backed
  statusServerPort: 3001 // GET /health, /stats, /metrics
})
```

## Notes

- `hookRateLimited(ctx)` decides dropped-update behavior (ctx.render works); `hookKeyGenerator(ctx)` must be synchronous (defaults to sender id).
- `sessionLock` is Redis-only and off by default; memory store auto-disables with a warning. Contention: `skip` (drop, counted), `wait` (retry), `serialize` (queue per key).
- `GET /metrics` emits Prometheus text; `onTrace` fires an OTel-style span per routed update.
