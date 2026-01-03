# WorkerThreadLaunch

The `WorkerThreadLaunch` class runs on the main thread and manages a single worker thread instance. It handles spawning, termination, and RPC communication with the worker.

&nbsp;

## Usage Example

```ts
import { MyWorkerExp } from "./worker";

// launchWorker returns a Proxy that wraps WorkerThreadLaunch
const launchInstance = await MyWorkerExp.launchWorker([]);

// You can use WorkerThreadLaunch methods on it
await launchInstance.ready();
launchInstance.kill();
```

&nbsp;

## WorkerThreadLaunch Properties

### .pid

The process ID of the current (main) process.

- **type: number**

```ts
console.log(launch.pid);
```

### .threadId

The ID of the spawned worker thread.

- **type: number**

```ts
console.log(launch.threadId);
```

### .thread

The native Node.js `Worker` instance.

- **type: [Worker](https://nodejs.org/api/worker_threads.html#class-worker)**

```ts
launch.thread.postMessage("hello");
```

### .rpc

The RPC handler for this worker connection.

- **type: [WorkerThreadRpc](rpc.md)**

```ts
launch.rpc.makeRequest("method", []);
```

&nbsp;

## WorkerThreadLaunch Methods

### .ready()

Returns a promise that resolves when the worker has signaled it is ready (usually after `super()` in the worker class).

- **returns: Promise\<void\>**

```ts
await launch.ready();
```

### .kill()

Terminates the worker thread immediately.

- **returns: void**

```ts
launch.kill();
```

### .send(payload)

Sends a raw payload to the worker thread.

| parameter | type | required | default | description      |
| --------- | ---- | -------- | ------- | ---------------- |
| payload   | any  | yes      | -       | The data to send |

- **returns: void**

```ts
launch.send({ type: "ping" });
```

### .request(method, params, \_wait, \_others)

Sends an RPC request to the worker thread.

| parameter | type    | required | default | description                             |
| --------- | ------- | -------- | ------- | --------------------------------------- |
| method    | string  | yes      | -       | The method name to invoke on the worker |
| params    | any     | no       | -       | Arguments for the method                |
| \_wait    | boolean | no       | true    | Whether to wait for a response          |
| \_others  | any     | no       | -       | Additional options/metadata             |

- **returns: Promise\<any\>**

```ts
// Indirectly used when you call methods on the Export object
const result = await MyWorkerExp.mtdDoWork(123);
```
