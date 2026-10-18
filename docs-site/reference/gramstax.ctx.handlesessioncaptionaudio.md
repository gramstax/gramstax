

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCaptionAudio](./gramstax.ctx.handlesessioncaptionaudio.md)

## Ctx.handleSessionCaptionAudio() method

Optional `handleSessionCaptionAudio` route handler declaration.

**Signature:**

```typescript
handleSessionCaptionAudio?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `audio` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCaptionAudio()](./gramstax.ctx.setsessioncaptionaudio.md) which wires [Ctx.methodSessionCaptionAudio()](./gramstax.ctx.methodsessioncaptionaudio.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCaptionAudio()](./gramstax.ctx.handlecaptionaudio.md) instead.

