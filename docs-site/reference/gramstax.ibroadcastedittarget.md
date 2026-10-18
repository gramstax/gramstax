

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IBroadcastEditTarget](./gramstax.ibroadcastedittarget.md)

## IBroadcastEditTarget type

One already-sent message to revise or remove in bulk.

**Signature:**

```typescript
type IBroadcastEditTarget = {
    chatId: number;
    messageId: number;
};
```

## Remarks

Matches the downstream `SentRepository` row shape (`chatId` + `messageId` per content code): list stored rows and pass them back to `renderMedia` (with `broadcast.targets`) / `renderBroadcastDelete`.

## Example


```ts
const sent = await this.db.sentRepo.listByCode(`vip-drop-7`)
await this.renderMedia({type: `photo`, data: {price: `99`}, broadcast: {targets: sent}})
```

