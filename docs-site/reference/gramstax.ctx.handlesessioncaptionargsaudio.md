---
title: "Ctx.handleSessionCaptionArgsAudio()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleSessionCaptionArgsAudio](./gramstax.ctx.handlesessioncaptionargsaudio.md)

## Ctx.handleSessionCaptionArgsAudio() method

Optional `handleSessionCaptionArgsAudio` route handler declaration.

**Signature:**

```typescript
handleSessionCaptionArgsAudio?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Executed on `audio` updates while the session is active. Routing id=1 (session) runs BEFORE static/intent matching (id=2-3): it reads `ctx.getSession().method` — set via [Ctx.setSessionCaptionArgsAudio()](./gramstax.ctx.setsessioncaptionargsaudio.md) which wires [Ctx.methodSessionCaptionArgsAudio()](./gramstax.ctx.methodsessioncaptionargsaudio.md) — and dispatches this handler through `new Page(ctx)`. When no session is active, the same update falls through to the non-session route [Ctx.handleCaptionArgsAudio()](./gramstax.ctx.handlecaptionargsaudio.md) instead.

