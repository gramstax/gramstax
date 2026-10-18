---
title: "Ctx.handleSessionCommandCaptionPhoto()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCommandCaptionPhoto](./gramstax.ctx.handlesessioncommandcaptionphoto.md)

## Ctx.handleSessionCommandCaptionPhoto() method

Optional `handleSessionCommandCaptionPhoto` route handler declaration.

**Signature:**

```typescript
handleSessionCommandCaptionPhoto?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `photo` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCommandCaptionPhoto()](./gramstax.ctx.setsessioncommandcaptionphoto.md) which wires [Ctx.methodSessionCommandCaptionPhoto()](./gramstax.ctx.methodsessioncommandcaptionphoto.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCommandCaptionPhoto()](./gramstax.ctx.handlecommandcaptionphoto.md) instead.

