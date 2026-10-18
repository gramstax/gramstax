

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCaptionDocument](./gramstax.ctx.handlesessioncaptiondocument.md)

## Ctx.handleSessionCaptionDocument() method

Optional `handleSessionCaptionDocument` route handler declaration.

**Signature:**

```typescript
handleSessionCaptionDocument?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `document` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCaptionDocument()](./gramstax.ctx.setsessioncaptiondocument.md) which wires [Ctx.methodSessionCaptionDocument()](./gramstax.ctx.methodsessioncaptiondocument.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCaptionDocument()](./gramstax.ctx.handlecaptiondocument.md) instead.

