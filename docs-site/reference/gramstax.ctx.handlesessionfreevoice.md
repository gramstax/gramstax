

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFreeVoice](./gramstax.ctx.handlesessionfreevoice.md)

## Ctx.handleSessionFreeVoice() method

Optional `handleSessionFreeVoice` route handler declaration.

**Signature:**

```typescript
handleSessionFreeVoice?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `voice` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionFreeVoice()](./gramstax.ctx.setsessionfreevoice.md) which wires [Ctx.methodSessionFreeVoice()](./gramstax.ctx.methodsessionfreevoice.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleFreeVoice()](./gramstax.ctx.handlefreevoice.md) instead.

