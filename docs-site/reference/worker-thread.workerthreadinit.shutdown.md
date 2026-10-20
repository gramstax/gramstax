---
title: "WorkerThreadInit.shutdown()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadInit](./worker-thread.workerthreadinit.md) &gt; [shutdown](./worker-thread.workerthreadinit.shutdown.md)

## WorkerThreadInit.shutdown() method

Graceful shutdown handler, callable via RPC from the main thread.

**Signature:**

```typescript
shutdown(): Promise<boolean>;
```
**Returns:**

Promise&lt;boolean&gt;

Promise resolving to `true` when shutdown is complete.

## Remarks

Runs the [WorkerThreadInit.onBeforeExit()](./worker-thread.workerthreadinit.onbeforeexit.md) hook (flush state, close connections, persist data), then closes gateway resources so no socket or reconnect timer keeps the worker alive. The main thread terminates the worker after this resolves. Override to customize, or just set `onBeforeExit`.

Gateway cleanup runs in a `finally` block, so it ALWAYS executes even when `onBeforeExit` throws (the hook error still propagates to the caller). The hook runs at most once — a second `shutdown()` call returns `true` immediately. After cleanup the gateway registry is cleared (`gatewayClients` emptied, `gatewayServer` and `gatewayClientLatest` reset to `undefined`) so no closed handle is reused.

