---
title: "Ctx.handleFreeAnimation()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleFreeAnimation](./gramstax.ctx.handlefreeanimation.md)

## Ctx.handleFreeAnimation() method

Route handler for free-form animation input.

**Signature:**

```typescript
/** @virtual */
handleFreeAnimation?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by any animation not matching other routes, typically used with sessions.

## Example


```typescript
async handleFreeAnimation() {
   this.msg?.animation // {...}
}
```

