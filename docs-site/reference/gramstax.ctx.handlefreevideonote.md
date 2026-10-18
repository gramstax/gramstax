---
title: "Ctx.handleFreeVideoNote()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleFreeVideoNote](./gramstax.ctx.handlefreevideonote.md)

## Ctx.handleFreeVideoNote() method

Route handler for free-form video note input.

**Signature:**

```typescript
/** @virtual */
handleFreeVideoNote?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by any video note not matching other routes, typically used with sessions.

## Example


```typescript
async handleFreeVideoNote() {
   this.msg?.video_note // {...}
}
```

