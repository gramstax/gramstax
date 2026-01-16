> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 12:24:00

> - **Framework Version:** v0.5.1

# WorkerThreadPool

The `WorkerThreadPool` class manages multiple worker thread instances, providing pooled access and broadcast functionality.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadPool` class for managing multiple workers.
> - **Thread registry:** Uses `Map` with `threadId` as key.
> - **Broadcast:** Supports sending requests to all workers.

&nbsp;

## Constructor

### `new WorkerThreadPool(instances)`

| parameter | type                 | required | description              |
| --------- | -------------------- | -------- | ------------------------ |
| instances | WorkerThreadLaunch[] | yes      | Initial worker instances |

```typescript
import { WorkerThreadPool, WorkerThreadLaunch } from "gramstax";

const worker1 = new WorkerThreadLaunch("./worker.ts", ["1"]);
const worker2 = new WorkerThreadLaunch("./worker.ts", ["2"]);
await Promise.all([worker1.ready(), worker2.ready()]);

const pool = new WorkerThreadPool([worker1, worker2]);
```

&nbsp;

## Properties

### `.thread`

Map of all worker instances by thread ID.

- **type: Map\<number, WorkerThreadLaunch\>**

### `.threadCount`

Current number of workers in the pool.

- **type: number**

&nbsp;

## Methods

### `.add(instance)`

Add a single worker to the pool.

| parameter | type               | required | description                           |
| --------- | ------------------ | -------- | ------------------------------------- |
| instance  | WorkerThreadLaunch | yes      | Worker to add. Registers by threadId. |

- **returns: void**
- **description:** No return value.

```typescript
const newWorker = new WorkerThreadLaunch("./worker.ts", ["3"]);
await newWorker.ready();
pool.add(newWorker);
```

### `.addMany(instances)`

Add multiple workers to the pool.

| parameter | type                 | required | description                            |
| --------- | -------------------- | -------- | -------------------------------------- |
| instances | WorkerThreadLaunch[] | yes      | Workers to add. Registers all workers. |

- **returns: void**
- **description:** No return value.

```typescript
pool.addMany([worker4, worker5]);
```

### `.getInstance(threadId)`

Get a specific worker by thread ID.

| parameter | type   | required | description                                |
| --------- | ------ | -------- | ------------------------------------------ |
| threadId  | number | yes      | Worker thread ID. Lookup in pool registry. |

- **returns: WorkerThreadLaunch | undefined**
- **description:** Worker instance or undefined.

```typescript
const worker = pool.getInstance(123);
if (worker) {
  await worker.request("process", [data]);
}
```

### `.kill(threadId)`

Kill and remove a specific worker from the pool.

| parameter | type   | required | description                          |
| --------- | ------ | -------- | ------------------------------------ |
| threadId  | number | yes      | Worker thread ID. Terminates worker. |

- **returns: number | undefined** - The killed worker's threadId.
- **description:** Undefined if worker not found.

```typescript
const killedId = pool.kill(123);
console.log(`Killed worker ${killedId}`);
```

### `.killAll()`

Kill and remove all workers from the pool.

- **returns: void**
- **description:** No return value.

```typescript
pool.killAll();
console.log(`All workers terminated`);
```

### `.request(threadId, method, params, wait?, others?)`

Send a request to a specific worker.

| parameter | type    | required | default | description                                       |
| --------- | ------- | -------- | ------- | ------------------------------------------------- |
| threadId  | number  | yes      | -       | Target worker thread ID. Lookup in pool registry. |
| method    | string  | yes      | -       | Method name to call. Targets worker RPC method.   |
| params    | any     | yes      | -       | Method parameters. Sent as positional array.      |
| wait      | boolean | no       | `true`  | Wait for response. If false, fire-and-forget.     |
| others    | object  | no       | -       | Additional RPC data. Merged into RPC payload.     |

- **returns: Promise\<any\>**
- **description:** Resolves with worker response.

```typescript
const result = await pool.request(123, "process", [data]);
```

### `.broadcastRequest(method, params)`

Send a request to all workers and collect results.

| parameter | type   | required | description                                   |
| --------- | ------ | -------- | --------------------------------------------- |
| method    | string | yes      | Method name to call. Invoked on every worker. |
| params    | any    | yes      | Method parameters. Sent as positional array.  |

- **returns: Promise\<any[]\>** - Array of results from all workers.
- **description:** Order follows worker list.

```typescript
const results = await pool.broadcastRequest("getStatus", []);
console.log("All statuses:", results);
```

&nbsp;

## Usage

```typescript
import { WorkerThreadPool, WorkerThreadLaunch } from "gramstax";

async function main() {
  // Create worker pool
  const workers = await Promise.all(
    [1, 2, 3, 4].map(async (i) => {
      const w = new WorkerThreadLaunch("./processor.ts", [String(i)]);
      await w.ready();
      return w;
    })
  );

  const pool = new WorkerThreadPool(workers);
  console.log(`Pool has ${pool.threadCount} workers`);

  // Broadcast to all workers
  const statuses = await pool.broadcastRequest("getStatus", []);
  console.log("Worker statuses:", statuses);

  // Request from specific worker
  const result = await pool.request(workers[0].threadId, "process", [data]);

  // Cleanup
  pool.killAll();
}

main();
```
