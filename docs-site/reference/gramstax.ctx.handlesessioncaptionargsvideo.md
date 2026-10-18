---
title: "Ctx.handleSessionCaptionArgsVideo()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCaptionArgsVideo](./gramstax.ctx.handlesessioncaptionargsvideo.md)

## Ctx.handleSessionCaptionArgsVideo() method

Optional `handleSessionCaptionArgsVideo` route handler declaration.

**Signature:**

```typescript
handleSessionCaptionArgsVideo?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `video` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCaptionArgsVideo()](./gramstax.ctx.setsessioncaptionargsvideo.md) which wires [Ctx.methodSessionCaptionArgsVideo()](./gramstax.ctx.methodsessioncaptionargsvideo.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCaptionArgsVideo()](./gramstax.ctx.handlecaptionargsvideo.md) instead.

