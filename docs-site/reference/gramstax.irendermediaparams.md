

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderMediaParams](./gramstax.irendermediaparams.md)

## IRenderMediaParams type

Parameters for `renderMedia` — the single media send/edit method.

**Signature:**

```typescript
type IRenderMediaParams<T extends IMediaKind> = (IMediaKindContent<T> & IRouteMediaAuto<T>) | (IMediaKindContent<T> & IRouteMediaReply<T>) | (IContent & IRouteMediaBroadcastSend<T>) | (IMediaKindContent<T> & IRouteMediaBroadcastRevise<T>);
```
**References:** [IRouteMediaAuto](./gramstax.iroutemediaauto.md), [IRouteMediaReply](./gramstax.iroutemediareply.md), [IContent](./gramstax.icontent.md), [IRouteMediaBroadcastSend](./gramstax.iroutemediabroadcastsend.md), [IRouteMediaBroadcastRevise](./gramstax.iroutemediabroadcastrevise.md)

## Remarks

`params = CONTENT & ROUTE`. The content is the media kind (`type`) plus the shared template fields (`data`, `AGBaseId`); the routes are the media atoms — `IRouteMediaAuto` (default; also carries `mode: 'edit'`), `IRouteMediaReply`, `IRouteMediaBroadcastSend` and `IRouteMediaBroadcastRevise`. The kind-specific call options (`media`, `captionOptions`, `mediaOptions`, `resendOptions`) ride on those atoms rather than on a shared slots type, because a forced send reads none of them. Every route declares all ten universal route keys, so combinations such as `{mode: 'reply', broadcast: {…}}` are compile errors instead of silently dropped fields.

`broadcast` switches to multi-recipient fan-out: `broadcast.ids` runs the send loop (kind read from the template), and `broadcast.targets` runs the revise loop (`type` required). The per-kind wrappers accept the single-chat and revise routes — see [IRenderMediaKindParams](./gramstax.irendermediakindparams.md).

