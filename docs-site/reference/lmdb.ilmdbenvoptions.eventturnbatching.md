---
title: "ILmdbEnvOptions.eventTurnBatching"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [eventTurnBatching](./lmdb.ilmdbenvoptions.eventturnbatching.md)

## ILmdbEnvOptions.eventTurnBatching property

Enable LMDB's event-turn batching of async writes.

**Signature:**

```typescript
eventTurnBatching?: boolean;
```

## Remarks

Default `true`. All async writes in the same event turn share one commit. Set `false` for lower-latency individual writes (then tune `txnStartThreshold`).

