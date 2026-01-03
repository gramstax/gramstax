# WorkerThreadGatewayClient

The `WorkerThreadGatewayClient` class manages the client-side connection to a `WorkerThreadGatewayServer` via `net-ipc`.

_Note: This is an internal class used by the Gateway Proxy. You typically do not interact with it directly._

&nbsp;

## WorkerThreadGatewayClient Properties

### .client

The underlying `net-ipc` Client instance used for communication.

- **type: [Client](https://www.npmjs.com/package/net-ipc)**

```ts
console.log(client.client);
```

### .rpc

The `WorkerThreadRpc` instance handling the request/response cycle.

- **type: [WorkerThreadRpc](rpc.md)**

```ts
console.log(client.rpc);
```

&nbsp;

## WorkerThreadGatewayClient Methods

### .connect(path)

Establishes a connection to the specified socket path.

| parameter | type   | required | default | description                                      |
| --------- | ------ | -------- | ------- | ------------------------------------------------ |
| path      | string | yes      | -       | The Unix socket path or identifier to connect to |

- **returns: Promise<[WorkerThreadGatewayClient](gateway-client.md)>**

```ts
await client.connect("/tmp/socket");
```

### .request(method, params, \_wait, \_others)

Sends a remote procedure call to the connected gateway.

| parameter | type    | required | default | description                                          |
| --------- | ------- | -------- | ------- | ---------------------------------------------------- |
| method    | string  | yes      | -       | The name of the method to invoke on the server       |
| params    | any     | no       | -       | Arguments to pass to the method                      |
| \_wait    | boolean | no       | true    | Whether to await the response or fire-and-forget     |
| \_others  | any     | no       | -       | Additional metadata to send with the request payload |

- **returns: Promise\<any\>**

```ts
await client.request("mtdHello", ["world"]);
```
