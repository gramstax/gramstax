# cache-store

Back sessions with `cacheSession`: `memory` for single-instance, a Redis store for multi-instance, `forceStore` for tests. Configure it in `gramstax.config.ts`.

## Why

The default in-memory session cache silently forks state the moment a second instance appears — users bounce between servers and lose sessions. Declaring the store as config data makes the deployment topology explicit and keeps it reviewable in one place.

## Incorrect

```typescript
// works until the second replica appears — then sessions randomly vanish
const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: `webhook`,
  optionsDeploy: {webhook: {url: `https://x/hook`, secretToken: process.env.BOT_WEBHOOK_SECRET ?? ``}}
  // no cacheSession at all
}
```

```typescript
// instance passed through config — the config file holds DATA and REFS, not instances
import {CacheExternal} from "gramstax"

const config: GramstaxConfig = {
  cacheSession: new CacheExternal(`redis://localhost:6379`)
}
```

## Correct

```typescript
// gramstax.config.ts — builtin form, CLI constructs the CacheExternal for you
const config: GramstaxConfig = {
  token: process.env.BOT_TOKEN ?? ``,
  deploy: process.env.BOT_DEPLOY ?? `polling`,
  cacheSession: {
    store: process.env.CACHE_SESSION_STORE ?? `memory`,
    ttlMs: 4 * 60 * 60 * 1000,
    namespace: `s`
  },
  cacheKeyboard: {store: `memory`}
}

export default config
```

```typescript
// path-ref form when the cache needs real construction (custom subclass,
// connection tuning, lifecycle): {override: {module, export, args}}
cacheSession: {override: {module: `./src/cache/session.ts`, export: `SessionCache`, args: []}}
```

```typescript
// tests: inject a Map, never a server
const cacheSession = new CacheExternal(`memory`, undefined, undefined, {forceStore: new Map()})
await cacheSession.clear() // reset between cases
```

## The builtin form

| Slot | Field | Builtin constructor form |
| --- | --- | --- |
| `cacheSession` | `store` | `{store, ttlMs?, namespace?}` → `new CacheExternal(store, ttlMs, namespace)` |
| `cacheKeyboard` | entries array or plain object | → `new Map(...)` |

The CLI materializes each slot and `instanceof`-checks it; a mismatch throws naming the slot and the expected base.

## Notes

- `new CacheExternal(url, ttlMs?, namespace?, {forceStore?})`; unknown URLs throw unless `forceStore` is given.
- `ttl` is **milliseconds**; `namespace` isolates keys per purpose so sessions and keyboards cannot collide.
- `CACHE_SESSION_STORE` accepts `memory` or `redis:<url>`. The `?? ` fallback is the default — nothing has to be set in `.env` for a single-instance bot. Set the var only when you outgrow the memory store.
- A ref resolving to an already-built instance is used as-is; anything else is constructed with `new Export(...args)`. See `config-boot.md` for the path-ref forms.
- Pair a Redis store with `sessionLock` so concurrent updates for one user serialize; a memory store auto-disables the lock with a warning. See `deploy-runtime.md`.
- Only the **builtin** form reaches a deployed serverless entry. A `cacheSession` path-ref is emitted as a static import and resolved by the bundler. See `deploy-build.md`.