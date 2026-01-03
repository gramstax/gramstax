# WorkerThreadPool

The `WorkerThreadPool` class manages a collection of `WorkerThreadLaunch` instances, allowing for bulk operations like broadcasting requests or managing multiple workers via a single interface.

&nbsp;

## Usage Example

```ts
import { WorkerThreadPool } from "gramstax";
import { MyWorkerExp } from "./worker";

const w1 = await MyWorkerExp.launchWorker();
const w2 = await MyWorkerExp.launchWorker();
const pool = new WorkerThreadPool([w1, w2]);

await pool.broadcastRequest("mtdHello", ["World"]);
```

&nbsp;

## WorkerThreadPool Properties

### .thread

A Map storing the worker instances, keyed by their `threadId`.

- **type: Map<number, [WorkerThreadLaunch](launch.md)>**

```ts
console.log(pool.thread.size);
```

### .threadCount

The number of workers currently in the pool.

- **type: number**

```ts
console.log(pool.threadCount);
```

&nbsp;

## WorkerThreadPool Methods

### .add(instance)

Adds a single worker instance to the pool.

| parameter | type                            | required | default | description                |
| --------- | ------------------------------- | -------- | ------- | -------------------------- |
| instance  | [WorkerThreadLaunch](launch.md) | yes      | -       | The worker instance to add |

- **returns: void**

```ts
pool.add(workerInstance);
```

### .addMany(instances)

Adds multiple worker instances to the pool.

| parameter | type                              | required | default | description               |
| --------- | --------------------------------- | -------- | ------- | ------------------------- |
| instances | [WorkerThreadLaunch](launch.md)[] | yes      | -       | Array of worker instances |

- **returns: void**

```ts
pool.addMany([w1, w2]);
```

### .getInstance(threadId)

Retrieves a worker instance by its thread ID.

| parameter | type   | required | default | description          |
| --------- | ------ | -------- | ------- | -------------------- |
| threadId  | number | yes      | -       | The ID of the thread |

- **returns: [WorkerThreadLaunch](launch.md) | undefined**

```ts
const worker = pool.getInstance(1);
```

### .kill(threadId)

Terminates a specific worker and removes it from the pool.

| parameter | type   | required | default | description          |
| --------- | ------ | -------- | ------- | -------------------- |
| threadId  | number | yes      | -       | The ID of the thread |

- **returns: number | undefined**

```ts
pool.kill(1);
```

### .killAll()

Terminates all workers in the pool.

- **returns: void**

```ts
pool.killAll();
```

### .broadcastRequest(method, params)

Sends an RPC request to all workers in the pool and awaits all responses.

| parameter | type   | required | default | description               |
| --------- | ------ | -------- | ------- | ------------------------- |
| method    | string | yes      | -       | The method name to invoke |
| params    | any    | no       | -       | Arguments for the method  |

- **returns: Promise\<any[]\>**

```ts
await pool.broadcastRequest("mtdPing", []);
```

### .request(threadId, method, params, \_wait, \_others)

Sends an RPC request to a specific worker in the pool.

| parameter | type    | required | default | description                    |
| --------- | ------- | -------- | ------- | ------------------------------ |
| threadId  | number  | yes      | -       | The ID of the target thread    |
| method    | string  | yes      | -       | The method name to invoke      |
| params    | any     | no       | -       | Arguments for the method       |
| \_wait    | boolean | no       | true    | Whether to wait for a response |
| \_others  | any     | no       | -       | Additional options             |

- **returns: Promise\<any\>**

```ts
await pool.request(1, "mtdWork", []);
```
