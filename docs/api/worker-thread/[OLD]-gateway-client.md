> **Documentation Info**
>
> - **Last Updated:** 16/01/2026 18:09:06

> - **Framework Version:** v0.5.3

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

| parameter | type   | required | description                               |
| --------- | ------ | -------- | ----------------------------------------- |
| path      | string | yes      | Unix socket path. Matches server gateway. |

- **returns: Promise\<WorkerThreadGatewayClient\>**
- **description:** Resolves when connection is ready.

```typescript
await client.connect("/tmp/worker-server.sock");
console.log("Connected to gateway server");
```

### `.request(method, params, wait?, others?)`

Make an RPC request to the server.

| parameter | type    | required | default | description                                       |
| --------- | ------- | -------- | ------- | ------------------------------------------------- |
| method    | string  | yes      | -       | Server method to call. Targets server RPC method. |
| params    | any     | yes      | -       | Method parameters. Sent as positional array.      |
| wait      | boolean | no       | `true`  | Wait for response. If false, fire-and-forget.     |
| others    | object  | no       | -       | Additional RPC data. Merged into RPC payload.     |

- **returns: Promise\<any\>**
- **description:** Resolves with server response.

```typescript
const result = await client.request("ping", []);
console.log("Server responded:", result);
```

&nbsp;

## Usage

```typescript
// ./worker/server.ts
import { WorkerThreadInit, WorkerThreadExport } from "gramstax";

export class Worker extends WorkerThreadInit {
  static gatewayServerPath = `gateway-main`;

  constructor() {
    super();
  }

  mtdHello(from: string) {
    console.log(`[Worker-Server] Received greeting from: ${from}`);
    return `Hello ${from}, I am Worker-Server!`;
  }

  async mtdStart() {
    const res = await this.createGatewayServer();
    console.log(
      `[Worker-Server] Gateway '${this.gatewayServerPath}' is active.`
    );
    return res;
  }
}

export const WorkerServer = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
export const WorkerServerGateway = WorkerServer.launchGatewayClient();

// ./worker/client.ts
import { WorkerThreadInit, WorkerThreadExport } from "gramstax";
import { WorkerServerGateway } from "./server";

class Worker extends WorkerThreadInit {
  async mtdTest() {
    const data = await WorkerServerGateway.mtdHello(`worker client`);
    console.log("Data:", data);
  }
}

export const WorkerClient = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});

// ./main.ts
import { WorkerServer } from "./worker/server";
import { WorkerClient } from "./worker/client";

await WorkerServer.launchWorker(); // launch worker server
await WorkerClient.launchWorker(); // launch worker client

await WorkerServer.mtdStart(); // launch server gateway
await WorkerClient.mtdTest(); // call mtdHello to WorkerServer in mtdTest from WorkerClient
```
