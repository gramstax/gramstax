# ThreadSub

- **Type:** Class
- **Description:** Base class for worker thread logic. Automatically manages incoming method calls and response dispatching.

## Constructor

### `new ThreadSub()`

- **Description:** Initializes the sub-thread listener. Must not be called on the main thread.
- **Returns:** `ThreadSub` instance.

## Properties

- `id`: `[number]` - The process/thread ID.
- `argv`: `[string[]]` - Arguments passed from the main thread.
- `threadIsMain`: `[boolean]` - Execution context check.

## Methods

### `sendRequest(method, params, wait?)`

- **Description:** Sends a request back to the main thread manager.
- **Params:**
  - `method`: `[string]` - Target method in the Main class.
  - `params`: `[any[]]` - Method arguments.
  - `wait`: `[boolean]` - Whether to wait for a return value.
- **Returns:** `Promise<any> | void`

### `send(payload)`

- **Description:** Sends a raw message to the main thread.
- **Params:**
  - `payload`: `[object]` - Data payload.
- **Returns:** `void`

### `kill()`

- **Description:** Terminates the current worker thread.
- **Returns:** `void`
