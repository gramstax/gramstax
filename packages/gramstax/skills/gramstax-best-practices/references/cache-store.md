# cache-store

Back sessions with `CacheExternal`: `memory` for single-instance, Redis URL for multi-instance, `forceStore` for tests.

## Why

The default in-memory session cache silently forks state the moment a second instance appears — users bounce between servers and lose sessions. Declaring the store up front makes the deployment topology explicit and testable.

## Incorrect

```typescript
// works until the second replica appears — then sessions randomly vanish
const bot = new Gramstax({token, deploy: `webhook:url`, templateManager, log: false})
```

## Correct

```typescript
import {CacheExternal} from "gramstax"

const bot = new Gramstax({
  token,
  deploy: `webhook:url`,
  templateManager,
  log: false,
  cacheSession: new CacheExternal(`redis://localhost:6379`, 3600000, `sess`),
  cacheKeyboard: new CacheExternal(`memory`)
})
```

```typescript
// tests: inject a Map, never a server
const cacheSession = new CacheExternal(`memory`, undefined, undefined, {forceStore: new Map()})
await cacheSession.clear() // reset between cases
```

## Notes

- Signature: `new CacheExternal(url, ttlMs?, namespace?, {forceStore?})`; unknown URLs throw unless `forceStore` is given.
- `ttl` is milliseconds; `namespace` isolates keys per purpose.
- Pair a Redis store with `sessionLock` so concurrent updates for one user serialize (see `deploy-runtime.md`).
