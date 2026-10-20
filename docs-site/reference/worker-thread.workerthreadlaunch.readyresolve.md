---
title: "WorkerThreadLaunch.readyResolve()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md) &gt; [readyResolve](./worker-thread.workerthreadlaunch.readyresolve.md)

## WorkerThreadLaunch.readyResolve() method

\[LOW-LEVEL\] Internal method called by worker to signal readiness.

**Signature:**

```typescript
readyResolve(): void;
```
**Returns:**

void

## Remarks

Resolves the `ready()` promise and emits the `ready` event (once).

