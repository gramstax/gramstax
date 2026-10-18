---
title: "Ctx.handleSessionCommandArgsText()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCommandArgsText](./gramstax.ctx.handlesessioncommandargstext.md)

## Ctx.handleSessionCommandArgsText() method

Optional `handleSessionCommandArgsText` route handler declaration.

**Signature:**

```typescript
handleSessionCommandArgsText?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `text` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCommandArgsText()](./gramstax.ctx.setsessioncommandargstext.md) which wires [Ctx.methodSessionCommandArgsText()](./gramstax.ctx.methodsessioncommandargstext.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCommandArgsText()](./gramstax.ctx.handlecommandargstext.md) instead.

