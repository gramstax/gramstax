---
title: "IRouteWidgetBroadcastRevise"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRouteWidgetBroadcastRevise](./gramstax.iroutewidgetbroadcastrevise.md)

## IRouteWidgetBroadcastRevise type

Widget route atom: broadcast revise fan-out (data-only).

**Signature:**

```typescript
type IRouteWidgetBroadcastRevise = INeverFields<`mode` | `rich` | `richOptions` | `chunkSize` | `fallback` | `options` | `editOptions` | `fallbackOptions` | `keyboard` | `is_shared`> & {
    broadcast: {
        targets: IBroadcastEditTarget[];
        reviseOptions?: Omit<IBroadcastEditOpts, `fallback`> | null;
    };
};
```
**References:** [INeverFields](./gramstax.ineverfields.md), [IBroadcastEditTarget](./gramstax.ibroadcastedittarget.md), [IBroadcastEditOpts](./gramstax.ibroadcasteditopts.md)

## Remarks

Re-applies the template's `chat_data` to stored widget messages (`broadcast.targets`) via `editMessageWidgetData` — the `update-data` mode fanned out. There is no delete-and-resend fallback here (unlike `renderMedia` revise): a failed per-recipient update is classified via `Ctx.classifySendError` (`fallback-text` sends the caption as text to that recipient, `retryable` is recorded), so `reviseOptions.fallback` is omitted from the type. Shared widgets are rejected fail-fast: one `editSharedWidgetData` call updates every message showing the widget, so a fan-out over stored messages is the wrong tool — use `mode: "update-data"` once instead. This route takes no `is_shared` field.

