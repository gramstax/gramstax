

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRenderPollParams](./gramstax.irenderpollparams.md)

## IRenderPollParams type

Parameters for `renderPoll`.

**Signature:**

```typescript
type IRenderPollParams = IContent & (Omit<IRouteAuto, `options`> | Omit<IRouteReply, `options`> | Omit<IRouteBroadcastSend, `options`>) & {
    options?: IOptPoll | null;
};
```
**References:** [IContent](./gramstax.icontent.md), [IRouteAuto](./gramstax.irouteauto.md), [IRouteReply](./gramstax.iroutereply.md), [IRouteBroadcastSend](./gramstax.iroutebroadcastsend.md), [IOptPoll](./gramstax.ioptpoll.md)

## Remarks

`params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`, read from the `<g-poll>` block) on the send-only routes — the runtime-decided `IRouteAuto`, the forced `IRouteReply`, and the `IRouteBroadcastSend` fan-out. The Bot API offers no edit for polls (only `stopPoll`), so there is no edit route and no fallback content, and the option slot is narrowed to the `sendPoll` call (`IOptPoll`).

On the broadcast-send route the compiled `<g-poll>` block is fanned out to every entry of `broadcast.ids` with its own language code; `Ctx.assertPoll` runs for every recipient BEFORE the loop and the route's `mode`/`fallback` are never read (polls are send-only).

