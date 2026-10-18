

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRateLimitOptions](./gramstax.iratelimitoptions.md)

## IRateLimitOptions type

Rate-limit configuration for incoming updates (`@grammyjs/ratelimiter`).

**Signature:**

```typescript
type IRateLimitOptions = {
    windowMs: number;
    max: number;
};
```

## Remarks

Configuration only — the rate-limit key and the behavior when the limit is exceeded are provided by overriding the [Gramstax.hookKeyGenerator()](./gramstax.gramstax.hookkeygenerator.md) and [Gramstax.hookRateLimited()](./gramstax.gramstax.hookratelimited.md) class hooks. Mounted via `limit()` with `timeFrame: windowMs` and `limit: max`.

## Example


```typescript
rateLimit: {windowMs: 1000, max: 5}
```

