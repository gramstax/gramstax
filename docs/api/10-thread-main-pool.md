# ThreadMainPool

- **Type:** Class
- **Description:** Manages a collection of `ThreadMain` instances for orchestrating multiple workers.

## Constructor

### `new ThreadMainPool(instances)`

- **Description:** Creates a pool from an array of thread instances or promises.
- **Params:**
  - `instances`: `[(ThreadMain | Promise<ThreadMain>)[]]` - Local thread instances.
- **Returns:** `ThreadMainPool` instance.

## Properties

- `thread`: `[object]` - Dictionary of threads by ID.
- `threadCount`: `[number]` - Total active threads in the pool.

## Methods

### `add(instance)`

- **Description:** Registers a new thread in the pool.
- **Params:**
  - `instance`: `[ThreadMain]` - The thread manager to add.
- **Returns:** `void`

### `getInstance(id)`

- **Description:** Retrieves a thread instance by its ID.
- **Params:**
  - `id`: `[number]` - Thread ID.
- **Returns:** `ThreadMain | undefined`

### `broadcastRequest(method, params)`

- **Description:** Sends a request to all threads in the pool simultaneously.
- **Params:**
  - `method`: `[string]` - Method name.
  - `params`: `[any[]]` - Arguments.
- **Returns:** `Promise<any[]>`

### `kill(id)`

- **Description:** Kills and removes a specific thread from the pool.
- **Params:**
  - `id`: `[number]` - Thread ID.
- **Returns:** `number | undefined`

### `killAll()`

- **Description:** Terminates all threads managed by this pool.
- **Returns:** `number[]`
