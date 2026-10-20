---
title: "IWorkerThreadExportOpt"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [IWorkerThreadExportOpt](./worker-thread.iworkerthreadexportopt.md)

## IWorkerThreadExportOpt type

Options for initializing a worker thread export.

**Signature:**

```typescript
type IWorkerThreadExportOpt<TWorker extends WorkerThreadInit, TMain extends WorkerThreadLaunch, TWrap> = {
    path: string;
    WTInit: new () => TWorker;
    WTLaunch?: new (path: string, argv?: unknown[]) => TMain;
    wrap?: (main: TMain) => TWrap;
};
```
**References:** [WorkerThreadInit](./worker-thread.workerthreadinit.md), [WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md)

