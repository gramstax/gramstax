# Gateway Client

The `WorkerThreadGatewayClient` is used by a worker thread to connect to a gateway server in another worker thread. It provides a simple `request` method for inter-worker RPC.

## Methods

### connect

Connects to a gateway server and awaits its readiness.

| parameter | type   | required | default | description                       |
| --------- | ------ | -------- | ------- | --------------------------------- |
| path      | string | yes      | -       | Path of the target gateway server |

### request

Makes an RPC request to the connected gateway server.

| parameter | type    | required | default | description                 |
| --------- | ------- | -------- | ------- | --------------------------- |
| method    | string  | yes      | -       | Method name to call         |
| params    | any     | yes      | -       | Arguments for the call      |
| \_wait    | boolean | no       | true    | Whether to await a response |

```typescript
const client = new WorkerThreadGatewayClient();
await client.connect("my-gateway");
const response = await client.request("hello", ["Gramstax"]);
```

&nbsp;

## Integration

Typically, this is handled automatically via `WorkerThreadExport.gateway` or `WorkerThreadInit.createGatewayClient`.

- **Ready Event**: The `connect()` method is asynchronous and only resolves when the client successfully connects and emits the `ready` event.
