---
title: "Ctx.handleSessionArgsText()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionArgsText](./gramstax.ctx.handlesessionargstext.md)

## Ctx.handleSessionArgsText() method

Optional `handleSessionArgsText` route handler declaration.

**Signature:**

```typescript
handleSessionArgsText?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `text` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionArgsText()](./gramstax.ctx.setsessionargstext.md) which wires [Ctx.methodSessionArgsText()](./gramstax.ctx.methodsessionargstext.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleArgsText()](./gramstax.ctx.handleargstext.md) instead.

