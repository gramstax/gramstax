---
title: "IKbPageLike"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IKbPageLike](./gramstax.ikbpagelike.md)

## IKbPageLike type

Page class/instance that defines `handleCallbackQueryData`.

**Signature:**

```typescript
type IKbPageLike = (typeof Ctx & IKbDestHasCallback) | (Ctx & IKbDestHasCallback[`prototype`]);
```
**References:** [Ctx](./gramstax.ctx.md)

## Remarks

Same constraint as [IKbDest](./gramstax.ikbdest.md): pages that don't override `handleCallbackQueryData` cause a compile error when used here.

