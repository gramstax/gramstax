> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 12:24:00

> - **Framework Version:** v0.5.1

# WorkerThreadInit

The `WorkerThreadInit` class is the base class for worker thread implementations. It handles communication with the main thread and provides RPC functionality.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadInit` base class for worker threads.
> - **Usage:** Extend this class when defining worker thread behavior.
> - **Communication:** Uses `parentPort` for messaging with main thread.

&nbsp;

## Constructor

### `new WorkerThreadInit()`

Initializes the worker thread, sets up message handling, and signals readiness to the main thread.

```typescript
import { WorkerThreadInit } from "gramstax";

class MyWorker extends WorkerThreadInit {
  constructor() {
    super(); // Required - signals ready to main thread
    // Your initialization code
  }
}
```

&nbsp;

## Static Properties

### `.isMainThread`

Check if currently running in the main thread.

- **type: boolean**
- **description:** Re-exported from `node:worker_threads`.

```typescript
if (WorkerThreadInit.isMainThread) {
  console.log("Running in main thread");
} else {
  console.log("Running in worker thread");
}
```

### `.gatewayServerPath`

Path gateway server. (if need server gateway you can overrides)

- **type: string | undefined**
- **description:** Overrides if need gateway server`.

&nbsp;

## Instance Properties

### `.argv`

Command line arguments passed to the worker.

- **type: string[]**
- **description:** Same as `process.argv`. Custom args start at index 3.

### `.id`

The worker thread ID.

- **type: number**
- **description:** From `node:worker_threads` `threadId`.

### `.pid`

The process ID.

- **type: number**
- **description:** Same as `process.pid`.

### `.rpc`

RPC handler for method invocations.

- **type: WorkerThreadRpc**

### `.parentPort`

Reference to the parent port for messaging.

- **type: MessagePort | null**
- **description:** From `node:worker_threads`.

### `.gatewayServer`

Gateway server instance if created.

- **type: WorkerThreadGatewayServer | undefined**

### `.gatewayServerPath`

Path gateway server from static .gatewayServerPath.

- **type: string | undefined**

### `.gatewayClients`

Map of gateway clients for inter-worker communication.

- **type: Map\<string, WorkerThreadGatewayClient\>**

### `.gatewayClient`

The most recently created gateway client.

- **type: WorkerThreadGatewayClient | undefined**

&nbsp;

## Methods

### `.send(payload)`

Send a message to the main thread.

| parameter | type | required | description                           |
| --------- | ---- | -------- | ------------------------------------- |
| payload   | any  | yes      | Data to send. Payload to main thread. |

- **returns: void**
- **description:** No return value.

```typescript
this.send({ status: "processing", progress: 50 });
```

### `.request(method, params, wait?, others?)`

Make an RPC request to the main thread.

| parameter | type    | required | default | description                                          |
| --------- | ------- | -------- | ------- | ---------------------------------------------------- |
| method    | string  | yes      | -       | Method name to call. Targets main-thread RPC method. |
| params    | any     | yes      | -       | Method parameters. Sent as positional array.         |
| wait      | boolean | no       | `true`  | Wait for response. If false, fire-and-forget.        |
| others    | object  | no       | -       | Additional RPC data. Merged into RPC payload.        |

- **returns: Promise\<any\>**
- **description:** Resolves with main-thread response.

```typescript
const result = await this.request("getConfig", ["key"]);
```

### `.createGatewayServer(path, methods?)`

Create a gateway server for inter-worker communication.

| parameter | type   | required | default                            | description                                                       |
| --------- | ------ | -------- | ---------------------------------- | ----------------------------------------------------------------- |
| methods   | object | no       | this                               | Methods with value function to expose. Called by gateway clients. |
| path      | string | no       | this.constructor.gatewayServerPath | Unix socket path. Gateway identifier.                             |

- **returns: Promise\<boolean\>**
- **description:** Resolves when gateway is ready.

```typescript
// recomended
await this.createGatewayServer(); // method will automatic set with default "this" and path will automatic get from "this.gatewayServerPath"

// not recomended
await this.createGatewayServer(
  {
    ping: () => "pong",
  },
  "/tmp/my-worker.sock"
);
```

### `.createGatewayClient(serverPath)`

Create a gateway client to connect to another worker. (not recomended, use init "launchGatewayClient" from export directly from source)

| parameter  | type   | required | description                                          |
| ---------- | ------ | -------- | ---------------------------------------------------- |
| serverPath | string | yes      | Unix socket path to connect. Matches server gateway. |

- **returns: Promise\<WorkerThreadGatewayClient\>**
- **description:** Resolves with connected client.

```typescript
// set path directly
const client = await this.createGatewayClient("/tmp/other-worker.sock");
const result = await client.request("ping", []);
```

&nbsp;

## Usage

```typescript
// ./worker/my.ts
import { WorkerThreadInit, WorkerThreadExport, log } from "gramstax";

class Worker extends WorkerThreadInit {
  private data: Map<string, any> = new Map();

  constructor() {
    super();
    log.info(`Worker ${this.id} started with PID ${this.pid}`);
  }

  mtdSet(key: string, value: any) {
    this.data.set(key, value);
    return true;
  }

  mtdGet(key: string) {
    return this.data.get(key);
  }

  mtdGetAll() {
    return Object.fromEntries(this.data);
  }
}

export const MyWorker = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});

// main.ts
// in main thread area
import { MyWorker } from "./worker/my";

await MyWorker.launchWorker(); // launch first (required)
await MyWorker.mtdSet(`name`, `damar`); // true

const data = await MyWorker.mtdGet(`name`);
console.log(data); // damar
```
