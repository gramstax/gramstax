# WorkerThreadRpc

The `WorkerThreadRpc` class handles JSON-RPC style communication between threads.

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `WorkerThreadRpc` class for RPC handling.
> - **Protocol:** Uses simple JSON-RPC style messages with `id`, `method`, `params`, `result`, `error`.
> - **Internal:** Typically used internally by `WorkerThreadInit` and `WorkerThreadLaunch`.

&nbsp;

## Constructor

### `new WorkerThreadRpc(send, register)`

| parameter | type     | required | description                  |
| --------- | -------- | -------- | ---------------------------- |
| send      | function | yes      | Function to send data        |
| register  | object   | yes      | Object with callable methods |

```typescript
import { WorkerThreadRpc } from "gramstax";

const rpc = new WorkerThreadRpc((data) => postMessage(data), {
  add: (a: number, b: number) => a + b,
  multiply: (a: number, b: number) => a * b,
});
```

&nbsp;

## Properties

### `.map`

Map of pending requests by ID.

- **type: Map\<any, { resolve, reject }\>**
- **ai_notes:** Stores promise handlers for pending requests.

### `.send`

Function used to send messages.

- **type: (data: any) => any**

### `.register`

Object containing registered methods.

- **type: Record\<string, Function\>**

&nbsp;

## Methods

### `.make(data)`

Process an incoming RPC message.

| parameter | type   | required | description        |
| --------- | ------ | -------- | ------------------ |
| data      | object | yes      | RPC message object |

- **returns: Promise\<void\>**
- **ai_notes:** Handles requests, results, and errors.

**Message Types:**

1. **Request:** `{ id, method, params }` - Calls registered method and sends result/error back.
2. **Result:** `{ id, result }` - Resolves pending request promise.
3. **Error:** `{ id, error }` - Rejects pending request promise.

```typescript
// Handle incoming message
worker.on("message", (data) => {
  rpc.make(data);
});
```

### `.makeId()`

Generate a unique request ID.

- **returns: number**
- **ai_notes:** Uses `Math.random()`.

```typescript
const id = rpc.makeId();
```

### `.makeRequest(method, params, wait?, others?)`

Create and send an RPC request.

| parameter | type    | required | default | description                |
| --------- | ------- | -------- | ------- | -------------------------- |
| method    | string  | yes      | -       | Method name to call        |
| params    | any     | yes      | -       | Method parameters          |
| wait      | boolean | no       | `true`  | Wait for response          |
| others    | object  | no       | -       | Additional data to include |

- **returns: Promise\<any\>**
- **ai_notes:** If `wait=false`, returns result of `send()` directly.

```typescript
// Wait for response
const result = await rpc.makeRequest("add", [1, 2]);
console.log(result); // 3

// Fire and forget
rpc.makeRequest("log", ["message"], false);
```

&nbsp;

## Message Protocol

### Request Message

```typescript
{
  id: number,      // Unique request ID
  method: string,  // Method name to call
  params: any      // Parameters to pass
}
```

### Result Message

```typescript
{
  id: number,      // Request ID
  result: any      // Return value
}
```

### Error Message

```typescript
{
  id: number,
  error: {
    message: string,
    stack?: string,
    name: string
  }
}
```

&nbsp;

## Complete Example

```typescript
import { WorkerThreadRpc } from "gramstax";

// Define methods
const methods = {
  async processData(data: number[]) {
    return data.reduce((a, b) => a + b, 0);
  },

  getInfo() {
    return { pid: process.pid, time: Date.now() };
  },
};

// Create RPC handler
const rpc = new WorkerThreadRpc(
  (data) => parentPort.postMessage(data),
  methods
);

// Handle incoming messages
parentPort.on("message", (data) => {
  rpc.make(data);
});
```
