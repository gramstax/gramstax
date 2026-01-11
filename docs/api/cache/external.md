# CacheExternal

The `CacheExternal` class extends [Keyv](https://github.com/jaredwray/keyv) to provide a unified caching interface with built-in support for memory and Redis storage.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `CacheExternal` public API surface (constructor, inherited methods from Keyv).
> - **Storage modes:**
>   - **Memory mode:** when `url` is `"memory"` (default), uses an in-memory `Map`.
>   - **Redis mode:** when `url` starts with `"redis"`, uses `@keyv/redis` adapter.
>   - **Custom mode:** when `more.forceStore` is provided, uses the custom store.

&nbsp;

## Constructor

### `new CacheExternal(url?, namespace?, ttl?, more?)`

| parameter | type   | required | default    | description                          | ai_notes                                                               |
| --------- | ------ | -------- | ---------- | ------------------------------------ | ---------------------------------------------------------------------- |
| url       | string | no       | `"memory"` | Storage connection URL               | **Memory mode:** `"memory"`. **Redis mode:** `"redis://..."` format.   |
| namespace | string | no       | -          | Key namespace prefix                 | **Purpose:** isolate keys by namespace.                                |
| ttl       | number | no       | -          | Default time-to-live in milliseconds | **Scope:** applies to all keys unless overridden per operation.        |
| more      | IMore  | no       | -          | Additional Keyv options              | **forceStore:** overrides automatic store selection with custom store. |

```typescript
import { CacheExternal } from "gramstax";

// Memory cache (default)
const memoryCache = new CacheExternal();

// Redis cache
const redisCache = new CacheExternal(
  "redis://localhost:6379",
  "session",
  3600000
);

// With namespace and TTL
const cache = new CacheExternal("memory", "myapp", 60000);
```

&nbsp;

## Inherited Methods

`CacheExternal` inherits all methods from [Keyv](https://github.com/jaredwray/keyv):

### `.get(key)`

Get a value by key.

| parameter | type   | required | description |
| --------- | ------ | -------- | ----------- |
| key       | string | yes      | The key     |

- **returns: Promise\<any\>**

```typescript
const value = await cache.get("user:123");
```

### `.set(key, value, ttl?)`

Set a value with optional TTL.

| parameter | type   | required | default | description         |
| --------- | ------ | -------- | ------- | ------------------- |
| key       | string | yes      | -       | The key             |
| value     | any    | yes      | -       | The value to store  |
| ttl       | number | no       | -       | TTL in milliseconds |

- **returns: Promise\<boolean\>**

```typescript
await cache.set("user:123", { name: "John" }, 60000);
```

### `.delete(key)`

Delete a key.

| parameter | type   | required | description |
| --------- | ------ | -------- | ----------- |
| key       | string | yes      | The key     |

- **returns: Promise\<boolean\>**

```typescript
await cache.delete("user:123");
```

### `.clear()`

Clear all keys in the namespace.

- **returns: Promise\<void\>**

```typescript
await cache.clear();
```

### `.has(key)`

Check if a key exists.

| parameter | type   | required | description |
| --------- | ------ | -------- | ----------- |
| key       | string | yes      | The key     |

- **returns: Promise\<boolean\>**

```typescript
const exists = await cache.has("user:123");
```
