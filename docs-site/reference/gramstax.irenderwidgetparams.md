---
title: "IRenderWidgetParams"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderWidgetParams](./gramstax.irenderwidgetparams.md)

## IRenderWidgetParams type

Parameters for `renderWidget`.

**Signature:**

```typescript
type IRenderWidgetParams = IContent & (IRouteWidgetReply | IRouteWidgetEdit | IRouteWidgetUpdateData | IRouteWidgetBroadcastSend | IRouteWidgetBroadcastRevise);
```
**References:** [IContent](./gramstax.icontent.md), [IRouteWidgetReply](./gramstax.iroutewidgetreply.md), [IRouteWidgetEdit](./gramstax.iroutewidgetedit.md), [IRouteWidgetUpdateData](./gramstax.iroutewidgetupdatedata.md), [IRouteWidgetBroadcastSend](./gramstax.iroutewidgetbroadcastsend.md), [IRouteWidgetBroadcastRevise](./gramstax.iroutewidgetbroadcastrevise.md)

## Remarks

`params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`, read from the `<g-widget>` block) on one of five routes — forced send (`IRouteWidgetReply`, the default), forced edit (`IRouteWidgetEdit`), data-only update (`IRouteWidgetUpdateData`), broadcast send (`IRouteWidgetBroadcastSend`), or broadcast revise (`IRouteWidgetBroadcastRevise`).

Modes are explicit and there is NO `auto` mode: a tap inside the widget (`widget_query`) wants `update-data` while a keyboard button under it (`callbackQuery`) wants `edit`, so no single runtime guess is honest. `mode` defaults to `reply` when omitted.

The widget HTML can never be replaced — the Bot API offers no `editMessageWidget`. `edit` re-applies state + caption + keyboard to the message held by the context (up to three API calls, NOT atomic); `update-data` changes only the state in exactly one call (atomic), and is the only mode meaningful for shared widgets. Neither edit mode answers the widget query — the handler must still call `ctx.answerWidgetQuery` within 15 seconds.

`is_shared` is a send-route-only param (`reply` and broadcast-send): it overrides the template block's `is_shared` at send time, while the edit routes auto-detect shared-ness from the context and take no `is_shared` field.

Send failures follow `Ctx.classifySendError`, except the fallback content is the widget caption (sent as text with `parse_mode: "HTML"`) instead of the generic page fallback text — DEFAULT (flip to rethrow, `renderPoll` style, while testing if needed): the caption is designed to stand alone as the widget's replacement on clients without widget support.

