

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IBroadcastSendResult](./gramstax.ibroadcastsendresult.md)

## IBroadcastSendResult type

Bulk send result with a re-drive list.

**Signature:**

```typescript
type IBroadcastSendResult = {
    successCount: number;
    failedCount: number;
    totalCount: number;
    skippedCount: number;
    retryable: Array<{
        index: number;
        id: number;
        error: unknown;
    }>;
};
```

## Remarks

Broadcast-send counterpart of [IBroadcastEditResult](./gramstax.ibroadcasteditresult.md): counts plus `retryable[]` (absolute `index` + recipient `id` + `error`, completion order) for a fresh retry pass, and `skippedCount` for `startFrom`-resumed or `excludeIds`-skipped recipients. Returned by the `broadcast.ids` paths of [Ctx.renderText()](./gramstax.ctx.rendertext.md), [Ctx.renderPoll()](./gramstax.ctx.renderpoll.md), and [Ctx.renderMedia()](./gramstax.ctx.rendermedia.md).

