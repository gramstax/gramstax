---
title: "WorkerThreadLaunch"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md)

## WorkerThreadLaunch class

Manages worker thread lifecycle from the main thread. Handles spawning, communication, and termination of worker threads.

**Signature:**

```typescript
declare class WorkerThreadLaunch extends EventEmitter 
```
**Extends:** EventEmitter

## Remarks

Automatically registers SIGINT/SIGTERM handlers to terminate workers. Uses promise-based ready detection for synchronization. Extends `EventEmitter` — emits `ready`, `exit` and `error` lifecycle events.

## Example 1


```typescript
import { WorkerThreadLaunch } from "@gramstax/worker-thread";

async function main() {
  const worker = new WorkerThreadLaunch("./jobs/processor.ts", ["config.json"]);
  await worker.ready();
  console.log(`Worker ${worker.threadId} is ready`);

  const result = await worker.request("process", [{ data: "test" }]);
  console.log("Result:", result);

  worker.kill();
}
```

## Example 2

Initialization method for handling requests from worker threads. Both can communicate with each other using an example like this, but this is very very rarely used.

```typescript
import { WorkerThreadLaunch } from "@gramstax/worker-thread";

// main.ts
export class MainThread extends WorkerThreadLaunch {
  mtdHi() {
    // called from thread worker
    return `Hi, this is main thread`
  }
}

async function main() {
  const worker = new MainThread("./jobs/processor.ts", ["config.json"]);
  await worker.ready();
  console.log(`Worker ${worker.threadId} is ready`);
}

// jobs/processor.ts
import {MainThread} from "./main"
import {WorkerThreadInit} from "@gramstax/worker-thread";

class Worker extends WorkerThreadInit {
  constructor() {
    super();
    log.info(`Worker ${this.id} started`);
    this.request(`mtdHi`, []).then((res) => {
      res; // `Hi, this is main thread`
    })
  }
}
export const MyWorker = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
});
```

## Constructors

<table><thead><tr><th>

Constructor


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[(constructor)(path, argv, register)](./worker-thread.workerthreadlaunch._constructor_.md)


</td><td>


</td><td>

Creates a new WorkerThreadLaunch instance and spawns the worker thread.


</td></tr>
</tbody></table>

## Properties

<table><thead><tr><th>

Property


</th><th>

Modifiers


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[argv](./worker-thread.workerthreadlaunch.argv.md)


</td><td>


</td><td>

unknown\[\]


</td><td>


</td></tr>
<tr><td>

[isMainThread](./worker-thread.workerthreadlaunch.ismainthread.md)


</td><td>

`static`


</td><td>

boolean


</td><td>

Check if currently running in the main thread. Re-exported from `node:worker_threads`.


</td></tr>
<tr><td>

[path](./worker-thread.workerthreadlaunch.path.md)


</td><td>


</td><td>

string


</td><td>


</td></tr>
<tr><td>

[pid](./worker-thread.workerthreadlaunch.pid.md)


</td><td>


</td><td>

number


</td><td>

The main process ID.


</td></tr>
<tr><td>

[register?](./worker-thread.workerthreadlaunch.register.md)


</td><td>


</td><td>

Record&lt;string, (...args: never\[\]) =&gt; unknown&gt; \| undefined


</td><td>

_(Optional)_


</td></tr>
<tr><td>

[rpc](./worker-thread.workerthreadlaunch.rpc.md)


</td><td>


</td><td>

[WorkerThreadRpc](./worker-thread.workerthreadrpc.md)


</td><td>

RPC handler for method invocations.


</td></tr>
<tr><td>

[thread](./worker-thread.workerthreadlaunch.thread.md)


</td><td>


</td><td>

Worker


</td><td>

The underlying Node.js Worker instance from `node:worker_threads`.


</td></tr>
<tr><td>

[threadId](./worker-thread.workerthreadlaunch.threadid.md)


</td><td>


</td><td>

number


</td><td>

The worker thread ID.


</td></tr>
</tbody></table>

## Methods

<table><thead><tr><th>

Method


</th><th>

Modifiers


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

[handleOnMessage(data)](./worker-thread.workerthreadlaunch.handleonmessage.md)


</td><td>


</td><td>

\[LOW-LEVEL\] Handle incoming messages from the worker thread.


</td></tr>
<tr><td>

[init()](./worker-thread.workerthreadlaunch.init.md)


</td><td>


</td><td>

\[LOW-LEVEL\] Initialize the worker thread and set up message handlers.


</td></tr>
<tr><td>

[kill()](./worker-thread.workerthreadlaunch.kill.md)


</td><td>


</td><td>

Terminate the worker thread immediately.


</td></tr>
<tr><td>

[ready()](./worker-thread.workerthreadlaunch.ready.md)


</td><td>


</td><td>

Wait for the worker to signal it's ready.


</td></tr>
<tr><td>

[readyResolve()](./worker-thread.workerthreadlaunch.readyresolve.md)


</td><td>


</td><td>

\[LOW-LEVEL\] Internal method called by worker to signal readiness.


</td></tr>
<tr><td>

[request(method, params, \_wait, \_others, timeoutMs)](./worker-thread.workerthreadlaunch.request.md)


</td><td>


</td><td>

Make an RPC request to the worker thread.


</td></tr>
<tr><td>

[send(payload)](./worker-thread.workerthreadlaunch.send.md)


</td><td>


</td><td>

Send a message to the worker thread.


</td></tr>
<tr><td>

[shutdown(timeoutMs)](./worker-thread.workerthreadlaunch.shutdown.md)


</td><td>


</td><td>

Shut the worker down gracefully.


</td></tr>
</tbody></table>

