---
title: "IRouteGroupAuto"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRouteGroupAuto](./gramstax.iroutegroupauto.md)

## IRouteGroupAuto type

Media-group route atom: runtime-decided group send.

**Signature:**

```typescript
type IRouteGroupAuto = INeverFields<`editOptions` | `rich` | `richOptions` | `fallbackOptions`> & {
    mode?: `auto` | `edit`;
    keyboard?: never;
    options?: IOptReply | null;
    fallback?: IOptFallbackEdit;
    fallbackOptions?: never;
    broadcast?: null | undefined;
    chunkSize?: null | undefined;
};
```
**References:** [INeverFields](./gramstax.ineverfields.md), [IOptReply](./gramstax.ioptreply.md), [IOptFallbackEdit](./gramstax.ioptfallbackedit.md)

## Remarks

`sendMediaGroup` takes no reply markup, so `keyboard` is unread on every group route. A group also never carries a rich message payload.

