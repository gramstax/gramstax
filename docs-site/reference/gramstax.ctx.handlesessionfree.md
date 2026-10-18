

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFree](./gramstax.ctx.handlesessionfree.md)

## Ctx.handleSessionFree() method

Optional `handleSessionFree` route handler declaration.

**Signature:**

```typescript
handleSessionFree?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed for updates not matched by a specific `handleSession*` route while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — activated via the matching `setSession*` helper which wires the `methodSession*` key — and dispatches this handler through `new Page(ctx)`. When no session is active, updates fall through to the non-session fallback [Ctx.handleFree()](./gramstax.ctx.handlefree.md).

