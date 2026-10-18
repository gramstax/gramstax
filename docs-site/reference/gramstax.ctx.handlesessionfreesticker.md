

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFreeSticker](./gramstax.ctx.handlesessionfreesticker.md)

## Ctx.handleSessionFreeSticker() method

Optional `handleSessionFreeSticker` route handler declaration.

**Signature:**

```typescript
handleSessionFreeSticker?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `sticker` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionFreeSticker()](./gramstax.ctx.setsessionfreesticker.md) which wires [Ctx.methodSessionFreeSticker()](./gramstax.ctx.methodsessionfreesticker.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleFreeSticker()](./gramstax.ctx.handlefreesticker.md) instead.

