

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [replyFallbackText](./gramstax.ctx.replyfallbacktext.md)

## Ctx.replyFallbackText() method

Best-effort fallback-text reply; never throws (nested failures are ignored).

**Signature:**

```typescript
replyFallbackText(): Promise<Message | undefined>;
```
**Returns:**

Promise&lt;Message \| undefined&gt;

The fallback message, or `undefined` when the fallback reply also failed.

## Remarks

A nested fallback failure is logged via `log.warn` (null-safe) and reported as `undefined` — the outer send already recorded the primary error, so this warn only marks the last-resort delivery loss.

