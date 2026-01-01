# Gateway Server

The `WorkerThreadGatewayServer` manages an IPC server using `net-ipc`. It allows other workers to connect and call exported methods via gateway clients.

## Methods

### start

Starts the IPC server and awaits its readiness.

| parameter | type   | required | default | description                                  |
| --------- | ------ | -------- | ------- | -------------------------------------------- |
| path      | string | yes      | -       | Unique path for the IPC socket               |
| methods   | any    | no       | {}      | Object containing methods exposed to clients |

```typescript
const server = new WorkerThreadGatewayServer();
await server.start("my-gateway", {
  hello: (name) => `Hello ${name}!`,
});
```

&nbsp;

## Behavior

- **Ready Event**: The `start()` method is asynchronous and only resolves when the underlying `net-ipc` server emits the `ready` event.
- **Request Handling**: Incoming requests are routed to the `methods` object provided during `start`.
- **Response Management**: Method return values (including Promises) are automatically serialized and sent back to the requesting client.
