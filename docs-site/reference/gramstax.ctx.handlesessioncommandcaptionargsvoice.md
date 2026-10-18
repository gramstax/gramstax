

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCommandCaptionArgsVoice](./gramstax.ctx.handlesessioncommandcaptionargsvoice.md)

## Ctx.handleSessionCommandCaptionArgsVoice() method

Optional `handleSessionCommandCaptionArgsVoice` route handler declaration.

**Signature:**

```typescript
handleSessionCommandCaptionArgsVoice?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `voice` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCommandCaptionArgsVoice()](./gramstax.ctx.setsessioncommandcaptionargsvoice.md) which wires [Ctx.methodSessionCommandCaptionArgsVoice()](./gramstax.ctx.methodsessioncommandcaptionargsvoice.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCommandCaptionArgsVoice()](./gramstax.ctx.handlecommandcaptionargsvoice.md) instead.

