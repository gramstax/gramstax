---
title: "WorkerThreadLaunch.init()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md) &gt; [init](./worker-thread.workerthreadlaunch.init.md)

## WorkerThreadLaunch.init() method

\[LOW-LEVEL\] Initialize the worker thread and set up message handlers.

**Signature:**

```typescript
init(): void;
```
**Returns:**

void

## Remarks

Spawns the worker, wires message/error/exit handlers, and registers SIGINT/SIGTERM cleanup. On exit, all pending RPC requests are rejected and the `exit` event is emitted.

