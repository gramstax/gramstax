---
title: "IRouteMediaBroadcastRevise"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRouteMediaBroadcastRevise](./gramstax.iroutemediabroadcastrevise.md)

## IRouteMediaBroadcastRevise type

Media route atom: broadcast revise fan-out.

**Signature:**

```typescript
type IRouteMediaBroadcastRevise<T extends IMediaKind> = INeverFields<`mode` | `options` | `editOptions` | `rich` | `richOptions` | `fallbackOptions` | `captionOptions` | `chunkSize`> & {
    broadcast: IBroadcastReviseParams;
    keyboard?: IInBoKb | null;
    media?: IMediaEditOpt1<T> | null;
    mediaOptions?: IOptEditMedia2 | null;
    resendOptions?: IMediaReplyOpt<T> | null;
    fallback?: IOptFallbackEdit;
};
```
**References:** [INeverFields](./gramstax.ineverfields.md), [IBroadcastReviseParams](./gramstax.ibroadcastreviseparams.md), [IInBoKb](./gramstax.iinbokb.md), [IOptEditMedia2](./gramstax.iopteditmedia2.md), [IOptFallbackEdit](./gramstax.ioptfallbackedit.md)

## Remarks

Revises stored messages in place where the kind allows it, and deletes then re-sends where it does not — which is why the keyboard stays wide and `resendOptions` is live.

`type` is deliberately NOT declared here. On `renderMedia` it comes from `IMediaKindContent`, which is what makes it REQUIRED there; on the per-kind wrappers the method name already fixes the kind, so the key is absent altogether and passing it is an excess-property error — the same behaviour as before.

