<div align="center">
  <h1>@gramstax/worker-thread</h1>

  <p>Multi-runtime worker threads for Bun and Node.js — spawn a worker, call its methods like local async functions, and let workers talk to each other directly over a socket.</p>
  <p>
    <img alt="Bun" src="https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white"/>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=typescript&logoColor=white"/>
    <img alt="Node" src="https://img.shields.io/badge/Node-%23333933.svg?style=flat&logo=nodedotjs&logoColor=white"/>
    <img alt="License" src="https://img.shields.io/badge/License-Proprietary-lightgrey.svg"/>
  </p>
</div>

## 💡 Why this package

`node:worker_threads` gives you a channel and leaves you the rest. Spawning a worker means wiring a `MessagePort`, inventing a request id scheme, deciding what a reply looks like when it never comes, and — before any of that — figuring out how one worker reaches another, since every worker has exactly one channel and it points at the main thread.

**Main-thread calls look like async functions.** `await Job.mtdAdd(2, 3)` — the transport, the id matching, and the error propagation are somebody else's problem.

**The type is the worker's, not a copy of it.** The client is derived from the worker class, so renaming a method breaks compilation at every call site instead of failing at runtime.

**Workers reach workers.** The gateway adds the second channel `node:worker_threads` does not give you, with a shared token and a per-method allow-list so exposing a worker is a deliberate act.

**Dying is not silent.** When a worker exits, its pending calls reject instead of hanging, and `onBeforeExit()` gives you a place to flush before a graceful stop.

## ✨ Features

### Lifecycle

- 🧵 **Spawn and forget** — `launchWorker()` spawns the thread and resolves when it signals ready
- 📞 **Local-looking calls** — `await Job.mtdAdd(2, 3)` reads like an async function; the transport is someone else's problem
- 🧹 **Two kinds of stop** — `shutdown()` drains through `onBeforeExit()` before terminating; `kill()` is the immediate exit
- 📡 **Lifecycle events** — `ready`, `exit`, and `error` on the main-thread handle, so you react instead of polling

### Type safety

- 🧩 **The worker class is the contract** — `WorkerThreadExport.init()` derives the client from your real class, so a renamed method is a compile error rather than a runtime one
- 🚦 **`mtd` prefix** — only `mtd*` methods cross the boundary, keeping internals private and the exposed surface greppable

### Scale

- 🧺 **Pools** — round-robin dispatch across many workers, plus fan-out that reports per worker instead of failing as a batch
- 🌉 **Worker-to-worker gateway** — a socket channel so sibling workers talk directly, with the main thread off the hot path
- 🔌 **Cross-platform** — Unix sockets on POSIX, named pipes on Windows, path normalized for you

### Reliability & safety

- ⏱️ **Timeouts with an opt-out** — 30 s default per request; pass `0` for calls that legitimately run longer
- 💥 **Crash detection** — when a worker dies, its pending calls reject instead of hanging forever
- 🔒 **Gateway auth** — a shared token plus a per-method allow-list; exposing a worker without a list throws
- 🛡️ **Prototype-pollution guard** — `__proto__`, `constructor`, and `prototype` are refused as RPC methods
- 📏 **Message cap** — 10 MB by default, so one oversized frame cannot exhaust memory

## 🚀 Quick Start

### 1. Prerequisites

- [Bun](https://bun.sh) v1.0+ or Node.js v18+

### 2. Install

```bash
bun add @gramstax/worker-thread
```

### 3. Write the worker

One file holds both halves. The class is the worker's core, so it is named `Worker`; `WorkerThreadExport.init()` hands back the main-thread proxy, named for what the worker does. Methods reachable from the main thread carry the `mtd` prefix.

```ts
// echo-worker.ts
import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"

export class Worker extends WorkerThreadInit {
  mtdAdd(a: number, b: number) {
    return a + b
  }
}

export const EchoWorker = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker
})
```

### 4. Launch and call

`EchoWorker` is an ordinary import — `launchWorker` and every `mtd*` method are on it.

```ts
// main.ts
import {EchoWorker} from "./echo-worker"

const worker = await EchoWorker.launchWorker()
console.log(await EchoWorker.mtdAdd(2, 3)) // 5 — an RPC into the worker
await worker.shutdown()
```

### 5. Shut down cleanly

Override `onBeforeExit()` on the worker so it can drain, then `shutdown()` from the main thread. It force-terminates after 5 s if the drain hangs.

```ts
// echo-worker.ts — inside `Worker`
async onBeforeExit() {
  await this.flushState()
}

// main.ts
await worker.shutdown()
```

> **Naming**: `class Worker extends WorkerThreadInit` is the file's core, and the value returned by `WorkerThreadExport.init()` is what the main thread imports. When one file holds a server and one holds a client, both classes are called `Worker` and each export takes the role — `ServerWorker`, `ClientWorker`. The package's own `example/worker-server.ts` and `example/worker-client.ts` follow exactly this shape.

## 📖 Usage

### Lifecycle

```text
main thread:  launch → ready → request… → shutdown
worker:       constructor → signals ready → handles RPC → onBeforeExit() → terminated
```

| Phase               | How                                                       | Notes                                                  |
| :------------------ | :-------------------------------------------------------- | :----------------------------------------------------- |
| Spawn               | `launchWorker(argv?)`                                    | Extra argv is readable in the worker                   |
| Ready               | resolves automatically                                   | Rejects if the worker dies before signalling ready      |
| RPC                 | `EchoWorker.mtdAdd(…)` — any `mtd*` method on the exported proxy | The proxy is derived from the worker class, so it autocompletes and cannot drift |
| Kill                | `worker.kill()`                                           | Immediate terminate, no cleanup                        |
| Graceful            | `worker.shutdown(timeoutMs?)`                            | Runs `onBeforeExit()`, force-terminates after the timeout |

A worker can call back into the main thread. That needs a class on the **main** side, passed as `WTLaunch`, declaring the methods the worker may reach:

```ts
// main-thread.ts
import {WorkerThreadLaunch} from "@gramstax/worker-thread"

export class MainThread extends WorkerThreadLaunch {
  // `WTLaunch` calls this with `argv` possibly absent, so the constructor has
  // to declare it optional — the base class takes a required one.
  constructor(path: string, argv?: unknown[]) {
    super(path, argv ?? [])
  }

  mtdGetConfig() {
    return {feature: true}
  }
}
```

```ts
// echo-worker.ts — hand it to init() so the launch side is MainThread
import {MainThread} from "./main-thread"

export const EchoWorker = WorkerThreadExport.init({
  path: __filename,
  WTInit: Worker,
  WTLaunch: MainThread
})
```

```ts
// echo-worker.ts — inside `Worker`
const config = await this.request(`mtdGetConfig`, [])
```

Without `WTLaunch` the main-thread side is the plain `WorkerThreadLaunch`, which has no `mtd*` methods of your own and the call has nowhere to land.

### Worker pool

```ts
// main.ts — `EchoWorker` and `mtdAdd` are from the quick start above
import {WorkerThreadPool} from "@gramstax/worker-thread"
import {EchoWorker} from "./echo-worker"

const pool = new WorkerThreadPool(await Promise.all([1, 2, 3].map(() => EchoWorker.launchWorker())))
const sums = await Promise.all([1, 2, 3, 4].map((n) => pool.execute(`mtdAdd`, [n, 10])))
```

`execute` spreads calls round-robin. `broadcastRequest` fans out to every worker and rejects if any fail; `broadcastSettled` returns one result per worker, which is usually what you want for best-effort fan-out. Workers that exit are dropped from the pool automatically, and `threadCount` reflects the live ones.

### Gateway topology

**Hub** is the common shape: one worker binds a server and exposes methods, every other worker connects as a client.

```text
Worker A ──parentPort──▶ Main ◀──parentPort── Worker B
Worker A ─────── socket ─────── Worker B          (gateway, no relay)
```

**Mesh** is the advanced shape: a worker can bind *and* connect at the same time, so peers talk without a single hub. Either way the main thread stays off the inter-worker hot path — it only orchestrates lifecycle.

### Inter-worker gateway

`node:worker_threads` gives each worker exactly one channel — its `parentPort` back to the main thread. The gateway adds a second one, directly between workers.

```text
Worker A ──parentPort──▶ Main ◀──parentPort── Worker B
Worker A ─────── socket ─────── Worker B          (gateway, no relay)
```

Two files, one worker each. The server binds a socket and exposes `mtdHello`; the client connects to it. `register` is a map of plain functions — leaving it `undefined` exposes the worker instance itself, which is allowed only because a non-empty `allowedMethods` is supplied.

```ts
// worker-server.ts
import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"

export class Worker extends WorkerThreadInit {
  mtdHello(from: string) {
    return `Hello ${from}!`
  }

  async mtdStart() {
    return await this.createGatewayServer(`/tmp/server.sock`, undefined, {
      token: `shared-secret`,
      allowedMethods: [`mtdHello`]
    })
  }
}

export const ServerWorker = WorkerThreadExport.init({path: __filename, WTInit: Worker})
```

Exposing one method and nothing else is the tighter form — pass the map instead of `undefined`:

```ts
// inside `Worker`
await this.createGatewayServer(
  `/tmp/server.sock`,
  {mtdHello: (from: string): string => `Hello ${from}!`},
  {token: `shared-secret`, allowedMethods: [`mtdHello`]}
)
```

The gateway proxy **prepends the calling worker**, so `this` is always the first argument:

```ts
// worker-client.ts
import {WorkerThreadExport, WorkerThreadInit} from "@gramstax/worker-thread"
import {ServerWorker} from "./worker-server"

export class Worker extends WorkerThreadInit {
  async mtdCallServer() {
    const gateway = await ServerWorker.launchGatewayClient(`/tmp/server.sock`, {token: `shared-secret`})
    return await gateway.mtdHello(this, `ClientWorker`)
  }
}

export const ClientWorker = WorkerThreadExport.init({path: __filename, WTInit: Worker})
```

Clients reconnect automatically with exponential backoff (`reconnect: true` by default, `retries: 50`, `maxRetryTime: 500`).

## 🔍 How it works

```mermaid
flowchart TD
    Main["Main thread"] --> P["WorkerThreadExport proxy"]
    P -->|"launchWorker()"| L["WorkerThreadLaunch"]
    L -->|spawn| W["Worker thread"]
    W --> I["WorkerThreadInit"]
    P -->|"mtd* call"| I
    I -->|"result / error"| P
    I -->|"createGatewayServer"| S["Gateway server socket"]
    S --> C["Gateway client socket"]
    C --> I
```

Calls travel as JSON-RPC envelopes (`id`, `method`, `params`, `result`, `error`). The main thread sends, the worker dispatches to the matching `mtd*` method, and the reply carries a value or a structured error. `WorkerThreadRpc` does the framing, size check, timeout, and method filtering underneath — you normally never touch it.

The gateway is the same protocol over a socket instead of a thread port. That is the whole idea: one hop and one serialization, and the main thread only orchestrates lifecycle.

## 📜 Scripts

```bash
bun run build   # bundle with tsup
bun run bench   # RPC round-trip, gateway round-trip, pool benchmarks
```

## 🗂️ Project Structure

```text
packages/worker-thread/
├── src/
│   ├── init.ts             # WorkerThreadInit — worker side
│   ├── launch.ts           # WorkerThreadLaunch — main-thread handle
│   ├── export.ts           # WorkerThreadExport — typed proxy factory
│   ├── pool.ts             # WorkerThreadPool — round-robin + broadcast
│   ├── gateway-server.ts   # socket RPC server
│   ├── gateway-client.ts   # socket RPC client
│   ├── gateway-path.ts     # socket path normalization
│   ├── rpc.ts              # low-level JSON-RPC dispatcher
│   ├── error-handler.ts    # package-wide error routing
│   └── types/              # one types file per runtime module
├── example/                # runnable clusters
└── bench/                  # round-trip and pool benchmarks
```

## 🔧 Configuration

### `WorkerThreadExport.init`

The factory both instantiates the worker and returns the main-thread proxy, so one declaration serves both processes.

| Option     | Default                 | Purpose                                                                        |
| :--------- | :---------------------- | :----------------------------------------------------------------------------- |
| `path`     | **required**            | Path to the worker file — normally `__filename` for a self-referential worker  |
| `WTInit`   | **required**            | Worker class extending `WorkerThreadInit`                                     |
| `WTLaunch` | `WorkerThreadLaunch`    | Main-thread class, when you need your own `mtd*` methods on the launch side    |
| `wrap`     | —                       | Wrap the main-thread handle in a custom type                                  |

### Exported calls

```ts
await Job.launchWorker(argv?)      // spawn + wait until ready
await Job.launchGatewayClient(path, options)
await Job.shutdown(timeoutMs?)
```

`argv` items beyond the first two are readable inside the worker as `this.argv[3]...`.

### RPC per call

```ts
worker.request(method, params, wait?, others?, timeoutMs?)
```

| Argument     | Default             | Meaning                                                        |
| :----------- | :------------------ | :------------------------------------------------------------- |
| `method`     | —                   | Name of the `mtd*` method                                      |
| `params`     | `[]`                | Arguments passed positionally                                  |
| `wait`       | `true`              | Resolve when the worker answers; `false` for fire-and-forget   |
| `others`     | —                   | Broadcast to a pool instead of one worker                      |
| `timeoutMs`  | `30000`             | Reject after this many ms; **`0` disables the timeout**        |

To change the default for every call on one instance, set `rpc.defaultTimeoutMs`:

```ts
worker.rpc.defaultTimeoutMs = 60_000
```

A call that passes `0` keeps running in the worker after the caller gives up, so a naive retry double-executes it. Size the timeout to the work, not to hope.

### Gateway server

```ts
this.createGatewayServer(path, register?, {token, allowedMethods, maxConnections, maxMessageSize})
```

| Option           | Default                    | Purpose                                                       |
| :--------------- | :-------------------------- | :------------------------------------------------------------ |
| `token`          | —                          | Connections without a matching token are closed immediately   |
| `allowedMethods` | —                          | Remote call surface; **required** when `register` is the whole worker |
| `maxConnections` | `net-ipc` default          | Concurrent connection ceiling                                 |
| `maxMessageSize` | `DEFAULT_MAX_MESSAGE_SIZE` | Estimated cap in bytes for one incoming message               |

Passing `undefined` for `register` would expose the entire worker instance, so that combination throws unless a non-empty `allowedMethods` list is supplied. An empty list denies everything — it never opens anything.

### Gateway client

```ts
launchGatewayClient(path, {token, reconnect, retries, maxRetryTime, maxMessageSize, messagepack})
```

| Option           | Default                    | Purpose                                                       |
| :--------------- | :-------------------------- | :------------------------------------------------------------ |
| `token`          | —                          | Must match the server's                                       |
| `reconnect`      | `true`                     | Reconnect automatically when the connection drops              |
| `retries`        | `net-ipc` default          | Reconnect attempts before giving up                           |
| `maxRetryTime`   | `net-ipc` default          | Upper bound in ms for the exponential backoff                 |
| `maxMessageSize` | `DEFAULT_MAX_MESSAGE_SIZE` | Estimated cap in bytes for one incoming message                |
| `messagepack`    | `false`                    | Use msgpackr instead of JSON, preserving `Date`, `BigInt`, `undefined`, and typed arrays |

`retries` and `maxRetryTime` are only forwarded when you set them; otherwise `net-ipc`'s own defaults apply.

### Constants

| Constant                     | Default | Purpose                                    |
| :--------------------------- | :------ | :----------------------------------------- |
| `DEFAULT_REQUEST_TIMEOUT_MS` | `30000` | Per-request timeout in ms                  |
| `DEFAULT_MAX_MESSAGE_SIZE`   | 10 MB   | Largest payload accepted in one RPC message |
| `DENIED_RPC_METHODS`         | `__proto__`, `constructor`, `prototype`, … | Refused before dispatch      |

### Error handling

The library never writes to the console. Errors on a worker with no `error` listener go to the package-wide handler, which is silent by default:

```ts
import {WorkerThreadErrorHandler} from "@gramstax/worker-thread"

WorkerThreadErrorHandler.setDefault((err) => logger.error(err))
```

Attach it at boot, or a worker crash disappears silently.

## 🏗️ Architecture

- **The `mtd` prefix is the boundary.** Only those methods are reachable, so a refactor inside the worker cannot silently break the main thread.
- **Types flow one way.** The worker class is the single source of truth and the client is derived from it, so the two cannot drift apart.
- **Gateway is opt-in.** Single-worker apps never touch it; it exists for meshes, and it reuses the same protocol rather than inventing a second one.
- **Delivery is at-least-once.** The transport retries failed writes and replays in-flight requests across reconnects, so a handler can observe the same id twice. Request ids are monotonic per client and the server dedupes per connection — but keep handlers idempotent anyway, since responses over 64 KB are never cached.

### Gotchas

- **Only `mtd*` methods cross the boundary.** A method without the prefix is invisible to the main thread and there is no warning.
- **The gateway proxy prepends the caller.** `gateway.mtdHello(from)` becomes `gateway.mtdHello(this, from)` — the calling worker is always the first argument.
- **A custom `WTLaunch` needs an explicit constructor.** `WorkerThreadLaunch` takes a required `argv`, while `init()` may call the constructor without one, so declare `argv?: unknown[]` and forward `argv ?? []`.
- **`register` is a function map, not a worker.** Passing `this` does not typecheck; pass `undefined` to expose the instance (which then requires a non-empty `allowedMethods`), or pass `{mtdFoo: fn}` to expose only what you name.
- **Two clients cannot talk directly.** Every gateway call needs a server in between — a client is not a server.
- **Do not route main-thread work through the gateway.** It is for worker-to-worker calls; orchestration stays on `parentPort`.
- **Pool broadcast still goes through the main thread.** That is deliberate: the main thread owns lifecycle. Do not use it as a worker-to-worker path.
- **A call with `timeoutMs: 0` keeps running.** The caller stops waiting; the worker does not stop working. A naive retry double-executes it.
- **`stop()` is permanent.** A stopped worker cannot be resumed — spawn a new one.

## 📚 API Reference

| Export                         | Owns                                                                                     |
| :----------------------------- | :---------------------------------------------------------------------------------------- |
| `WorkerThreadInit`             | Worker side: RPC registration, gateway server/client, `request()` back to main, `onBeforeExit()` / `onError()`, `shutdown()` |
| `WorkerThreadLaunch`           | Main-thread handle: `launchWorker()`, `ready()`, `request()`, `kill()`, `shutdown()`, `ready`/`exit`/`error` events |
| `WorkerThreadExport.init()`    | Typed proxy factory — returns `launchWorker`, `launchGatewayClient`, and every `mtd*` method |
| `WorkerThreadPool`             | Worker registry — `execute()` round-robin, `broadcastRequest()`, `broadcastSettled()`, auto-removal of dead workers |
| `WorkerThreadRpc`              | JSON-RPC dispatcher — `makeRequest()`, `rejectAllPending()`, `use()` middleware, `context` |
| `WorkerThreadGatewayServer`    | Socket server — `start(path, register?, {token, allowedMethods, maxConnections})`, `close()` |
| `WorkerThreadGatewayClient`    | Socket client — `connect(path, {token, reconnect, …})`, `close()`                        |
| `WorkerThreadGatewayPath`      | `normalize()` — cross-platform socket path resolution                                    |
| `WorkerThreadErrorHandler`     | `setDefault()` — package-wide error routing, silent until you attach something            |

### `WorkerThreadInit` — the worker side

| Member                                  | Purpose                                                              |
| :-------------------------------------- | :------------------------------------------------------------------- |
| `mtd*` methods                          | Everything reachable from the main thread                            |
| `request(method, params, …)`            | Call back into the main thread                                       |
| `createGatewayServer(path, register?, options?)` | Bind a socket server                                            |
| `createGatewayClient(path, options?)`  | Connect to another worker's gateway                                 |
| `onBeforeExit()`                        | Override — drain hook run by `shutdown()`                           |
| `onError()`                             | Override — in-worker error surface                                   |
| `shutdown()`                            | Acknowledge a shutdown request                                      |
| `init()`, `handleOnMessage()`, `send()` | Transport internals                                                 |
| `argv`                                  | Extra arguments passed to `launchWorker(argv)`                      |

### `WorkerThreadLaunch` — the main-thread side

| Member                                            | Purpose                                                  |
| :------------------------------------------------ | :-------------------------------------------------------- |
| `launchWorker(argv?)`                             | Spawn and resolve when the worker signals ready          |
| `ready()`                                         | Rejects if the worker died before signalling ready       |
| `request(method, params, wait?, others?, timeoutMs?)` | Low-level call when you are not using the typed proxy |
| `kill()`                                          | Immediate terminate, no cleanup                          |
| `shutdown(timeoutMs?)`                            | Graceful stop; force-terminates after `timeoutMs` (5000) |
| `threadId`                                        | The worker's thread id                                   |
| `events`                                          | `ready` · `exit` · `error`                               |

### `WorkerThreadPool`

| Member                                     | Purpose                                                    |
| :----------------------------------------- | :--------------------------------------------------------- |
| `new WorkerThreadPool(instances)`         | Build from already-launched workers                        |
| `add(instance)` / `addMany(instances)`    | Grow the pool; re-adding a live `threadId` is idempotent  |
| `execute(method, params, timeoutMs?)`     | Round-robin to the next worker                            |
| `request(threadId, method, params, …)`    | Target one specific worker                                |
| `broadcastRequest(method, params, timeoutMs?)` | Fan out; rejects if any worker fails                  |
| `broadcastSettled(method, params, timeoutMs?)` | Fan out; one result per worker, never rejects on a peer |
| `getInstance(threadId)`                    | Look one up                                               |
| `kill(threadId)` / `killAll()`             | Remove one or every worker                                |
| `threadCount`                              | Live workers only — exits are dropped automatically       |

### `WorkerThreadRpc`

| Member                             | Purpose                                                     |
| :--------------------------------- | :---------------------------------------------------------- |
| `makeRequest(method, params, timeoutMs?)` | Send a request                                        |
| `rejectAllPending()`              | Fail every in-flight call — used when a worker dies         |
| `use(middleware)`                  | Request middleware chain; short-circuit by setting `ctx.result` |
| `context`                          | Object merged into every outgoing request                   |
| `defaultTimeoutMs`                 | Per-instance timeout override, default `30000`              |

Middleware can log, measure, or guard every call:

```ts
worker.rpc.use(async (ctx, next) => {
  metrics.count(`rpc.${ctx.method}`)
  await next()
})
worker.rpc.context = {traceId: `abc-123`}
```

Short-circuiting middleware — setting `ctx.result` without calling `next()` — skips dispatch and, on a gateway, also skips the `allowedMethods` guard. That escape hatch is only reachable by code that already holds the server instance.

## ✅ Testing

Workers are plain classes, so a handler can be tested without a thread:

```ts
const worker = new Worker() // echo-worker.ts — no thread needed
expect(worker.mtdAdd(2, 3)).toBe(5)
```

For the transport, `example/` holds runnable clusters:

| File                          | Demonstrates                                                          |
| :---------------------------- | :--------------------------------------------------------------------- |
| `worker-main.ts`              | Full cluster — gateway server, three pooled clients, timeout, teardown |
| `worker-server.ts`            | The gateway server half                                               |
| `worker-client.ts`            | The client half, paired with the above                                |
| `worker-main-debug.ts`        | A debug-oriented variant of the main orchestration                    |
| `test-final-main.ts`          | Integration fixture — main side                                       |
| `test-final-server-main.ts`   | Integration fixture — server side                                      |
| `test-final-worker-a.ts`      | Integration fixture — worker variant A                                 |
| `test-final-worker-b.ts`      | Integration fixture — worker variant B                                 |
| `test-final-worker-c.ts`      | Integration fixture — worker variant C                                 |

```bash
bun packages/worker-thread/example/worker-main.ts
```

That starts an authenticated gateway server, three pooled client workers, round-robin compute tasks, an RPC timeout, and a graceful teardown.

## 🚢 Deployment

- **A pool is threads, not processes** — it scales CPU work inside one process. Use separate processes when you need memory isolation.
- **Drain before you close** — shut the worker down before closing whatever it writes to, or an in-flight call lands on a closed handle.
- **The gateway is single-host** — the socket lives on the machine, so it only reaches workers on the same host.
- **Errors are silent by default** — the library never logs to the console. Attach `WorkerThreadErrorHandler.setDefault()` or listen for `error` on the handle, or failures disappear.

## 🩺 Troubleshooting

| Symptom                       | Likely cause                                  | Fix                                                         |
| :---------------------------- | :-------------------------------------------- | :---------------------------------------------------------- |
| `request is not a function`   | Method lacks the `mtd` prefix                | Rename it — the prefix is the boundary                       |
| `ready()` rejected            | Worker crashed during boot                    | Read the error event; the worker never signalled ready       |
| Caller hangs forever          | A call exceeded the timeout                   | Pass an explicit `timeoutMs`, or `0` for long tasks         |
| `__proto__ is not a function` | A method name collided with a prototype key   | Expected — it is denied on purpose; rename the method        |
| Gateway rejects the client    | Token mismatch, or path differs between hosts | Both sides need the same secret and the same resolved path   |
| `allowedMethods` required     | Exposing the whole worker instance            | Pass an explicit non-empty list — an empty list denies all    |

## 🧰 Tech Stack

- [Bun](https://bun.sh) / Node.js `worker_threads`
- [net-ipc](https://www.npmjs.com/package/net-ipc) — gateway socket transport
- [mitata](https://github.com/benoitgrelard/mitata) — benchmarks
- [tsup](https://tsup.egoist.dev) — bundler
- TypeScript in strict mode (`noUncheckedIndexedAccess`)

## 📚 Learn More

- [Worker-thread best practices](./AGENTS.md) — conventions, topology, and anti-patterns
- [`example/worker-main.ts`](./example/worker-main.ts) — a full cluster in one file
- [Node worker_threads](https://nodejs.org/api/worker_threads.html)

## 📄 License

Proprietary — Copyright (c) 2026 Gramstax. See [LICENSE](./LICENSE).
