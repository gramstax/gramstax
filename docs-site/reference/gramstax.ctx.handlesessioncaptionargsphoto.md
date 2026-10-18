---
title: "Ctx.handleSessionCaptionArgsPhoto()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCaptionArgsPhoto](./gramstax.ctx.handlesessioncaptionargsphoto.md)

## Ctx.handleSessionCaptionArgsPhoto() method

Optional `handleSessionCaptionArgsPhoto` route handler declaration.

**Signature:**

```typescript
handleSessionCaptionArgsPhoto?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `photo` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCaptionArgsPhoto()](./gramstax.ctx.setsessioncaptionargsphoto.md) which wires [Ctx.methodSessionCaptionArgsPhoto()](./gramstax.ctx.methodsessioncaptionargsphoto.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCaptionArgsPhoto()](./gramstax.ctx.handlecaptionargsphoto.md) instead.

