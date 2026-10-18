

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFreeText](./gramstax.ctx.handlesessionfreetext.md)

## Ctx.handleSessionFreeText() method

Optional `handleSessionFreeText` route handler declaration.

**Signature:**

```typescript
handleSessionFreeText?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `text` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionFreeText()](./gramstax.ctx.setsessionfreetext.md) which wires [Ctx.methodSessionFreeText()](./gramstax.ctx.methodsessionfreetext.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleFreeText()](./gramstax.ctx.handlefreetext.md) instead.

