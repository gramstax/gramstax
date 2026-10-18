---
title: "IRenderMediaGroupParams"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderMediaGroupParams](./gramstax.irendermediagroupparams.md)

## IRenderMediaGroupParams type

Parameters for `renderMediaGroup` — the single media-group send/edit method.

**Signature:**

```typescript
type IRenderMediaGroupParams = IGroupContent & (IRouteGroupAuto | IRouteGroupReply);
```
**References:** [IRouteGroupAuto](./gramstax.iroutegroupauto.md), [IRouteGroupReply](./gramstax.iroutegroupreply.md)

## Remarks

`params = CONTENT & ROUTE`: the group content (`type` as a FILTER, `data`, `AGBaseId`) on the `IRouteAuto` and `IRouteReply` routes — `auto` (default) edits when the update carries a `callbackQuery`, `reply` always sends. Media groups have no in-place edit, so every edit route deletes the original message first and the `delete-reply` fallback deletes again before re-sending; `options` feeds the direct reply branch and the delete-then-resend branches alike. Telegram media groups carry no reply markup.

