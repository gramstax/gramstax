# @gramstax/worker-thread

Multi-runtime **worker threads** for Bun and Node.js (>= 18) with **type-safe RPC** and a **direct inter-worker gateway** over Unix sockets (named pipes on Windows).

```bash
bun add @gramstax/worker-thread
# or
npm install @gramstax/worker-thread
```

## What it gives you

| Capability | What it means |
| --- | --- |
| Worker lifecycle | Spawn workers from the main thread, wait until ready, terminate or shut down gracefully |
| Type-safe RPC | Call worker methods like local `async` functions — `await worker.mtdFoo(args)` |
| Inter-worker gateway | Workers talk to each other **directly** over a socket — the main thread is never in the hot path |
| Worker pool | Register many workers, dispatch round-robin (`execute`) or fan out to all (`broadcastRequest`) |
| Reliability | RPC timeouts, crash detection (pending calls reject automatically), lifecycle events, graceful shutdown with a drain hook |
| Security | Gateway auth tokens and per-method allow-lists |
| Cross-platform | Unix sockets on POSIX, named pipes on Windows — paths normalized automatically |

---

## Core concepts

There are three pieces to understand:

### 1. `WorkerThreadInit` — the worker side

Extend it in the **worker file**. Any method is callable from the main thread via RPC:

```typescript
// jobs/processor.ts
import { WorkerThreadInit } from "@gramstax/worker-thread";

export class ProcessorWorker extends WorkerThreadInit {
  mtdAdd(a: number, b: number) {
    return a + b;
  }
}
```

### 2. `WorkerThreadExport.init()` — the glue

A factory that detects which process it runs in and returns a **typed proxy**:

- In the worker process → instantiates your `WorkerThreadInit` class.
- In the main process → returns a proxy whose methods call into the worker.

```typescript
// jobs/processor.ts (same file, bottom)
import { WorkerThreadExport } from "@gramstax/worker-thread";

export const ProcessorJob = WorkerThreadExport.init({
  path: __filename,   // the worker file is this file
  WTInit: ProcessorWorker,
});
```

### 3. `WorkerThreadLaunch` — the main-thread handle

`launchWorker()` returns a `WorkerThreadLaunch` instance that manages the spawned thread: `ready()`, `request()`, `shutdown()`, lifecycle events.

---

## Quick start

```typescript
// main.ts
import { ProcessorJob } from "./jobs/processor";

const worker = await ProcessorJob.launchWorker();      // spawn + wait until ready
console.log(await ProcessorJob.mtdAdd(2, 3));          // 5 — RPC to the worker

await worker.shutdown();                               // graceful shutdown
```

That's the whole pattern: **launch → call methods → shutdown**.

---

## Lifecycle

```
main thread:  new WorkerThreadLaunch → spawn → ready() resolves → request()... → shutdown()
worker:       WorkerThreadInit ctor → signals ready → handles RPC → onBeforeExit() → terminated
```

| Phase | How | Notes |
| --- | --- | --- |
| **Spawn** | `launchWorker(argv?)` | Extra `argv` items are readable as `this.argv[3]...` inside the worker |
| **Ready** | `await worker.ready()` | Rejects if the worker crashes before signaling ready |
| **RPC** | `worker.request(method, params, wait?, others?, timeoutMs?)` | Or use the typed proxy: `Job.mtdFoo(...)` |
| **Kill** | `worker.kill()` | Immediate `terminate()` — no cleanup |
| **Graceful shutdown** | `worker.shutdown(timeoutMs?)` | Sends a `shutdown` RPC → worker runs `onBeforeExit()` → terminated; force-terminates after `timeoutMs` (default 5s) |

The worker can also call **back into the main thread** by extending `WorkerThreadLaunch` with methods:

```typescript
export class MainThread extends WorkerThreadLaunch {
  mtdGetConfig() {
    return { feature: true };
  }
}
// inside the worker: await this.request("mtdGetConfig", []);
```

---

## Inter-worker gateway

`node:worker_threads` gives every worker exactly one channel: its `parentPort` back to the main thread. Two sibling workers cannot talk to each other without the main thread relaying every message.

`@gramstax/worker-thread` adds a **peer-to-peer socket channel**: one worker binds a gateway server (`createGatewayServer`), other workers connect as clients (`createGatewayClient` / `launchGatewayClient`). Inter-worker calls are **one hop, one serialization** — the main thread only orchestrates lifecycle.

```
Worker A ──parentPort──▶ Main Thread ◀──parentPort── Worker B
Worker A ──▶ Unix socket ◀── Worker B        (gateway, no relay)
```

**Hub topology** (most common): one worker runs the server and exposes methods; every other worker connects as a client.

```typescript
// server-worker.ts
class ServerWorker extends WorkerThreadInit {
  mtdHello(from: string) {
    return `Hello ${from}!`;
  }

  async mtdStart() {
    return await this.createGatewayServer(
      "/tmp/server.sock",
      undefined,                                  // expose `this` (the worker instance)
      { token: "shared-secret", allowedMethods: ["mtdHello"] }  // auth + allow-list
    );
  }
}

export const Server = WorkerThreadExport.init({ path: __filename, WTInit: ServerWorker });
export const ServerGateway = Server.launchGatewayClient("/tmp/server.sock", { token: "shared-secret" });
```

```typescript
// client-worker.ts
class ClientWorker extends WorkerThreadInit {
  async mtdCallServer() {
    return await ServerGateway.mtdHello(this, "ClientWorker");   // socket RPC, no main-thread relay
  }
}

export const Client = WorkerThreadExport.init({ path: __filename, WTInit: ClientWorker });
```

```typescript
// main.ts
const server = await Server.launchWorker();
await Server.mtdStart();                    // bind the gateway socket
await Client.launchWorker();
console.log(await Client.mtdCallServer());  // "Hello ClientWorker!"
```

### Gateway security

- **`token`** — the server closes any connection that does not present the matching token (`connect(path, { token })` / `launchGatewayClient(path, { token })`).
- **`allowedMethods`** — only the listed methods are remotely callable; anything else is rejected with a clear error.
- **Required when exposing the worker** — calling `createGatewayServer(path)` without a `register` object (so the whole worker instance would be callable) **throws** unless a non-empty `allowedMethods` list is supplied. Pass the list explicitly; an empty list denies every method (never opens them).
- **`maxMessageSize`** — estimated cap in bytes for a single incoming RPC message (default 10 MB, `DEFAULT_MAX_MESSAGE_SIZE`). Oversized messages are rejected with a controlled error instead of being dispatched, so a gateway peer cannot exhaust worker memory with one framed payload. Available on both `createGatewayServer`/`GatewayServer.start` and `connect`/`createGatewayClient` options.

### Reconnect & resilience

Gateway clients reconnect **automatically** with exponential backoff when the connection drops (e.g. the server worker restarts). In-flight requests are retried transparently:

```typescript
await client.connect("/tmp/server.sock", {
  reconnect: true,      // default
  retries: 50,
  maxRetryTime: 500,    // backoff cap in ms
});
```

### Gateway reliability semantics

- **At-least-once delivery, not exactly-once.** The transport retries failed
  writes and replays in-flight requests across reconnects, and callers may
  retry timed-out requests — so a handler can observe the same RPC `id` twice.
  Request ids are monotonically increasing per client and never reused within
  a connection lifetime, so the server suppresses duplicates per connection:
  the first delivery executes, redeliveries replay the cached response
  (including redeliveries that arrive while the first copy is still running —
  they are dropped, not queued). Make handlers idempotent anyway — responses
  over 64KB are never cached (re-executed on redelivery), the cache holds at
  most 1000 entries per connection (FIFO), and it is dropped on disconnect.
- **No ordering across reconnect.** Requests sent before a drop may resolve
  after requests sent after the reconnect; never rely on cross-request order.
- **`maxMessageSize` is enforced post-buffering, not a wire-level DoS cap.**
  The full frame is already buffered by `net-ipc` before the estimate runs —
  the cap stops a peer from growing handler memory or the pending map, it does
  not stop the bytes crossing the socket (upstream `net-ipc` limitation).
- **Allow-list escape hatch.** Middleware that short-circuits (sets
  `ctx.result` without calling `next()`) skips every downstream check,
  including the `allowedMethods` guard. That is an intentional escape hatch for
  trusted in-process customization, not a vulnerability: only code that already
  holds the server instance can register such middleware.

### Structured payloads

By default the gateway uses JSON. Switch to **msgpackr** encoding to preserve `Date`, `BigInt`, `undefined` and typed arrays across the wire:

```typescript
await client.connect("/tmp/server.sock", { messagepack: true });
```

---

## Worker pool

`WorkerThreadPool` registers many workers and dispatches work:

```typescript
import { WorkerThreadPool } from "@gramstax/worker-thread";

const workers = await Promise.all([1, 2, 3].map(() => Job.launchWorker()));
const pool = new WorkerThreadPool(workers);

// Round-robin dispatch — each call goes to the next worker
const results = await Promise.all([1, 2, 3, 4].map((n) => pool.execute("mtdCompute", [n])));

// Fan out to every worker
const statuses = await pool.broadcastRequest("getStatus", []);

// Workers that exit are removed from the pool automatically
pool.threadCount; // reflects live workers only
```

---

## Reliability features

### RPC timeouts

Any `request()` can take a `timeoutMs` — the call rejects with a timeout error instead of hanging forever, and the pending entry is cleaned up:

```typescript
await worker.request("mtdSlowTask", [2000], true, undefined, 500);  // rejects after 500ms
```

Omitting `timeoutMs` applies a **30s default** (`DEFAULT_REQUEST_TIMEOUT_MS`, overridable per instance via `rpc.defaultTimeoutMs`). Pass `timeoutMs: 0` to opt a call out for genuinely long tasks — otherwise the caller rejects at 30s while the handler keeps running (a retry then double-executes). Pool `execute`/`broadcastRequest` forward their `timeoutMs` to the same default.

### Crash detection

When a worker exits, **all pending RPC requests are rejected automatically** (`Worker ... exited unexpectedly`), and `ready()` rejects if the worker crashes at boot. No more hanging callers.

### Lifecycle events

`WorkerThreadLaunch` extends `EventEmitter`:

```typescript
const worker = await Job.launchWorker();
worker.on("ready", () => console.log(`thread ${worker.threadId} ready`));
worker.on("exit", (code) => console.log(`worker exited with code ${code}`));
worker.on("error", (err) => console.error(err));
```

Errors are never written to the console by the library — without an `error`
listener they are routed to the package-wide handler (silent by default):

```typescript
import { setDefaultErrorHandler } from "@gramstax/worker-thread";

setDefaultErrorHandler((err) => logger.error(err)); // one call, all instances
```

### Graceful shutdown

```typescript
// worker-side: override the drain hook
class MyWorker extends WorkerThreadInit {
  async onBeforeExit() {
    await this.flushState();   // close connections, persist data, ...
  }
}

// main-side: worker drains, then terminates (force after 10s)
await worker.shutdown(10_000);
```

---

## Advanced: RPC middleware & context

`WorkerThreadRpc` supports a middleware chain for incoming requests (logging, metrics, guards) and a shared context merged into every outgoing request (correlation IDs):

```typescript
worker.rpc.use(async (ctx, next) => {
  console.log(`calling ${ctx.method} with ${JSON.stringify(ctx.params)}`);
  await next();                       // or: ctx.result = "short-circuit"; // skip dispatch
});

worker.rpc.context = { traceId: "abc-123" };  // included in all outgoing payloads
```

---

## API reference

| Export | Description |
| --- | --- |
| `WorkerThreadInit` | Base class for worker implementations — RPC register, gateway server/client, `onBeforeExit()` / `onError()` hooks, `shutdown()` |
| `WorkerThreadLaunch` | Main-thread handle — spawn, `ready()`, `request(..., timeoutMs?)`, `kill()`, `shutdown()`, `ready`/`exit`/`error` events |
| `WorkerThreadExport.init()` | Typed proxy factory — returns `launchWorker`, `launchGatewayClient` and worker methods |
| `WorkerThreadPool` | Worker registry — `execute()` round-robin, `broadcastRequest()`, auto-removal of dead workers |
| `WorkerThreadRpc` | JSON-RPC dispatcher — `makeRequest(..., timeoutMs?)`, `rejectAllPending()`, `use()` middleware, `context` |
| `WorkerThreadGatewayServer` | Socket server — `start(path, register?, { token, allowedMethods, maxConnections })`, `close()` |
| `WorkerThreadGatewayClient` | Socket client — `connect(path, { token, reconnect, retries, maxRetryTime, messagepack })`, `close()` |
| `normalizeGatewayPath` | Normalize socket paths for Windows named pipes |
| `setDefaultErrorHandler` | Package-wide error handler for errors without instance listeners (silent by default — the library never logs to the console) |

## Run the examples

The `example/` folder contains runnable clusters showcasing the features:

```bash
bun packages/worker-thread/example/worker-main.ts
```

This starts an authenticated gateway server worker, three client workers in a pool, runs round-robin compute tasks, demonstrates an RPC timeout, and shuts everything down gracefully.

## License

Proprietary — Copyright (c) 2026 Gramstax. See [LICENSE](./LICENSE).
