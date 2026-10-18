

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxCacheSessionRef](./gramstax.igramstaxcachesessionref.md)

## IGramstaxCacheSessionRef type

`cacheSession` slot: a path-ref to a `CacheExternal` subclass, or builtin params mirrored from the real constructor `(store, ttlMs, namespace?)`.

**Signature:**

```typescript
type IGramstaxCacheSessionRef = IGramstaxPathRef | {
    store: string;
    ttlMs?: number;
    namespace?: string;
};
```
**References:** [IGramstaxPathRef](./gramstax.igramstaxpathref.md)

## Remarks

Three accepted shapes (enforced by the loader): - a module path string resolving to a `CacheExternal` subclass - an `{override: {module, export?, args?}}` ref resolving to a `CacheExternal` subclass - builtin params `{store, ttlMs?, namespace?}` passed to `new CacheExternal(params)`

## Example


```typescript
const fromPath: IGramstaxCacheSessionRef = `./src/session-cache.ts`
const builtin: IGramstaxCacheSessionRef = {store: `redis://localhost:6379`, ttlMs: 3600000}
```

