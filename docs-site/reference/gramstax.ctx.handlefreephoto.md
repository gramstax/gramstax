---
title: "Ctx.handleFreePhoto()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleFreePhoto](./gramstax.ctx.handlefreephoto.md)

## Ctx.handleFreePhoto() method

Route handler for free-form photo input.

**Signature:**

```typescript
/** @virtual */
handleFreePhoto?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by any photo not matching other routes, typically used with sessions.

## Example


```typescript
async handleFreePhoto() {
   this.msg?.photo // {...}
}
```

