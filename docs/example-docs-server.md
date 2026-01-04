# Server

The `net-ipc` `Server` class extends Node's [EventEmitter](https://nodejs.org/api/events.html#class-eventemitter).

> **AI Notes (non-normative / for parsing):**
>
> - **Scope:** This section describes `Server` and `Connection` public API as presented here (constructor options, events, properties, methods).
> - **Operating modes:**
>
>   - **Socket mode:** if `options.port` is **not** provided, server uses Unix domain socket at `options.path`.
>   - **TCP mode:** if `options.port` **is** provided, server binds TCP port and listens via `port` (+ `listenOptions` optionally).
>
> - **Security mode:** `options.tls=true` enables secure server; TLS configuration is provided through `options.options` (certificate or PSK as stated).
> - **Optional features:** message encoding/decoding may be impacted by client-side options (`compress`, `messagepack`) but those toggles are not defined here in the server options list (do not assume they exist on server unless documented elsewhere).
> - **Connections:** each connected client is represented as a `Connection` instance available in `server.connections`.
> - **Error handling:** `error` event is swallowed if no listener to avoid crashing (as stated).

&nbsp;

## Constructor

### `new Server(options?)`

| parameter | type                              | required | default | description    | ai_notes                                                                                                                                   |
| --------- | --------------------------------- | -------- | ------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| options   | [Server Options](#server-options) | no       | {}      | Server options | **Object shape:** see **Server Options**. **Mode selection:** presence of `port` selects TCP mode; absence selects socket mode via `path`. |

```js
const { Server } = require("net-ipc");

const server = new Server({
  port: 4466,
});

server.on("message", (message, connection) => {
  console.log(`${message} from ${connection.id}`);
});

server.start().then(console.log).catch(console.error);
```

&nbsp;

## Server Options

> **AI Notes (non-normative / for parsing):**
>
> - **Mutual usage:**
>
>   - `port` present ⇒ TCP mode (binds TCP).
>   - `port` absent ⇒ socket mode using Unix domain socket at `path`.
>
> - `options` field below is **transport server creation options**, not the same as the top-level constructor `options`.
> - `listenOptions` affects binding/listening parameters (e.g., specific IP binding) as per Node docs.
> - `max` may limit concurrent clients; if unspecified then unlimited (as stated).

| parameter     | type    | required | default   | description                                                                                                                                                                                                                      | ai_notes                                                                                                                                                        |
| ------------- | ------- | -------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| path          | string  | no       | "net-ipc" | Unix domain socket path. If port is not provided, the server will operate in socket mode                                                                                                                                         | **Used when:** `port` is undefined/not provided. **Mode:** Unix domain socket. **Value type:** filesystem path-like string.                                     |
| port          | number  | no       | -         | TCP port to bind the server to. If provided, the server will operate in TCP mode, otherwise it will fallback to socket mode                                                                                                      | **Used when:** provided. **Mode:** TCP. **Constraints:** integer port.                                                                                          |
| tls           | boolean | no       | false     | If enabled, the server will operate in secure mode. An SSL certificate or PSK configuration will be required in the `options` field                                                                                              | **Effect:** creates TLS server. **Required config:** certificate or PSK via `options` field.                                                                    |
| options       | object  | no       | {}        | [TLSServer](https://nodejs.org/api/tls.html#tlscreateserveroptions-secureconnectionlistener) options if tls is enabled, [netServer](https://nodejs.org/api/net.html#netcreateserveroptions-connectionlistener) options otherwise | **Interpretation depends on:** `tls`. **If `tls=true`:** pass-through to `tls.createServer` options. **Else:** pass-through to `net.createServer` options.      |
| listenOptions | object  | no       | {}        | [listenOptions](https://nodejs.org/api/net.html#serverlistenoptions-callback) for advanced listener configuration such as binding to a different IP address                                                                      | **Used when:** calling listen/bind. **Examples (not exhaustive):** host, backlog, exclusive—see Node docs link.                                                 |
| max           | number  | no       | -         | Maximum number of concurrent clients the server will accept, unlimited otherwise                                                                                                                                                 | **If set:** server enforces upper bound. **If unset:** unlimited concurrent clients.                                                                            |
| retries       | number  | no       | 3         | Maximum number of retries on connection failure before rejecting an operation                                                                                                                                                    | **Scope:** "connection failure" retry count for operations that may fail due to transient connection issues. **Constraints:** non-negative integer recommended. |

&nbsp;

## Server Events

> **AI Notes (non-normative / for parsing):**
>
> - All events are emitted via EventEmitter (`server.on(eventName, handler)`).
> - Many events provide a `Connection` instance as context.
> - `error` is swallowed if no listener (as stated), meaning errors may not crash the process but can hide problems if unhandled.

### `ready`

Emitted when the server starts listening.

| params  | type   | description                                | ai_notes                                                                                                                     |
| ------- | ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| address | string | The path or url the server is listening to | **Meaning depends on mode:** socket path in socket mode; URL/host:port-like string in TCP mode (exact format not specified). |

```js
server.on("ready", (address) => {
  console.log(`server started on ${address}`);
});
```

### `error`

Emitted when an error occurs. If there is no listener, the error will be swallowed to avoid crashing the server. If no error listener is attached, all errors will be silently swallowed and the server will continue operating normally.

| params     | type                      | description                              | ai_notes                                                                                                                                |
| ---------- | ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| error      | error                     | An error instance describing the problem | **Type:** Error object instance.                                                                                                        |
| connection | [Connection](#connection) | The connection where the error happened  | **May be undefined:** if error is not tied to a single connection (not explicitly stated; treat as possibly absent in implementations). |

```js
server.on("error", (error, connection) => {
  console.log(
    `an error happened in the connection ${connection.id}: ${error.message}`
  );
  console.log(error);
});
```

### `connect`

Emitted when a new client connects. Includes the initial payload if sent by the client. This can be used for additional authorization procedures.

| params     | type                      | description                                           | ai_notes                                                                                                            |
| ---------- | ------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| connection | [Connection](#connection) | The connection instance for the client that connected | **Connection lifecycle:** represents this client; exposes methods like `.send`, `.request`, etc (documented later). |
| payload    | any                       | The initial payload sent by the client, if any        | **Origin:** `client.connect(payload)` if client sent one. **May be undefined/null** if none.                        |

```js
server.on("connect", (connection, payload) => {
  console.log(`new connection! assigned it the following id: ${connection.id}`);
  if (payload) {
    console.log(`client sent an initial payload:`);
    console.log(payload);
    /* auth example
        if(payload !== "superSecretPassword") {
            connection.close();
        }
        */
  }
});
```

### `disconnect`

Emitted when a client disconnects. Includes the reason for disconnect if one exists.

| params     | type                      | description                                              | ai_notes                                                                                                      |
| ---------- | ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| connection | [Connection](#connection) | The connection instance for the client that disconnected | **Connection may still be referenced:** but is no longer active.                                              |
| reason     | any                       | The reason for disconnection if any                      | **Source examples:** client may provide reason in `close(reason)` / `destroy(reason)`; server may also close. |

```js
server.on("disconnect", (connection, reason) => {
  console.log(`connection ${connection.id} disconnected because of:`);
  console.log(reason);
});
```

### `close`

Emitted when the server is shut down.

```js
server.on("close", () => {
  console.log("server closed");
});
```

### `message`

Emitted when the server receives a message from a client.

| params     | type                      | description                                                  | ai_notes                                      |
| ---------- | ------------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| message    | any                       | The message content                                          | **Application-level payload:** arbitrary.     |
| connection | [Connection](#connection) | The connection instance for the client that sent the message | **Identity:** use `connection.id` for sender. |

```js
server.on("message", (message, connection) => {
  console.log(`received a message from ${connection.id}:`);
  console.log(message);
});
```

### `request`

Emitted when the server receives a request from a client.

| params     | type                      | description                                                  | ai_notes                                                                |
| ---------- | ------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| request    | any                       | The request data sent by the client                          | **Request payload:** arbitrary.                                         |
| response   | asyncFunction             | A function to respond to this request                        | **Must be called to reply:** returns a Promise (example uses `.catch`). |
| connection | [Connection](#connection) | The connection instance for the client that sent the request | **Identity/context:** requester.                                        |

```js
server.on("request", (request, response, connection) => {
  console.log(`received request from ${connection.id}`);
  console.log("request content:", request);
  // return a response to this request
  response("hello").catch(console.error);
});
```

&nbsp;

## Server Properties

> **AI Notes (non-normative / for parsing):**
>
> - These are instance fields on `server`.
> - `.connections` is a live list of active connections.

### `.options`

Current server options.

- **type: object**
- **ai_notes:** expected to reflect resolved runtime options. Exact normalization rules not specified.

```js
console.log(server.options);
```

### `.connections`

An array of [Connection](#connection) instances representing currently connected clients. Connection instances also implement Client methods for independent bidirectional communication.

- **type: Array<[Connection](#connection)>**
- **ai_notes:** each entry corresponds to a connected client. Order is not specified. Connections expose methods documented under **Connection Methods**.

```js
for (const connection of server.connections) {
  console.log(connection.id);
  await connection.send("hi");
}
```

### `.server`

Internal instance of [net.Server](https://nodejs.org/api/net.html#class-netserver) if tls is disabled, or [tls.Server](https://nodejs.org/api/tls.html#class-tlsserver) if tls is enabled, for advanced usage.

- **type: [net.Server](https://nodejs.org/api/net.html#class-netserver) | [tls.Server](https://nodejs.org/api/tls.html#class-tlsserver)**
- **ai_notes:** underlying Node server object. Type depends on `options.tls`.

```js
console.log(server.server);
```

&nbsp;

## Server Methods

> **AI Notes (non-normative / for parsing):**
>
> - Methods returning Promises reject on failure unless otherwise stated.
> - `.broadcast()` explicitly states that transmission errors do **not** reject the returned Promise.

### `.start()`

Starts the server.

- **returns: Promise<[Server](#server)>**
- **ai_notes:** resolves with the `server` instance (as per return type). Emits `ready` when listening begins.

```js
server
  .start()
  .then((server) => {
    console.log("server started with options:", server.options);
  })
  .catch((e) => {
    console.log("server failed to start:", e);
  });
```

### `.close(allowReconnect)`

Gracefully disconnects all clients and closes the server. If `allowReconnect` is true, clients will attempt to auto-reconnect for a few seconds after they are disconnected. Use this if you plan to restart the server soon.

| parameter      | type    | required | default | description                                                          | ai_notes                                                                                                                    |
| -------------- | ------- | -------- | ------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| allowReconnect | boolean | no       | false   | Whether the clients should try to reconnect after being disconnected | **Client-side behavior:** depends on client auto-reconnect logic. **Time window:** "a few seconds" (not precisely defined). |

- **returns: Promise<[Server](#server)>**
- **ai_notes:** resolves after server shutdown workflow completes.

```js
server
  .close(true)
  .then((server) => {
    console.log("server closed, restarting...");
    process.exit();
  })
  .catch(console.error);
```

### `.broadcast(data)`

Sends a message to all clients. Transmission errors will be forwarded to the error event and will not reject the promise.

| parameter | type | required | default | description      | ai_notes                                                                                                                                                 |
| --------- | ---- | -------- | ------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| data      | any  | yes      | -       | The data to send | **Fan-out:** one message per connected client. **Error handling:** send failures emit `error` event; Promise does not reject due to transmission errors. |

- **returns: Promise<void>**

```js
server
  .broadcast("hello everyone")
  .then(() => {
    console.log("sent message to all clients");
  })
  .catch(console.error);
```

### `.survey(data, timeout)`

Sends a request to all clients and waits for them to respond. Returns an array of [Promise outcome](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled#using_promise.allsettled) objects.

| parameter | type   | required | default | description                                                                                  | ai_notes                                                                                                      |
| --------- | ------ | -------- | ------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| data      | any    | yes      | -       | The data to send                                                                             | **Request-response fan-out:** sends request to each connection.                                               |
| timeout   | number | no       | 10000   | How long to wait for a response from each client before giving up on them, 0 to wait forever | **Per-client timeout:** applies individually to each client response wait. **Special:** `0` disables timeout. |

- **returns: Promise<Array<[outcome](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled#using_promise.allsettled)>>**
- **ai_notes:** output aligns by index with `server.connections` as shown in example (implied by loop indexing).

```js
server
  .survey("test")
  .then((results) => {
    for (let i = 0; i < server.connections.length; i++) {
      const client = server.connections[i];
      if (results[i].status === "fulfilled") {
        console.log(
          `client id ${client.id} responded with ${results[i].value}`
        );
      } else {
        console.log(`client id ${client.id} failed to respond`);
      }
    }
  })
  .catch(console.error);
```

### `.ping(data, timeout)`

Sends a ping to all clients and waits for them to respond. Returns an array of [Promise outcome](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled#using_promise.allsettled) objects containig the ping latency values.

| parameter | type   | required | default | description                                                               | ai_notes                                                          |
| --------- | ------ | -------- | ------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| data      | any    | no       | -       | Optional data to measure the latency for                                  | **Included in ping:** if provided.                                |
| timeout   | number | no       | 10000   | How long to wait for a response from each client before giving up on them | **Per-client timeout:** applies individually. Units milliseconds. |

- **returns: Promise<Array<[outcome](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled#using_promise.allsettled)>>**
- **ai_notes:** fulfilled outcome value is ping latency number (ms) as implied by log.

```js
server
  .ping("test")
  .then((results) => {
    for (let i = 0; i < server.connections.length; i++) {
      const client = server.connections[i];
      if (results[i].status === "fulfilled") {
        console.log(`client id ${client.id} 's ping is ${results[i].value}`);
      } else {
        console.log(`client id ${client.id} failed to respond`);
      }
    }
  })
  .catch(console.error);
```

### `.pause()`

Pause receiving messages on all connections. Clients will be instructued to queue their messages.

- **returns: void**
- **ai_notes:** server stops processing incoming messages; clients should buffer outbound messages until resumed (as stated).

```js
server.pause();
```

### `.resume()`

Resume receiving messages on all connections. Queued messages will be resumed in order.

- **returns: void**
- **ai_notes:** client-side queued messages are delivered in FIFO order (as stated).

```js
server.resume();
```

&nbsp;

# Connection

An individual server-side connection. Each connected client is represented by a connection instance inside the server, which inherits several client methods for independent bidirectional communication.

> **AI Notes (non-normative / for parsing):**
>
> - **Relationship:** `Server` creates many `Connection` objects, accessible via `server.connections`.
> - **Identity:** `.id` is assigned after establishment; reconnects try to keep the same id “whenever possible”.
> - **Transport:** `.connection` is the underlying socket (`net.Socket` or `tls.TLSSocket`).

```js
server.on("connect", async (connection, payload) => {
  // connection is an instance of the Connection class and implements several client methods
  const response = await connection.request(
    "welcome! what time is it for you?"
  );
  console.log(response);

  // connections are stored in the server.connections array
  console.log(`we now have ${server.connections.length} connected clients`);
});
```

&nbsp;

## Connection Properties

### `.id`

This connection's assigned ID. All connections receive automatically assigned alphanumeric IDs once the connection has been established. Clients that disconnect and reconnect will retain their existing IDs whenever possible.

- **type: string**
- **ai_notes:** assignment occurs post-establishment; persistence across reconnect is best-effort.

```js
console.log(connection.id);
```

### `.server`

A reference to the parent [Server](#server) instance.

- **type: [Server](#server)**
- **ai_notes:** back-reference to owning server instance.

```js
console.log(connection.server);
```

### `.connection`

The connection's internal socket instance, [tls.TLSSocket](https://nodejs.org/api/tls.html#class-tlstlssocket) if tls is enabled or [net.Socket](https://nodejs.org/api/net.html#class-netsocket) otherwise.

- **type: [net.Socket](https://nodejs.org/api/net.html#class-netsocket) | [tls.TLSSocket](https://nodejs.org/api/tls.html#class-tlstlssocket)**
- **ai_notes:** underlying socket object; type depends on server TLS mode.

```js
console.log(connection.connection);
```

## Connection Methods

> **AI Notes (non-normative / for parsing):**
>
> - These methods act on a single client connection.
> - Promise-returning methods reject on failures unless stated otherwise.
> - Timeouts use milliseconds; `0` means wait forever where documented.

### `.send(data)`

Sends a message to this client.

| parameter | type | required | default | description      | ai_notes                                                |
| --------- | ---- | -------- | ------- | ---------------- | ------------------------------------------------------- |
| data      | any  | yes      | -       | The data to send | **One-to-one:** sends only to this connection’s client. |

- **returns: Promise<void>**

```js
connection
  .send("hello person!")
  .then(() => {
    console.log(`sent message to client id ${connection.id}`);
  })
  .catch(console.error);
```

### `.request(data)`

Sends a request to this client and waits for their response.

| parameter | type   | required | default | description                                          | ai_notes                                                          |
| --------- | ------ | -------- | ------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| data      | any    | yes      | -       | The data to send                                     | **Request-response:** expects a reply correlated to this request. |
| timeout   | number | no       | 10000   | How long to wait before rejecting, 0 to wait forever | **Units:** milliseconds. **Special:** `0` disables timeout.       |

- **returns: Promise<any>**
- **ai_notes:** resolves with response payload from client.

```js
connection
  .send("hello person!")
  .then(() => {
    console.log(`sent message to client id ${connection.id}`);
  })
  .catch(console.error);
```

### `.ping(data, timeout)`

Sends a ping to this client and waits for them to respond. Returns the latency value.

| parameter | type   | required | default | description                                                         | ai_notes                                                    |
| --------- | ------ | -------- | ------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| data      | any    | no       | -       | Optional data to measure the latency for                            | **Included in ping:** if provided.                          |
| timeout   | number | no       | 10000   | How long to wait for a response before rejecting, 0 to wait forever | **Units:** milliseconds. **Special:** `0` disables timeout. |

- **returns: Promise<number>**
- **ai_notes:** resolves with latency in milliseconds (as example prints `${result}ms`).

```js
connection
  .ping("test")
  .then((result) => {
    console.log(`ping for ${connection.id}: ${result}ms`);
  })
  .catch(console.error);
```

### `.pause()`

Pause receiving messages on this connection. The Client will be instructued to queue its messages.

- **returns: void**
- **ai_notes:** affects only this connection; client buffers outbound messages until resume (as stated).

```js
connection.pause();
```

### `.resume()`

Resume receiving messages on this connection. Queued messages will be resumed in order.

- **returns: void**
- **ai_notes:** buffered messages are delivered in FIFO order (as stated).

```js
connection.resume();
```

### `.close(reason, allowReconnect)`

Gracefully disconnects this client. Any pending operations will be fulfilled before the connection is closed. If `allowReconnect` is true, the client will attempt to auto-reconnect for a few seconds after they are disconnected.

| parameter      | type    | required | default | description                                                              | ai_notes                                                                                                        |
| -------------- | ------- | -------- | ------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| reason         | any     | no       | -       | The reason for disconnecting                                             | **May appear in:** server `disconnect` event reason; client `close` event reason (depending on implementation). |
| allowReconnect | boolean | no       | false   | Whether the client should try to auto-reconnect after being disconnected | **Time window:** "a few seconds" (not precisely defined). **Requires:** client auto-reconnect enabled.          |

- **returns: Promise<boolean>**
- **ai_notes:** resolves `true` if it performed disconnect, `false` if already disconnected (implied by similar client API behavior).

```js
connection
  .close("invalid password", false)
  .then((done) => {
    if (done) {
      console.log(`connection ${connection.id} successfully disconnected`);
    }
  })
  .catch(console.error);
```

### `.destroy(reason)`

Immediately disconnects this client. Any pending operations will be rejected. The client will attempt to auto-reconnect for a few seconds after they are disconnected.

| parameter | type | required | default | description                  | ai_notes                                                                                                                        |
| --------- | ---- | -------- | ------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| reason    | any  | no       | -       | The reason for disconnecting | **Immediate:** rejects pending operations. **Reconnect note:** client may attempt auto-reconnect for a few seconds (as stated). |

- **returns: boolean**
- **ai_notes:** synchronous boolean indicates whether destruction occurred (exact semantics not specified).

```js
connection.destroy("try again");
console.log(`destroyed connection ${connection.id}`);
```
