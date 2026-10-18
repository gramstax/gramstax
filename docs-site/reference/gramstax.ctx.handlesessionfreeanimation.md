---
title: "Ctx.handleSessionFreeAnimation()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFreeAnimation](./gramstax.ctx.handlesessionfreeanimation.md)

## Ctx.handleSessionFreeAnimation() method

Optional `handleSessionFreeAnimation` route handler declaration.

**Signature:**

```typescript
handleSessionFreeAnimation?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `animation` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionFreeAnimation()](./gramstax.ctx.setsessionfreeanimation.md) which wires [Ctx.methodSessionFreeAnimation()](./gramstax.ctx.methodsessionfreeanimation.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleFreeAnimation()](./gramstax.ctx.handlefreeanimation.md) instead.

