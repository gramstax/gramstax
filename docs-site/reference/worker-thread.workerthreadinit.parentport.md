---
title: "WorkerThreadInit.parentPort"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadInit](./worker-thread.workerthreadinit.md) &gt; [parentPort](./worker-thread.workerthreadinit.parentport.md)

## WorkerThreadInit.parentPort property

Reference to the parent port for messaging from `node:worker_threads`.

**Signature:**

```typescript
parentPort: node_worker_threads.MessagePort | null;
```

## Remarks

Uses `parentPort` to send and receive messages.

