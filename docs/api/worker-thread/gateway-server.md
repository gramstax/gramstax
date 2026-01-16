> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 18:09:06

> - **Framework Version:** v0.5.3

# WorkerThreadGatewayServer

The `WorkerThreadGatewayServer` class provides IPC server functionality for inter-worker communication using Unix domain sockets.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadGatewayServer` for IPC.
> - **Transport:** Uses `net-ipc` library for Unix domain socket communication.
> - **Multi-client:** Supports connections from multiple gateway clients.
> - **Usage:** Created via `WorkerThreadInit.createGatewayServer()`.

&nbsp;

## Constructor

### `new WorkerThreadGatewayServer()`

Creates a new gateway server instance. Typically not called directly; use `WorkerThreadInit.createGatewayServer()`.

```typescript
import { WorkerThreadGatewayServer } from "gramstax";

const server = new WorkerThreadGatewayServer();
await server.start("/tmp/my-server.sock", {
  ping: () => "pong",
});
```

&nbsp;

## Properties

### `.server`

The underlying `net-ipc` Server instance.

- **type: Server**

### `.rpc`

Map of RPC handlers per connection.

- **type: Map\<string, WorkerThreadRpc\>**
- **description:** Key is the connection ID.

### `.methods`

Methods exposed to clients.

- **type: object**

&nbsp;

## Methods

### `.start(path, methods?)`

Start the gateway server.

| parameter | type   | required | default | description                                                |
| --------- | ------ | -------- | ------- | ---------------------------------------------------------- |
| path      | string | yes      | -       | Unix socket path to bind. Gateway path identifier.         |
| methods   | object | no       | `{}`    | Methods to expose to clients. Called by connected clients. |

- **returns: Promise\<WorkerThreadGatewayServer\>**
- **description:** Resolves when server is ready.

```typescript
await server.start("/tmp/data-worker.sock", {
  ping: () => "pong",
  getData: (key) => database.get(key),
  setData: (key, value) => database.set(key, value),
});
console.log("Gateway server started");
```

&nbsp;

## Server Events

The underlying `net-ipc` server emits these events:

- **`connect`**: New client connected
- **`disconnect`**: Client disconnected
- **`message`**: Message received from client
- **`error`**: Server error occurred

&nbsp;

## Usage

```typescript
// worker-a.ts (Server)
class Worker extends WorkerThreadInit {
  static gatewayServerPath = "/tmp/worker-a.sock";
  data = { count: 0 };

  constructor() {
    super();
  }

  async mtdRunServer() {
    return await this.createGatewayServer();
  }

  mtdGetCount() {
    return this.data.count;
  }

  mtdIncrement() {
    return (this.data.count += 1);
  }
}

// for interact between worker to main
export const WorkerA = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
// for interact between worker to worker
export const WorkerAGateway = Worker.gatewayServerPath();

// worker-b.ts (Client)
import { WorkerAGateway } from "./worker-a";

class WorkerB extends WorkerThreadInit {
  async mtdConnectToA() {
    const count = await WorkerAGateway.mtdGetCount();
    console.log("Count from Worker A:", count);
  }
}

// main.ts (Main Thread)
import { WorkerA } from "./worker-a";
import { WorkerB } from "./worker-a";

await WorkerA.launchWorker(); // launch worker-a
await WorkerB.launchWorker(); // launch worker-b
await WorkerA.mtdRunServer(); // run server with trigger in main thread
await WorkerB.mtdConnectToA(); // run with trigger in main thread
```
