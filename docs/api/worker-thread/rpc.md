# RPC

The `WorkerThreadRpc` class is an internal utility that manages the request-response cycle between threads. It handles message serialization, unique ID generation, and promise management for asynchronous calls.

## Properties

| property | type     | description                                                                  |
| -------- | -------- | ---------------------------------------------------------------------------- |
| map      | Map      | Stores pending requests (by ID) and their associated resolve/reject handlers |
| send     | function | The low-level transport function used to post messages                       |
| register | object   | The object instance containing the methods that can be called remotely       |

&nbsp;

## Methods

### make

Processes an incoming message. This can be either a new request (with a `method`) or a response to a previous request (with a `result` or `error`).

| parameter | type   | description             |
| --------- | ------ | ----------------------- |
| data      | object | The raw message payload |

### makeRequest

Initiates an RPC call to the other thread.

| parameter | type    | required | default | description                                                           |
| --------- | ------- | -------- | ------- | --------------------------------------------------------------------- |
| method    | string  | yes      | -       | Name of the method to invoke                                          |
| params    | any     | yes      | -       | Arguments to pass to the method                                       |
| \_wait    | boolean | no       | true    | If false, the method returns immediately without waiting for a result |

```typescript
const result = await rpc.makeRequest("add", [1, 2]);
```

### makeId

Generates a unique ID for each new request to ensure responses can be matched back to their callers.

&nbsp;

## Internals

- **Request Structure**: `{ id, method, params, ...others }`
- **Response Structure**: `{ id, result }` or `{ id, error }`
- **Error Handling**: Error objects are serialized with their `message`, `stack`, and `name` to ensure they can be re-constituted in the caller's thread.
