---
title: "IWorkerThreadPoolMethods"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [IWorkerThreadPoolMethods](./worker-thread.iworkerthreadpoolmethods.md)

## IWorkerThreadPoolMethods type

The `mtd*` methods of a worker class, exposed as pool members.

**Signature:**

```typescript
type IWorkerThreadPoolMethods<TInit extends WorkerThreadInit> = {
    [K in keyof TInit as K extends `mtd${string}` ? K : never]: TInit[K] extends (...args: infer A) => infer R ? <TMode extends IWorkerThreadPoolMode = "execute">(...args: [...A, IWorkerThreadPoolOptions<TMode>?]) => Promise<IWorkerThreadPoolResult<R, TMode>> : never;
};
```
**References:** [WorkerThreadInit](./worker-thread.workerthreadinit.md), [IWorkerThreadPoolMode](./worker-thread.iworkerthreadpoolmode.md), [IWorkerThreadPoolOptions](./worker-thread.iworkerthreadpooloptions.md)

## Remarks

Each member accepts the worker's own arguments followed by one optional [IWorkerThreadPoolOptions](./worker-thread.iworkerthreadpooloptions.md). The result type follows the mode, so omitting `mode` yields a single value and naming it yields an array.

If the `mode` argument is widened to `IWorkerThreadPoolMode` rather than a literal, the result widens to a union of all three shapes. Pass the literal at the call site to keep the precise type.

Unlike `IWorkerThreadAsyncMethods`, this filters on the `mtd` prefix rather than on membership of `WorkerThreadInit`. A pool is a fan-out surface, so a worker's private helper should not become part of the pool's public API. The runtime does not enforce the prefix (only `DENIED_RPC_METHODS` in `rpc.ts` gates dispatch), so this is a readability surface, not a safety boundary.

