---
title: "ILmdbEnvOptions.commitDelay"
---

[Home](./index.md) &gt; [@gramstax/lmdb](./lmdb.md) &gt; [ILmdbEnvOptions](./lmdb.ilmdbenvoptions.md) &gt; [commitDelay](./lmdb.ilmdbenvoptions.commitdelay.md)

## ILmdbEnvOptions.commitDelay property

Milliseconds to wait for batching writes before committing.

**Signature:**

```typescript
commitDelay?: number;
```

## Remarks

`0` (default) commits immediately. Higher values trade latency for more writes per transaction (higher throughput under load). Note that Node.js timers have \~10ms effective resolution.

