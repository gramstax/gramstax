# WorkerThreadInit

The `WorkerThreadInit` class serves as the base class for implementation on the worker thread side. It handles initialization, communication with the parent process, and gateway management.

&nbsp;

## Usage Example

```ts
import { WorkerThreadInit } from "gramstax";
import { OtherWorkerGateway } from "./other-worker";

class MyWorker extends WorkerThreadInit {
  constructor() {
    super();
    // Your initialization logic
    this.run();
  }

  // Will hidden in RPC/Gateway
  private _compute() {
    return Math.random();
  }

  async run() {
    // Calling another worker
    // Pass 'this' as the first argument to gateway methods
    const result = await OtherWorkerGateway.mtdSomeMethod(this, ["args"]);
  }

  // Method exposed to RPC/Gateway
  async mtdMyMethod() {
    return this._compute();
  }
}
```

&nbsp;

## WorkerThreadInit Properties

### .id

The thread identifier.

- **type: number**

```ts
console.log(this.id);
```

### .pid

The process identifier.

- **type: number**

```ts
console.log(this.pid);
```

### .parentPort

The `MessagePort` used to communicate with the main thread.

- **type: [MessagePort](https://nodejs.org/api/worker_threads.html#class-messageport) | null**

```ts
this.parentPort?.postMessage("Hello Parent");
```

### .rpc

The RPC handler for communicating with the main thread.

- **type: [WorkerThreadRpc](rpc.md)**

```ts
this.rpc.makeRequest("someMethod", []);
```

### .gatewayServer

The active gateway server instance, if any.

- **type: [WorkerThreadGatewayServer](gateway-server.md) | undefined**

```ts
if (this.gatewayServer) {
  /* ... */
}
```

### .gatewayClients

A map of connected gateway clients, keyed by path.

- **type: Map<string, [WorkerThreadGatewayClient](gateway-client.md)>**

```ts
const client = this.gatewayClients.get("/tmp/other.sock");
```

### .gatewayClientLatest

The most recently created gateway client.

- **type: [WorkerThreadGatewayClient](gateway-client.md) | undefined**

```ts
console.log(this.gatewayClientLatest);
```

&nbsp;

## WorkerThreadInit Methods

### .init()

Initializes the worker configuration. This is called automatically by the constructor (via `super()`) and sets up the message listener on `parentPort`.

- **returns: void**

```ts
// Called internally
this.init();
```

### .send(payload)

Sends a raw payload to the main thread without await response.

| parameter | type | required | default | description      |
| --------- | ---- | -------- | ------- | ---------------- |
| payload   | any  | yes      | -       | The data to send |

- **returns: void**

```ts
this.send({ status: "alive" });
```

### .request(method, params, \_wait, \_others)

Sends an RPC request to the main thread.

| parameter | type    | required | default | description                                |
| --------- | ------- | -------- | ------- | ------------------------------------------ |
| method    | string  | yes      | -       | The method name to call on the main thread |
| params    | any     | no       | -       | Arguments for the method                   |
| \_wait    | boolean | no       | true    | Whether to wait for a response             |
| \_others  | any     | no       | -       | Additional options/metadata                |

- **returns: Promise\<any\>**

```ts
const config = await this.request("mtdGetConfig", []);
```

### .createGatewayServer(path, methods)

Creates and starts a gateway server for this worker. This is usually wrapped in a method like `mtdStart`.

| parameter | type   | required | default | description              |
| --------- | ------ | -------- | ------- | ------------------------ |
| path      | string | yes      | -       | The socket path          |
| methods   | any    | no       | {}      | Map of methods to expose |

- **returns: Promise\<boolean\>**

```ts
// usually passed 'this' as methods to expose all class methods
await this.createGatewayServer("/tmp/worker-1", this);
```

### .createGatewayClient(path)

Creates and connects a gateway client to another worker. _Note: You typically use the typed Gateway proxy exported by `WorkerThreadExport` instead of this manually._

| parameter | type   | required | default | description                          |
| --------- | ------ | -------- | ------- | ------------------------------------ |
| path      | string | yes      | -       | The socket path of the target worker |

- **returns: Promise<[WorkerThreadGatewayClient](gateway-client.md)>**

```ts
const client = await this.createGatewayClient("/tmp/worker-2");
```
