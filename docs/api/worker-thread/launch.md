# Launch

The `WorkerThreadLaunch` class represents a worker thread instance in the host thread. It handles the creation of the `Worker` instance, manages its lifecycle, and provides an RPC interface for communication.

## Properties

| property | type                             | description                          |
| -------- | -------------------------------- | ------------------------------------ |
| thread   | Worker                           | The Node.js Worker instance          |
| threadId | number                           | The unique ID assigned to the thread |
| rpc      | [WorkerThreadRpc](./docs-rpc.md) | The RPC handler instance             |

&nbsp;

## Methods

### ready

Returns a Promise that resolves when the worker thread signals it is ready (emits `mtdReady`).

### kill

Terminates the worker thread immediately.

### request

Makes a manual RPC request to the worker thread.

| parameter | type   | required | default | description                       |
| --------- | ------ | -------- | ------- | --------------------------------- |
| method    | string | yes      | -       | Method name to call in the worker |
| params    | any    | yes      | -       | Arguments for the call            |

### send

Sends a raw message to the worker thread.

| parameter | type | required | default | description                |
| --------- | ---- | -------- | ------- | -------------------------- |
| payload   | any  | yes      | -       | Data to post to the worker |

&nbsp;

## Usage

Typically, you don't instantiate this manually. Instead, use the `launchWorker` method returned by `WorkerThreadExport.init`.

```typescript
const instance = await MyWorkerExp.launchWorker();
// instance is a WorkerThreadLaunch or its extension
```
