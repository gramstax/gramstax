> **Documentation Info**
>
> - **Last Updated:** Monday, January 12, 2026 at 09:00:00 AM (UTC+07:00)
> - **Framework Version:** v0.3.17

# WorkerThreadExport

The `WorkerThreadExport` class provides a unified interface for creating and managing worker threads with automatic RPC proxying.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadExport` static methods for worker thread initialization.
> - **Dual mode:** Automatically detects if running in main thread or worker thread.
> - **RPC proxy:** Provides type-safe method calls to worker thread.

&nbsp;

## Static Methods

### `.init(options)`

Initialize a worker thread export with automatic environment detection.

| parameter        | type     | required | default              | description              | ai_notes                                             |
| ---------------- | -------- | -------- | -------------------- | ------------------------ | ---------------------------------------------------- |
| options.path     | string   | yes      | -                    | Path to the worker file  | Typically `__filename` for self-referential workers. |
| options.WTInit   | class    | yes      | -                    | Worker thread init class | Extends `WorkerThreadInit`.                          |
| options.WTLaunch | class    | no       | `WorkerThreadLaunch` | Main thread launch class | Extends `WorkerThreadLaunch`.                        |
| options.wrap     | function | no       | -                    | Custom wrapper function  | Adds custom methods to returned object.              |

- **returns: object** - Proxied object with `launchWorker`, `gateway`, and worker methods.
- **ai_notes:** In worker thread context, only returns `gateway`. In main thread, returns full proxy.

```typescript
import { WorkerThreadExport, WorkerThreadInit } from "gramstax";

class MyWorker extends WorkerThreadInit {
  count = 0;

  increment() {
    this.count += 1;
    return this.count;
  }

  getCount() {
    return this.count;
  }
}

export const CounterJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: MyWorker,
});
```

&nbsp;

### `.gateway(path)`

Create a typed gateway proxy for inter-worker communication.

| parameter | type   | required | description                    | ai_notes                       |
| --------- | ------ | -------- | ------------------------------ | ------------------------------ |
| path      | string | yes      | Path to the target worker file | Must match target init `path`. |

- **returns: WorkerThreadGatewayProxy & { new(owner): WorkerThreadAsyncMethods }**
- **ai_notes:** Can be used as static methods or as constructor.

```typescript
// Static usage
const OtherWorker =
  WorkerThreadExport.gateway<OtherWorkerClass>("/path/to/other.ts");
await OtherWorker.someMethod(this, arg1, arg2);

// Constructor usage
const client = new OtherWorker(this);
await client.someMethod(arg1, arg2);
```

&nbsp;

## Returned Object Methods

### `.launchWorker(argv?)`

Launch the worker thread from the main thread.

| parameter | type  | required | default | description            | ai_notes                                 |
| --------- | ----- | -------- | ------- | ---------------------- | ---------------------------------------- |
| argv      | any[] | no       | `[]`    | Command line arguments | Accessible via `process.argv` in worker. |

- **returns: Promise\<WorkerThreadLaunch\>**
- **ai_notes:** Resolves when worker signals ready.

```typescript
// In main thread
await CounterJob.launchWorker([5000]);
```

### `.gateway(path)`

Get a gateway proxy for inter-worker communication.

- Same as static `WorkerThreadExport.gateway()`.

### `.[methodName](...args)`

Call any method defined in the worker's `WTInit` class.

- **returns: Promise\<ReturnType\>**
- **ai_notes:** Automatically proxied via RPC.

```typescript
// In main thread, after launchWorker
const count = await CounterJob.increment();
const current = await CounterJob.getCount();
```

&nbsp;

## Usage

```typescript
// jobs/counter.ts
import { WorkerThreadExport, WorkerThreadInit, log } from "gramstax";

class Core extends WorkerThreadInit {
  count = 0;

  constructor() {
    super();
    const interval = parseInt(process.argv[3]) || 1000;
    setInterval(() => {
      this.count += 1;
      log.debug(`Count: ${this.count}`);
    }, interval);
  }

  getCount() {
    return this.count;
  }
}

export const CounterJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: Core,
});

// index.ts
import { CounterJob } from "./jobs/counter";

await CounterJob.launchWorker([1000]);

// Later...
const count = await CounterJob.getCount();
console.log(`Current count: ${count}`);
```
