---
title: "Ctx.handleFreeDocument()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleFreeDocument](./gramstax.ctx.handlefreedocument.md)

## Ctx.handleFreeDocument() method

Route handler for free-form document input.

**Signature:**

```typescript
/** @virtual */
handleFreeDocument?(): Promise<unknown>;
```
**Returns:**

Promise&lt;unknown&gt;

## Remarks

Triggered by any document not matching other routes, typically used with sessions.

## Example


```typescript
async handleFreeDocument() {
   this.msg?.document // {...}
}
```

