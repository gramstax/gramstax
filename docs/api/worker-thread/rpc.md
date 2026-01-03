# WorkerThreadRpc

The `WorkerThreadRpc` class implements the Remote Procedure Call mechanism used by both workers and the main thread to exchange messages and execute methods asynchronously.

_Note: This is a low-level underlying class automatically handled by `WorkerThreadInit` and `WorkerThreadLaunch`._

&nbsp;

## WorkerThreadRpc Properties

### .map

A map storing pending requests, keyed by their request ID.

- **type: Map<any, { resolve: Function, reject: Function }>**

```ts
console.log(rpc.map.size);
```

### .send

The function used to transmit data (requests or responses).

| parameter | type | required | default | description      |
| --------- | ---- | -------- | ------- | ---------------- |
| data      | any  | yes      | -       | raw payload data |

- **type: (data: any) => any**

```ts
rpc.send({ method: "ping" });
```

&nbsp;

## WorkerThreadRpc Methods

### .make(data)

Processes an incoming message (Request, Result, or Error).

| parameter | type | required | default | description          |
| --------- | ---- | -------- | ------- | -------------------- |
| data      | any  | yes      | -       | The incoming message |

- **returns: Promise\<void\>**

```ts
on("message", (msg) => rpc.make(msg));
```

### .makeId()

Generates a random unique identifier for requests.

- **returns: number**

```ts
const id = rpc.makeId();
```

### .makeRequest(method, params, \_wait, \_others)

Initiates an RPC call.

| parameter | type    | required | default | description                    |
| --------- | ------- | -------- | ------- | ------------------------------ |
| method    | string  | yes      | -       | The method name to call        |
| params    | any     | no       | -       | Arguments for the method       |
| \_wait    | boolean | no       | true    | Whether to wait for a response |
| \_others  | any     | no       | -       | Additional options/metadata    |

- **returns: Promise\<any\>**

```ts
await rpc.makeRequest("method", []);
```
