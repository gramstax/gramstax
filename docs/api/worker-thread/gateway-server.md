# WorkerThreadGatewayServer

The `WorkerThreadGatewayServer` class creates a server that exposes specific methods to other worker threads via IPC.

&nbsp;

## WorkerThreadGatewayServer Properties

### .server

The underlying `net-ipc` Server instance.

- **type: [Server](https://www.npmjs.com/package/net-ipc)**

```ts
console.log(server.server);
```

### .rpc

A map of connected client IDs to their respective `WorkerThreadRpc` instances.

- **type: Map<string, [WorkerThreadRpc](rpc.md)>**

```ts
console.log(server.rpc.size);
```

### .methods

The object containing the methods exposed to clients.

- **type: any**

```ts
console.log(server.methods);
```

&nbsp;

## WorkerThreadGatewayServer Methods

### .start(path, methods)

Starts the server on the specified path and exposes the provided methods.

| parameter | type   | required | default | description                                    |
| --------- | ------ | -------- | ------- | ---------------------------------------------- |
| path      | string | yes      | -       | The Unix socket path to listen on              |
| methods   | any    | no       | {}      | An object containing the methods to be exposed |

- **returns: Promise<[WorkerThreadGatewayServer](gateway-server.md)>**

```ts
// Usually called within WorkerThreadInit subclass
class Core extends WorkerThreadInit {
  static gatewayPath = `<...>`;
  public constructor() {
    super();
  }
  async mtdStart() {
    await this.createGatewayServer(Core.gatewayPath, this);
  }
}
```
