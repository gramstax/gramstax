---
title: "Ctx.handleSessionCommandCaptionDocument()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCommandCaptionDocument](./gramstax.ctx.handlesessioncommandcaptiondocument.md)

## Ctx.handleSessionCommandCaptionDocument() method

Optional `handleSessionCommandCaptionDocument` route handler declaration.

**Signature:**

```typescript
handleSessionCommandCaptionDocument?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `document` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCommandCaptionDocument()](./gramstax.ctx.setsessioncommandcaptiondocument.md) which wires [Ctx.methodSessionCommandCaptionDocument()](./gramstax.ctx.methodsessioncommandcaptiondocument.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCommandCaptionDocument()](./gramstax.ctx.handlecommandcaptiondocument.md) instead.

