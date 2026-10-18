---
title: "Ctx.handleSessionCaptionArgsAnimation()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCaptionArgsAnimation](./gramstax.ctx.handlesessioncaptionargsanimation.md)

## Ctx.handleSessionCaptionArgsAnimation() method

Optional `handleSessionCaptionArgsAnimation` route handler declaration.

**Signature:**

```typescript
handleSessionCaptionArgsAnimation?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `animation` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCaptionArgsAnimation()](./gramstax.ctx.setsessioncaptionargsanimation.md) which wires [Ctx.methodSessionCaptionArgsAnimation()](./gramstax.ctx.methodsessioncaptionargsanimation.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCaptionArgsAnimation()](./gramstax.ctx.handlecaptionargsanimation.md) instead.

