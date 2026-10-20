---
title: "WorkerThreadInit.(constructor)"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadInit](./worker-thread.workerthreadinit.md) &gt; [(constructor)](./worker-thread.workerthreadinit._constructor_.md)

## WorkerThreadInit.(constructor)

Creates a new WorkerThreadInit instance. Sets up message handling and signals readiness to the main thread.

**Signature:**

```typescript
constructor();
```

## Remarks

The `readyResolve` signal is deferred with `queueMicrotask` so that subclass field initializers (which run after `super()` returns) are already applied before main-thread RPCs can observe worker state.

