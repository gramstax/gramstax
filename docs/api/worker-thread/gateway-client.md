# WorkerThreadGatewayClient

The `WorkerThreadGatewayClient` class provides IPC client functionality for inter-worker communication using Unix domain sockets.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadGatewayClient` for IPC.
> - **Transport:** Uses `net-ipc` library for Unix domain socket communication.
> - **Usage:** Created via `WorkerThreadInit.createGatewayClient()`.

&nbsp;

## Constructor

### `new WorkerThreadGatewayClient()`

Creates a new gateway client instance. Typically not called directly; use `WorkerThreadInit.createGatewayClient()`.

```typescript
import { WorkerThreadGatewayClient } from "gramstax";

const client = new WorkerThreadGatewayClient();
await client.connect("/tmp/my-server.sock");
```

&nbsp;

## Properties

### `.client`

The underlying `net-ipc` Client instance.

- **type: Client**

### `.rpc`

RPC handler for messaging.

- **type: WorkerThreadRpc**

&nbsp;

## Methods

### `.connect(path)`

Connect to a gateway server.

| parameter | type   | required | description      |
| --------- | ------ | -------- | ---------------- |
| path      | string | yes      | Unix socket path |

- **returns: Promise\<WorkerThreadGatewayClient\>**
- **ai_notes:** Resolves when connection is ready.

```typescript
await client.connect("/tmp/worker-server.sock");
console.log("Connected to gateway server");
```

### `.request(method, params, wait?, others?)`

Make an RPC request to the server.

| parameter | type    | required | default | description           |
| --------- | ------- | -------- | ------- | --------------------- |
| method    | string  | yes      | -       | Server method to call |
| params    | any     | yes      | -       | Method parameters     |
| wait      | boolean | no       | `true`  | Wait for response     |
| others    | object  | no       | -       | Additional RPC data   |

- **returns: Promise\<any\>**

```typescript
const result = await client.request("ping", []);
console.log("Server responded:", result);
```

&nbsp;

## Complete Example

```typescript
import { WorkerThreadInit, WorkerThreadExport } from "gramstax";

class MyWorker extends WorkerThreadInit {
  async connectToServer() {
    // Create gateway client
    const client = await this.createGatewayClient("/tmp/server.sock");

    // Make requests
    const pong = await client.request("ping", []);
    console.log("Received:", pong);

    const data = await client.request("getData", ["key1"]);
    console.log("Data:", data);
  }
}

export const MyJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: MyWorker,
});
```
