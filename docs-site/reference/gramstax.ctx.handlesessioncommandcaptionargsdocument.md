---
title: "Ctx.handleSessionCommandCaptionArgsDocument()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCommandCaptionArgsDocument](./gramstax.ctx.handlesessioncommandcaptionargsdocument.md)

## Ctx.handleSessionCommandCaptionArgsDocument() method

Optional `handleSessionCommandCaptionArgsDocument` route handler declaration.

**Signature:**

```typescript
handleSessionCommandCaptionArgsDocument?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `document` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCommandCaptionArgsDocument()](./gramstax.ctx.setsessioncommandcaptionargsdocument.md) which wires [Ctx.methodSessionCommandCaptionArgsDocument()](./gramstax.ctx.methodsessioncommandcaptionargsdocument.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCommandCaptionArgsDocument()](./gramstax.ctx.handlecommandcaptionargsdocument.md) instead.

