# Pool

The `WorkerThreadPool` class manages a collection of `WorkerThreadLaunch` instances, providing utilities for grouped operations like broadcasting and centralized request management.

## Properties

| property    | type                            | description                                     |
| ----------- | ------------------------------- | ----------------------------------------------- |
| thread      | Map<number, WorkerThreadLaunch> | Map of thread ID to launcher instances          |
| threadCount | number                          | Total number of initialized threads in the pool |

&nbsp;

## Methods

### add

Adds a single worker instance to the pool.

| parameter | type                                   | required | default | description                |
| --------- | -------------------------------------- | -------- | ------- | -------------------------- |
| instance  | [WorkerThreadLaunch](./docs-launch.md) | yes      | -       | The worker instance to add |

### addMany

Adds multiple worker instances to the pool.

| parameter | type                                     | required | default | description               |
| --------- | ---------------------------------------- | -------- | ------- | ------------------------- |
| instances | [WorkerThreadLaunch[]](./docs-launch.md) | yes      | -       | Array of worker instances |

### getInstance

Retrieves a worker instance by its thread ID.

| parameter | type   | required | default | description      |
| --------- | ------ | -------- | ------- | ---------------- |
| threadId  | number | yes      | -       | Target thread ID |

### kill / killAll

Terminates specific or all workers in the pool and removes them from the map.

### broadcastRequest

Sends the same RPC request to all workers in the pool.

| parameter | type   | required | default | description            |
| --------- | ------ | -------- | ------- | ---------------------- |
| method    | string | yes      | -       | Method name to call    |
| params    | any    | yes      | -       | Arguments for the call |

### request

Sends an RPC request to a specific worker in the pool.

| parameter | type   | required | default | description            |
| --------- | ------ | -------- | ------- | ---------------------- |
| threadId  | number | yes      | -       | Target thread ID       |
| method    | string | yes      | -       | Method name to call    |
| params    | any    | yes      | -       | Arguments for the call |
