

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCaptionPhoto](./gramstax.ctx.handlesessioncaptionphoto.md)

## Ctx.handleSessionCaptionPhoto() method

Optional `handleSessionCaptionPhoto` route handler declaration.

**Signature:**

```typescript
handleSessionCaptionPhoto?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `photo` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCaptionPhoto()](./gramstax.ctx.setsessioncaptionphoto.md) which wires [Ctx.methodSessionCaptionPhoto()](./gramstax.ctx.methodsessioncaptionphoto.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCaptionPhoto()](./gramstax.ctx.handlecaptionphoto.md) instead.

