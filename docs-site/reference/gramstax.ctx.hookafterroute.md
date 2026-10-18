

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [hookAfterRoute](./gramstax.ctx.hookafterroute.md)

## Ctx.hookAfterRoute() method

Page-level hook after a route handler execution.

**Signature:**

```typescript
/** @virtual */
hookAfterRoute?(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

## Remarks

Always runs after the handler returns (even when the handler returns undefined / null). Ideal for cleanup, analytics, or chained side effects.

Useful for: - Recording page visit timestamps - Auto-clearing stale session data - Firing post-processing jobs

## Example


```typescript
// Notify admins of high-value actions
async hookAfterRoute() {
  if (this.temp.session?.params.amount > 10000) {
    await this.api.sendMessage(ADMIN_CHAT_ID, `Large withdrawal: ${this.temp.session.amount}`)
  }
}
```

