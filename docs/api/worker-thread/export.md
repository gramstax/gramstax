# WorkerThreadExport

The `WorkerThreadExport` class acts as the main entry point for creating, wrapping, and managing worker threads. It provides static methods to initialize worker configurations and create gateway proxies for inter-thread communication.

&nbsp;

## Usage Example

### 1. Define the Worker (server.ts)

```ts
import { WorkerThreadInit, WorkerThreadExport } from "gramstax";
import { fileURLToPath } from "url";

class Core extends WorkerThreadInit {
  static gatewayPath = `server`;

  constructor() {
    super();
    console.log(`[worker:server] Worker has been launch.`);
  }

  mtdHello(from: string) {
    console.log(`[worker:server] Received greeting from: ${from}`);
    return `Hello ${from}, I am worker server!`;
  }

  async mtdStart() {
    // Running server with gatewayPath
    await this.createGatewayServer(Core.gatewayPath, this);
    console.log(
      `[worker:server] Server gateway '${Core.gatewayPath}' is active.`
    );
    return true;
  }
}

// Export the initialized worker configuration for main thread (worker <---> main)
export const ServerService = WorkerThreadExport.init({
  path: fileURLToPath(import.meta.url),
  WTInit: Core,
});

// Export a Gateway for other workers to use (worker <---> worker)
export const ServerGatewayService = ServerService.gateway(Core.gatewayPath);
```

### 2. Other Worker Usage (client.ts)

```ts
import { WorkerThreadInit, WorkerThreadExport } from "gramstax";
import { ServerGatewayService } from "./server";

class Core extends WorkerThreadInit {
  async interact() {
    // Call method on ServerService (worker) via Gateway
    // Note: 'this' (current worker instance) is passed as the first argument
    const res = await ServerGatewayService.mtdHello(this, "Client");
    console.log(res);
  }
}

export const ClientService = WorkerThreadExport.init({
  path: fileURLToPath(import.meta.url),
  WTInit: Core,
});
```

### 3. Main Thread Control (main.ts)

```ts
import { ServerService } from "./server";
import { ClientService } from "./client";

async function main() {
  // Launch the worker
  await ServerService.launchWorker(["arg1", "arg2"]);
  await ServerService.mtdStart();

  await ClientService.launchWorker(["arg1", "arg2"]);
  await ClientService.interact();

  const response = await ServerService.mtdHello("main thread");
  console.log(response);
}
```

&nbsp;

## WorkerThreadExport Methods

### .init(options)

Initializes a worker thread configuration. This is the primary method to define your worker module.

| parameter | type                                            | required | default | description                                               |
| --------- | ----------------------------------------------- | -------- | ------- | --------------------------------------------------------- |
| options   | [WorkerThreadExportOpt](#workerthreadexportopt) | yes      | -       | Configuration options including path and class definition |

- **returns: Proxy<[WorkerThreadLaunch](launch.md) & TWrap & AsyncMethods<TWorker>>**

```ts
const MyWorker = WorkerThreadExport.init({
  path: fileURLToPath(import.meta.url),
  WTInit: Core,
});
```

### .gateway(path)

Creates a gateway proxy from an initialized export. This proxy allows other workers to call methods on this worker.

| parameter | type   | required | default | description                                      |
| --------- | ------ | -------- | ------- | ------------------------------------------------ |
| path      | string | yes      | -       | The unique path identifier for the target worker |

- **returns: Proxy<AsyncMethods<TWorker>>**

```ts
const MyWorkerGateway = MyWorker.gateway("/path/to/worker");
```

&nbsp;

## WorkerThreadExportOpt

Configuration object for `WorkerThreadExport.init`.

| parameter | type     | required | default                         | description                                                                      |
| --------- | -------- | -------- | ------------------------------- | -------------------------------------------------------------------------------- |
| path      | string   | yes      | -                               | The absolute path to the worker file                                             |
| WTInit    | class    | yes      | -                               | The class extending [WorkerThreadInit](init.md) that defines worker logic        |
| WTLaunch  | class    | no       | [WorkerThreadLaunch](launch.md) | A custom class extending [WorkerThreadLaunch](launch.md) for main thread control |
| wrap      | function | no       | -                               | A function to wrap the main thread instance, allowing for custom behavior        |

```ts
const options = {
  path: fileURLToPath(import.meta.url),
  WTInit: Core,
  WTLaunch: WorkerThreadLaunch,
  wrap: (main) => ({ customMethod: () => main.send("custom") }),
};
```
