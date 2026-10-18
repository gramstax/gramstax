---
title: "Ctx.handleSessionCommandCaptionArgsAnimation()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCommandCaptionArgsAnimation](./gramstax.ctx.handlesessioncommandcaptionargsanimation.md)

## Ctx.handleSessionCommandCaptionArgsAnimation() method

Optional `handleSessionCommandCaptionArgsAnimation` route handler declaration.

**Signature:**

```typescript
handleSessionCommandCaptionArgsAnimation?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `animation` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCommandCaptionArgsAnimation()](./gramstax.ctx.setsessioncommandcaptionargsanimation.md) which wires [Ctx.methodSessionCommandCaptionArgsAnimation()](./gramstax.ctx.methodsessioncommandcaptionargsanimation.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCommandCaptionArgsAnimation()](./gramstax.ctx.handlecommandcaptionargsanimation.md) instead.

