---
title: "IKbDest"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IKbDest](./gramstax.ikbdest.md)

## IKbDest type

Destination for an inline keyboard button — a page (class or instance) that defines `handleCallbackQueryData`, or a literal callback data string.

**Signature:**

```typescript
type IKbDest = (typeof Ctx & IKbDestHasCallback) | (Ctx & IKbDestHasCallback[`prototype`]) | string | IKbCallbackData<typeof Ctx, Array<string | undefined>>;
```
**References:** [Ctx](./gramstax.ctx.md), [IKbCallbackData](./gramstax.ikbcallbackdata.md)

## Remarks

Pages that don't override `handleCallbackQueryData` will cause a compile error when referenced here.

