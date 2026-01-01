# Export

The `WorkerThreadExport` class is the primary entry point for exporting worker thread functionality and managing inter-worker communication. It provides methods for initializing worker exports and creating typed gateway proxies.

## Methods

### init

Initializes a worker thread export. This method handles both main-thread and worker-thread logic based on the environment.

| parameter | type                              | required | default | description                          |
| --------- | --------------------------------- | -------- | ------- | ------------------------------------ |
| options   | [Export Options](#export-options) | yes      | -       | Configuration options for the export |

#### Export Options

| parameter | type                                         | required | default              | description                                                             |
| --------- | -------------------------------------------- | -------- | -------------------- | ----------------------------------------------------------------------- |
| path      | string                                       | yes      | -                    | Absolute path to the worker file (use `fileURLToPath(import.meta.url)`) |
| WTInit    | [WorkerThreadInit](./docs-init.md) class     | yes      | -                    | The class implementation for the worker                                 |
| WTLaunch  | [WorkerThreadLaunch](./docs-launch.md) class | no       | `WorkerThreadLaunch` | Custom launcher class                                                   |
| wrap      | function                                     | no       | -                    | Optional manual RPC wrapper                                             |

```typescript
import { WorkerThreadExport } from "gramstax";
import { fileURLToPath } from "url";

export const MyWorkerExp = WorkerThreadExport.init({
  path: fileURLToPath(import.meta.url),
  WTInit: MyWorkerClass,
});

// Main thread usage:
// const instance = await MyWorkerExp.launchWorker();
// await MyWorkerExp.someMethod();
```

&nbsp;

### gateway

Creates a type-safe gateway client proxy for inter-worker communication.

| parameter | type   | required | default | description                                |
| --------- | ------ | -------- | ------- | ------------------------------------------ |
| path      | string | yes      | -       | The name/path of the target gateway server |

```typescript
// Define the gateway proxy
export const MyGateway = MyWorkerExp.gateway("my-service");

// Inside another worker:
// Usage 1: Static-like
const result = await MyGateway.hello(this, "World");

// Usage 2: Constructor-based
const myService = new MyGateway(this);
await myService.hello("World");
```

&nbsp;

## Returned Object Properties

Building on the results of `init`, the returned object includes all methods from the worker class (proxied as async) plus:

### launchWorker

Launches the worker thread and awaits its readiness.

| parameter | type  | required | default | description                           |
| --------- | ----- | -------- | ------- | ------------------------------------- |
| argv      | any[] | no       | []      | Arguments passed to the worker thread |

### gateway

A helper method to create a gateway proxy specifically for this worker's type.

| parameter | type   | required | default | description           |
| --------- | ------ | -------- | ------- | --------------------- |
| path      | string | yes      | -       | The gateway path name |
