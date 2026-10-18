---
title: "Ctx.handleSessionFreeDocument()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionFreeDocument](./gramstax.ctx.handlesessionfreedocument.md)

## Ctx.handleSessionFreeDocument() method

Optional `handleSessionFreeDocument` route handler declaration.

**Signature:**

```typescript
handleSessionFreeDocument?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `document` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionFreeDocument()](./gramstax.ctx.setsessionfreedocument.md) which wires [Ctx.methodSessionFreeDocument()](./gramstax.ctx.methodsessionfreedocument.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleFreeDocument()](./gramstax.ctx.handlefreedocument.md) instead.

