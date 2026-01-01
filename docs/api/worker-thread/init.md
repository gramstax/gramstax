# Init

The `WorkerThreadInit` class is the base class for all worker implementations. It manages the worker's lifecycle, including RPC setup, gateway server creation, and inter-worker client management.

## Properties

| property       | type                                                               | description                        |
| -------------- | ------------------------------------------------------------------ | ---------------------------------- |
| argv           | string[]                                                           | Arguments passed to the thread     |
| id             | number                                                             | The thread ID                      |
| rpc            | [WorkerThreadRpc](./docs-rpc.md)                                   | The RPC handler instance           |
| gatewayServer  | [WorkerThreadGatewayServer](./docs-gateway-server.md)              | The active gateway server (if any) |
| gatewayClients | Map<string, [WorkerThreadGatewayClient](./docs-gateway-client.md)> | Connected gateway clients          |

&nbsp;

## Methods

### createGatewayServer

Starts an IPC gateway server within the worker.

| parameter | type   | required | default | description                                         |
| --------- | ------ | -------- | ------- | --------------------------------------------------- |
| path      | string | yes      | -       | Unique path for the gateway socket                  |
| methods   | any    | no       | {}      | Object containing methods to expose via the gateway |

### createGatewayClient

Connects to a gateway server in another worker.

| parameter | type   | required | default | description                       |
| --------- | ------ | -------- | ------- | --------------------------------- |
| path      | string | yes      | -       | Path of the target gateway server |

### send

Sends a raw message to the parent thread.

| parameter | type | required | default | description                     |
| --------- | ---- | -------- | ------- | ------------------------------- |
| payload   | any  | yes      | -       | Data to send to the host thread |

### request

Makes a manual RPC request to the host thread.

| parameter | type   | required | default | description                     |
| --------- | ------ | -------- | ------- | ------------------------------- |
| method    | string | yes      | -       | Method name to call in the host |
| params    | any    | yes      | -       | Arguments for the call          |

&nbsp;

## Lifecycle

1. **Constructor**: Sets up RPC and notifies the parent thread of readiness via `mtdReady`.
2. **Init**: Listens for messages from the parent thread.
3. **HandleMessage**: Routes incoming messages to the RPC handler.
