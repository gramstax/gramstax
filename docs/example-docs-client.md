# Client

The `net-ipc` `Client` class extends Node's [EventEmitter](https://nodejs.org/api/events.html#class-eventemitter).

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This document describes the `Client` public API surface as shown here (constructor options, events, properties, methods).
> - **Transport modes:**
>
>   - **Socket mode:** when `options.host` is **not** provided, the client connects using Unix domain socket path via `options.path`.
>   - **TCP mode:** when `options.host` **is** provided, the client connects using `options.host` + `options.port`.
>
> - **Security mode:** `options.tls=true` enables TLS; server must support secure mode or be behind SSL proxy.
> - **Optional features with dependencies:** `compress` requires `fast-zlib`; `messagepack` requires `msgpackr`.
> - **Reconnection:** controlled by `reconnect`, `retries`, `maxRetryTime`. Wording indicates these affect both connection and individual messages (as stated below).

&nbsp;

## Constructor

### `new Client(options?)`

| parameter | type                              | required | default | description    | ai_notes                                                                                                                                   |
| --------- | --------------------------------- | -------- | ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| options   | [Client Options](#client-options) | no       | {}      | Client options | **Object shape:** see **Client Options**. **Mode selection:** presence of `host` selects TCP mode; absence selects socket mode via `path`. |

```js
const { Client } = require("net-ipc");

const client = new Client({
    host: 364.24.253.23,
    port: 4466
});

client.on("message", message => {
    console.log(`received message from server:`, message);
})

client.connect().then(console.log).catch(console.error);
```

&nbsp;

## Client Options

> **AI Notes (non-normative / for parsing):**
>
> - **Mutual usage:**
>
>   - `host` present ⇒ **TCP mode** uses `host` + `port` (+ `tls` optionally).
>   - `host` absent ⇒ **Socket mode** uses `path` (Unix domain socket).
>
> - `options` field below is **transport-layer socket options**, not the same as the top-level constructor `options`. It maps to `tls.TLSSocket` options when TLS is enabled, otherwise to `net.Socket` options.

| parameter    | type    | required | default   | description                                                                                                                                                                                     | ai_notes                                                                                                                                                                  |
| ------------ | ------- | -------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| path         | string  | no       | "net-ipc" | Unix domain socket path. If a host is not provided, the client will connect using socket mode                                                                                                   | **Used when:** `host` is undefined/not provided. **Mode:** Unix domain socket. **Value type:** filesystem path-like string.                                               |
| host         | string  | no       | -         | Domain name or IP address to connect using TCP mode (without http/https/etc)                                                                                                                    | **Used when:** provided. **Mode:** TCP. **Constraints:** must be hostname or IP without scheme prefix.                                                                    |
| port         | number  | no       | 4466      | Port number to use when connecting using TCP mode                                                                                                                                               | **Used when:** `host` is provided. **Constraints:** integer port.                                                                                                         |
| tls          | boolean | no       | false     | If enabled, the client will connect in secure mode. The server must also be running in secure mode or be behind an SSL proxy                                                                    | **Effect:** switches underlying connection to TLS. **Dependency:** server-side must support or be proxied. **Also changes:** meaning of `options` (socket options) below. |
| handshake    | boolean | no       | false     | If enabled, the client simulate a websocket handshake for compatibility with http/https proxies                                                                                                 | **Purpose:** proxy compatibility. **Behavior:** "simulate a websocket handshake" as stated; exact handshake content not specified here.                                   |
| options      | object  | no       | {}        | [tls.TLSSocket](https://nodejs.org/api/tls.html#class-tlstlssocket) options if tls is enabled or [net.Socket](https://nodejs.org/api/net.html#class-netsocket) options otherwise                | **Interpretation depends on:** `tls`. **If `tls=true`:** pass-through to `tls.TLSSocket` options. **Else:** pass-through to `net.Socket` options.                         |
| compress     | boolean | no       | false     | If enabled, all messages will be compressed using a shared zlib context (requires installing `fast-zlib`)                                                                                       | **Dependency:** `fast-zlib` package must be installed. **Scope:** "all messages" (both directions implied, but not explicitly stated).                                    |
| messagepack  | boolean | no       | false     | if enabled, all messages will be serialized using messagepack instead of json (requires installing `msgpackr`)                                                                                  | **Dependency:** `msgpackr` package must be installed. **Scope:** serialization format replaces JSON.                                                                      |
| reconnect    | boolean | no       | true      | Whether the client should attempt to auto-reconnect on failure                                                                                                                                  | **When triggered:** connection failure/disconnect scenarios. **Interaction:** limited by `retries` and backoff capped by `maxRetryTime`.                                  |
| retries      | number  | no       | 3         | Maximum number of retries before giving up (affects both connections and individual messages)                                                                                                   | **Scope (as stated):** applies to connection attempts and to individual message operations. **Constraints:** non-negative integer recommended.                            |
| maxRetryTime | number  | no       | 10000     | Maximum waiting time between each retry (the waiting time starts at 500ms, increasing by 500ms for each subsequent failure, but never exceeding this maximum, until the retry limit is reached) | **Backoff rule (as stated):** start at 500ms, +500ms each failure, cap at `maxRetryTime`, stop after `retries`. **Units:** milliseconds.                                  |

&nbsp;

## Client Events

> **AI Notes (non-normative / for parsing):**
>
> - All events are emitted via EventEmitter (`client.on(eventName, handler)`).
> - `error` may be swallowed if no listener exists (as documented).
> - `close` indicates permanent closure (server-instructed or retries exhausted).

### `ready`

Emitted when the client connects to the server. Includes a server assigned id and information about the connection.

| params   | type   | description                      | ai_notes                                                                                     |
| -------- | ------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| response | object | Information about the connection | **Payload contains:** server-assigned id + connection info (exact shape not specified here). |

```js
client.on("ready", (connection) => {
  console.log(`connected to server`, connection);
});
```

### `error`

Emitted when an error occures. If there is no listener, the error will be swallowed but the connection might still be closed depending on the error, in which case the error will be included in the `close` event as the reason for closing.

| params | type  | description                              | ai_notes                                                                                                            |
| ------ | ----- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| error  | error | An error instance describing the problem | **Type:** Error object instance. **No-listener behavior:** may be swallowed; closure reason may surface in `close`. |

```js
client.on("error", (error) => {
  console.error(error);
});
```

### `close`

Emitted when the connection is closed permanently, either when instructed by the server or after exhausting all reconnection attempts. Includes the reason for closing if any.

| params | type | description                   | ai_notes                                                                                    |
| ------ | ---- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| reason | any  | The reason for closing if any | **Nullable/optional semantics:** "if any" implies may be undefined/null depending on cause. |

```js
client.on("close", (reason) => {
  console.log("connection was closed. reason:", reason);
});
```

### `status`

Emitted when the connection suffers a status change, including disconnections and reconnections. Statuses include:

IDLE: 0
CONNECTING: 1
CONNECTED: 2
READY: 3
DISCONNECTED: 4
RECONNECTING: 5

| params | type   | description    | ai_notes                                                                                                                   |
| ------ | ------ | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| status | number | the new status | **Enum values:** 0..5 mapping listed above. **Event frequency:** emitted on any transition (connect/disconnect/reconnect). |

```js
client.on("status", (status) => {
  console.log(`status changed: ${status}`);
});
```

### `message`

Emitted when the client receives a message from a server.

| params  | type | description         | ai_notes                                                                                             |
| ------- | ---- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| message | any  | The message content | **Codec depends on:** `compress` / `messagepack` settings. **Application-level payload:** arbitrary. |

```js
client.on("message", (message) => {
  console.log("received message", message);
});
```

### `request`

Emitted when the client receives a request from a server.

| params   | type          | description                           | ai_notes                                                                                            |
| -------- | ------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| request  | any           | The message content                   | **Incoming request payload:** arbitrary.                                                            |
| response | asyncFunction | A function to respond to this request | **Must be awaited:** example awaits `response(...)`. **Return value of `response`:** not specified. |

```js
client.on("request", async (request, response) => {
  console.log("received request from the server:", request);
  await response("acknowledged");
});
```

&nbsp;

### Client Properties

> **AI Notes (non-normative / for parsing):**
>
> - Properties are instance fields on `client`.
> - `.id` is assigned after connecting (server-assigned), therefore may be undefined before `ready`.

### `.id`

The ID assigned to the client by the server after connecting.

- **type: string**
- **availability:** after `ready` (implied by “after connecting”)
- **ai_notes:** server-controlled identifier; do not assume stable across sessions.

```js
console.log(client.id);
```

### `.status`

The client's current status. Statuses include:

IDLE: 0
CONNECTING: 1
CONNECTED: 2
READY: 3
DISCONNECTED: 4
RECONNECTING: 5

- **type: number**
- **ai_notes:** numeric enum; align with `status` event values.

```js
console.log(client.status);
```

### `.options`

The client's current options.

- **type: object**
- **ai_notes:** expected to reflect resolved runtime options. Exact normalization rules not specified.

```js
console.log(client.options);
```

### `.connection`

The client's internal instance of [tls.TLSSocket](https://nodejs.org/api/tls.html#class-tlstlssocket) if tls is enabled or [net.Socket](https://nodejs.org/api/net.html#class-netsocket) otherwise.

- **type: [net.Socket](https://nodejs.org/api/net.html#class-netsocket) | [tls.TLSSocket](https://nodejs.org/api/tls.html#class-tlstlssocket)**
- **ai_notes:** underlying transport socket object. Type depends on `options.tls`.

```js
console.log(client.connection);
```

&nbsp;

### Client Methods

> **AI Notes (non-normative / for parsing):**
>
> - All methods below operate on an instance `client`.
> - Methods returning Promises reject on failure (as shown in examples).
> - Retry behavior may apply where documented globally by `retries` (“affects both connections and individual messages”).

### `.connect(payload)`

Connects to the server and optionally sends an initial payload.

| parameter | type | required | default | description                          | ai_notes                                                                                                                                             |
| --------- | ---- | -------- | ------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| payload   | any  | no       | -       | Initial data to send when connecting | **Sent timing:** during connect handshake/initialization (exact ordering not specified). **Codec:** affected by `compress`/`messagepack` if enabled. |

- **returns: Promise<[Client](#client)>**
- **ai_notes:** resolves with the `client` instance (as per return type). Connect mode depends on `host`/`path`.

```js
client
  .connect("hello")
  .then(() => {
    console.log("sent initial payload");
  })
  .catch(console.error);
```

### `.send(data)`

Sends a message to the server.

| parameter | type | required | default | description  | ai_notes                                                                                                                                          |
| --------- | ---- | -------- | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| data      | any  | yes      | -       | Data to send | **Fire-and-forget semantics:** sends a message; does not wait for server reply. **Retry scope:** may be affected by `retries` as stated globally. |

- **returns: Promise<void>**
- **ai_notes:** promise resolves when sending is considered complete by the library (exact internal meaning not specified).

```js
client
  .send("hello")
  .then(() => {
    console.log("sent hello");
  })
  .catch(console.error);
```

### `.request(data, timeout)`

Sends a request to the server.

| parameter | type   | required | default | description                                                         | ai_notes                                                                                                |
| --------- | ------ | -------- | ------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| data      | any    | yes      | -       | Data to send                                                        | **Request-response pattern:** expects server reply correlated to this request.                          |
| timeout   | number | no       | 10000   | How long to wait for a response before rejecting, 0 to wait forever | **Units:** milliseconds (implied by examples and other time values). **Special:** `0` disables timeout. |

- **returns: Promise<any>**
- **ai_notes:** resolves with response payload from server. Response decoding affected by `messagepack`/`compress` if enabled.

```js
client
  .request("what time is it?")
  .then((response) => {
    console.log(`server responded with: ${response}`);
  })
  .catch(console.error);
```

### `.ping(data, timeout)`

Sends a ping request to the server and waits for a response.

| parameter | type | required | default | description                                          | ai_notes                                                                                                         |
| --------- | ---- | -------- | ------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| data      | any  | no       | -       | Optional data to measure the latency for             | **If provided:** included in ping request (as stated).                                                           |
| timeout   | any  | no       | 10000   | How long to wait before rejecting, 0 to wait forever | **Note:** docs say `timeout` type is `any`; behavior described as time value. **Special:** `0` disables timeout. |

- **returns: Promise<number>**
- **ai_notes:** resolves with ping latency in milliseconds (as example prints `${ping}ms`).

```js
client
  .ping("", 5000)
  .then((ping) => {
    console.log(`current ping: ${ping}ms`);
  })
  .catch(console.error);
```

### `.close(reason)`

Gracefully disconnects the client. Any pending operations will be fulfilled before the connection is closed.

| parameter | type | required | default | description                  | ai_notes                                                                                                                   |
| --------- | ---- | -------- | ------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| reason    | any  | no       | -       | The reason for disconnecting | **Propagation:** reason may appear in `close` event (implied by event doc). **Graceful:** waits for pending ops to finish. |

- **returns: Promise<boolean>**
- **ai_notes:** resolves `true` if it performed a disconnect, `false` if already disconnected (as implied by example comment).

```js
client
  .close("shutting down")
  .then((done) => {
    if (done) {
      console.log(`successfully disconnected`);
    } else {
      /* no-op... already disconnected? */
    }
  })
  .catch(console.error);
```

### `.destroy(reason)`

Immediately disconnects the client. Any pending operations will be rejected.

| parameter | type | required | default | description                  | ai_notes                                                                                         |
| --------- | ---- | -------- | ------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| reason    | any  | no       | -       | The reason for disconnecting | **Immediate:** does not wait for pending ops. **Error handling:** pending promises are rejected. |

- **returns: boolean**
- **ai_notes:** synchronous return indicates whether destruction occurred (exact semantics not specified).

```js
client.destroy("shutting down");
console.log("disconnected");
```
