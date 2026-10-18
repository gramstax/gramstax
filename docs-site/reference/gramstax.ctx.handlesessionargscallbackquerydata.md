

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionArgsCallbackQueryData](./gramstax.ctx.handlesessionargscallbackquerydata.md)

## Ctx.handleSessionArgsCallbackQueryData() method

Optional `handleSessionArgsCallbackQueryData` route handler declaration.

**Signature:**

```typescript
handleSessionArgsCallbackQueryData?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `callbackquerydata` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionArgsCallbackQueryData()](./gramstax.ctx.setsessionargscallbackquerydata.md) which wires [Ctx.methodSessionArgsCallbackQueryData()](./gramstax.ctx.methodsessionargscallbackquerydata.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleArgsCallbackQueryData()](./gramstax.ctx.handleargscallbackquerydata.md) instead.

