> **Documentation Info**
>
> - **Last Updated:** Monday, January 12, 2026 at 09:00:00 AM (UTC+07:00)
> - **Framework Version:** v0.3.17

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
- **ai_notes:** Key is the connection ID.

### `.methods`

Methods exposed to clients.

- **type: object**

&nbsp;

## Methods

### `.start(path, methods?)`

Start the gateway server.

| parameter | type   | required | default | description                  | ai_notes                     |
| --------- | ------ | -------- | ------- | ---------------------------- | ---------------------------- |
| path      | string | yes      | -       | Unix socket path to bind     | Gateway path identifier.     |
| methods   | object | no       | `{}`    | Methods to expose to clients | Called by connected clients. |

- **returns: Promise\<WorkerThreadGatewayServer\>**
- **ai_notes:** Resolves when server is ready.

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

## Complete Example

```typescript
import { WorkerThreadInit, WorkerThreadExport, log } from "gramstax";

class DataWorker extends WorkerThreadInit {
  private store = new Map<string, any>();

  constructor() {
    super();
    this.startServer();
  }

  async startServer() {
    await this.createGatewayServer("/tmp/data-worker.sock", {
      ping: () => "pong",

      get: (key: string) => {
        return this.store.get(key);
      },

      set: (key: string, value: any) => {
        this.store.set(key, value);
        return true;
      },

      delete: (key: string) => {
        return this.store.delete(key);
      },

      keys: () => {
        return Array.from(this.store.keys());
      },
    });

    log.info("Data worker gateway server started");
  }
}

export const DataJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: DataWorker,
});
```

&nbsp;

## Inter-Worker Communication Example

```typescript
// worker-a.ts (Server)
class WorkerA extends WorkerThreadInit {
  data = { count: 0 };

  constructor() {
    super();
    this.createGatewayServer("/tmp/worker-a.sock", {
      getCount: () => this.data.count,
      increment: () => ++this.data.count,
    });
  }
}

// worker-b.ts (Client)
class WorkerB extends WorkerThreadInit {
  async connectToA() {
    const client = await this.createGatewayClient("/tmp/worker-a.sock");

    await client.request("increment", []);
    const count = await client.request("getCount", []);
    console.log("Count from Worker A:", count);
  }
}
```

## Usage

```typescript
import { WorkerThreadGatewayServer } from "gramstax";

const server = new WorkerThreadGatewayServer();
await server.start("/tmp/data-worker.sock", {
  ping: () => "pong",
});
```
