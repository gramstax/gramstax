

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFreeVideoNote](./gramstax.ctx.handlesessionfreevideonote.md)

## Ctx.handleSessionFreeVideoNote() method

Optional `handleSessionFreeVideoNote` route handler declaration.

**Signature:**

```typescript
handleSessionFreeVideoNote?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `videonote` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionFreeVideoNote()](./gramstax.ctx.setsessionfreevideonote.md) which wires [Ctx.methodSessionFreeVideoNote()](./gramstax.ctx.methodsessionfreevideonote.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleFreeVideoNote()](./gramstax.ctx.handlefreevideonote.md) instead.

