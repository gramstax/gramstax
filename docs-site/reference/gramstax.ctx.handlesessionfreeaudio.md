

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFreeAudio](./gramstax.ctx.handlesessionfreeaudio.md)

## Ctx.handleSessionFreeAudio() method

Optional `handleSessionFreeAudio` route handler declaration.

**Signature:**

```typescript
handleSessionFreeAudio?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `audio` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionFreeAudio()](./gramstax.ctx.setsessionfreeaudio.md) which wires [Ctx.methodSessionFreeAudio()](./gramstax.ctx.methodsessionfreeaudio.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleFreeAudio()](./gramstax.ctx.handlefreeaudio.md) instead.

