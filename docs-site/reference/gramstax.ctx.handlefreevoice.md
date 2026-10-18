---
title: "Ctx.handleFreeVoice()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleFreeVoice](./gramstax.ctx.handlefreevoice.md)

## Ctx.handleFreeVoice() method

Route handler for free-form voice input.

**Signature:**

```typescript
/** @virtual */
handleFreeVoice?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by any voice not matching other routes, typically used with sessions.

## Example


```typescript
async handleFreeVoice() {
   this.msg?.voice // {...}
}
```

