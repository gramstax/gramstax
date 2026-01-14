> **Documentation Info**
>
> - **Last Updated:** 14/01/2026 16:37:38

> - **Framework Version:** v0.3.22

# WorkerThreadLaunch

> This is an internal class never used by user.

The `WorkerThreadLaunch` class manages worker thread lifecycle from the main thread. It handles spawning, communication, and termination of worker threads.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadLaunch` class for managing workers from main thread.
> - **Graceful shutdown:** Automatically registers SIGINT/SIGTERM handlers to terminate workers.
> - **Ready signaling:** Uses promise-based ready detection.

&nbsp;

## Constructor

### `new WorkerThreadLaunch(path, argv)`

| parameter | type   | required | description                 | ai_notes                                       |
| --------- | ------ | -------- | --------------------------- | ---------------------------------------------- |
| path      | string | yes      | Path to the worker file     | **Must be:** valid JavaScript/TypeScript file. |
| argv      | any[]  | yes      | Arguments to pass to worker | **Accessible:** via `process.argv` in worker.  |

```typescript
import { WorkerThreadLaunch } from "gramstax";

const worker = new WorkerThreadLaunch("./worker.ts", ["arg1", "arg2"]);
await worker.ready();
```

&nbsp;

## Static Properties

### `.isMainThread`

Check if currently running in the main thread.

- **type: boolean**
- **ai_notes:** Re-exported from `node:worker_threads`.

&nbsp;

## Instance Properties

### `.pid`

The main process ID.

- **type: number**

### `.thread`

The underlying Node.js Worker instance.

- **type: Worker**
- **ai_notes:** From `node:worker_threads`.

### `.threadId`

The worker thread ID.

- **type: number**

### `.rpc`

RPC handler for method invocations.

- **type: WorkerThreadRpc**

### `.path`

Path to the worker file.

- **type: string**

### `.argv`

Arguments passed to the worker.

- **type: any[]**

&nbsp;

## Methods

### `.ready()`

Wait for the worker to signal it's ready.

- **returns: Promise\<void\>**
- **ai_notes:** Resolves when worker calls `super()` in `WorkerThreadInit`.

```typescript
const worker = new WorkerThreadLaunch("./worker.ts", []);
await worker.ready();
console.log("Worker is ready");
```

### `.send(payload)`

Send a message to the worker thread.

| parameter | type | required | description  | ai_notes               |
| --------- | ---- | -------- | ------------ | ---------------------- |
| payload   | any  | yes      | Data to send | Sent to worker thread. |

- **returns: void**
- **ai_notes:** No return value.

```typescript
worker.send({ action: "process", data: [1, 2, 3] });
```

### `.request(method, params, wait?, others?)`

Make an RPC request to the worker thread.

| parameter | type    | required | default | description                   | ai_notes                                                  |
| --------- | ------- | -------- | ------- | ----------------------------- | --------------------------------------------------------- |
| method    | string  | yes      | -       | Method name to call in worker | Must exist on WorkerThreadInit.                           |
| params    | any     | yes      | -       | Method parameters             | Passed as array to worker method.                         |
| wait      | boolean | no       | `true`  | Wait for response             | If false fire-and-forget.                                 |
| others    | object  | no       | -       | Additional RPC data           | Additional key value aligned position with method, params |

- **returns: Promise\<any\>**
- **ai_notes:** Resolves with worker response.

```typescript
const result = await worker.request("processData", [[1, 2, 3]]);
console.log("Result:", result);
```

### `.kill()`

Terminate the worker thread immediately.

- **returns: void**
- **ai_notes:** Calls `thread.terminate()`.

```typescript
worker.kill();
```

&nbsp;

## Graceful Shutdown

`WorkerThreadLaunch` automatically handles graceful shutdown:

- Listens for `SIGINT` and `SIGTERM` signals
- Terminates the worker thread on process exit
- Cleans up on worker thread exit

```typescript
// Worker will be automatically terminated when:
// - Process receives SIGINT (Ctrl+C)
// - Process receives SIGTERM
// - Worker exits normally or crashes
```

&nbsp;

## Usage

```typescript
import { WorkerThreadLaunch } from "gramstax";

async function main() {
  // Launch worker
  const worker = new WorkerThreadLaunch("./jobs/processor.ts", ["config.json"]);
  await worker.ready();
  console.log(`Worker ${worker.threadId} is ready`);

  // Make requests
  const result = await worker.request("process", [{ data: "test" }]);
  console.log("Result:", result);

  // Later: manual termination
  worker.kill();
}

main();
```
