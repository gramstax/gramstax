---
title: "ADR-0003: Unified keyv and Redis Cache via CacheExternal"
description: Why sessions and keyboards share one keyv-based CacheExternal with memory, Redis, and custom store modes instead of two storage paths.
icon: database
---

# ADR-0003: Unified keyv / Redis cache via `CacheExternal`

<Info>
  **Status:** Accepted

  **Date:** 2025 (inferred from package history)
</Info>

## Context

The framework needs session storage (per-user state across updates) and keyboard caching (per-language layouts). In development a process-local store is enough; in production, sessions must survive restarts and be shared across instances. Introducing two storage code paths would duplicate logic and complicate the public API.

## Decision

Provide a single cache abstraction: `CacheExternal<V>` **extends `keyv`** (`src/cache/external.ts:55`). Storage mode is chosen by the constructor `url`/`more` arguments:

- `url === "memory"` → an in-memory `Map` (default).
- `url.startsWith("redis")` → `@keyv/redis` adapter.
- `more.forceStore` → a custom store.

`Gramstax.cacheSession` and `Ctx`-level session reads/writes go through this object. `cacheKeyboard` is a plain `Map` for in-process keyboard reuse.

<Note>
  Two limits follow from the store choice: `@keyv/redis` is only loaded when
  `url` starts with `redis`, and `refreshLruCache()` only operates on the memory
  `Map` store.
</Note>

## Consequences

### Benefits

- One interface (`keyv`) for dev (memory) and prod (Redis) sessions.
- `CacheExternal` is itself a reusable, separately-documented class.
- Namespacing + TTL are inherited from `keyv`.

### Trade-offs

- Redis mode adds the `@keyv/redis` dependency (only loaded when `url` starts with `redis`).
- `refreshLruCache()` only operates on the memory `Map` store, not Redis.

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| Raw `Map` only | No persistence/sharing across restarts or instances. |
| Direct Redis client | Tighter coupling; loses the `keyv` namespace/TTL ergonomics. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Code | `src/cache/external.ts:55`: `export class CacheExternal<V = any> extends Keyv<V>` |
| Code | `src/cache/external.ts:64-76`: mode selection (`memory`/`redis`/`forceStore`) |
| Code | `src/core/bot.ts:84`: `cacheSession: CacheExternal<ITCacheRpc>` |
| Dependency | `package.json`: `"keyv": "^5.5.4"`, `"@keyv/redis": "^5.1.4"` |

## Related

- [Architecture](../architecture.md): Components: CacheExternal
- [ADR-0008](/guides/adr/0008-lint-export-dep-conventions.md): dependency-minimalism
