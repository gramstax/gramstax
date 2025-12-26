# ThreadMain

- **Type:** Class
- **Description:** Manages the life cycle of a Worker thread and handles bi-directional JSON-RPC communication.

## Constructor

### `new ThreadMain(path, argv?)`

- **Description:** Initializes a new Bun Worker thread.
- **Params:**
  - `path`: `[string]` - Absolute path or URL to the worker script.
  - `argv`: `[any[]]` - Optional arguments passed to the worker (accessible via `process.argv`).
- **Returns:** `ThreadMain` instance.

## Properties

- `id`: `[number]` - The thread ID assigned by Bun.
- `sub`: `[Worker]` - The underlying Bun Worker instance.
- `map`: `[Map]` - Internal request-response tracker.

## Methods

### `sendRequest(method, params, wait?)`

- **Description:** Sends a named request to the worker.
- **Params:**
  - `method`: `[string]` - Method name in the target `ThreadSub`.
  - `params`: `[any[]]` - Arguments for the method.
  - `wait`: `[boolean]` - If true (default), returns a Promise.
- **Returns:** `Promise<any> | void`
- **Example:** `await main.sendRequest("task", [1, 2]);`

### `send(payload)`

- **Description:** Sends a raw JSON-RPC payload to the worker.
- **Params:**
  - `payload`: `[object]` - The data to send.
- **Returns:** `void`

### `kill()`

- **Description:** Terminates the worker thread immediately.
- **Returns:** `void`

### `clone(argv?)`

- **Description:** Asynchronously creates a new instance using the same script path.
- **Params:**
  - `argv`: `[any[]]` - Arguments for the new thread.
- **Returns:** `Promise<ThreadMain>`
