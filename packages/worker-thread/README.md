# @gramstax/worker-thread

Multi-runtime worker thread utilities with RPC and Unix socket gateway. Works in **Bun** and **Node.js** (>=18).

## Features

- Worker thread lifecycle management (`WorkerThreadInit`, `WorkerThreadLaunch`)
- Type-safe RPC via proxy (`WorkerThreadExport.init`)
- Inter-worker gateway over Unix domain sockets (`WorkerThreadGatewayServer/Client`)
- Worker pool with broadcast (`WorkerThreadPool`)
- JSON-RPC over `node:worker_threads` `parentPort`

## Runtime Support

| Runtime | Status       | Notes               |
| ------- | ------------ | ------------------- |
| Bun     | ✅ Supported | `>= 1.0.0` — native |
| Node.js | ✅ Supported | `>= 18` — native    |

**Transport**: In-worker IPC uses `node:worker_threads`. Inter-worker gateway uses Unix domain sockets via the `net-ipc` library, which works on both Bun and Node.js.

**Dependencies**: One runtime dep — [`net-ipc`](https://www.npmjs.com/package/net-ipc) — for the Unix-socket gateway transport.

## Install

```bash
bun add @gramstax/worker-thread
# or
npm install @gramstax/worker-thread
```

## The Problem: Default `node:worker_threads` Has No Direct Worker-to-Worker Channel

`node:worker_threads` workers are isolated. Each worker has exactly one channel — its `parentPort` back to the thread that spawned it. There is no built-in way for two sibling workers to talk to each other; every message has to be relayed through the main thread.

```mermaid
flowchart TB
    subgraph vanilla["Vanilla node:worker_threads"]
        MT[Main Thread]
        W1[Worker A]
        W2[Worker B]
        W3[Worker C]
    end

    MT <-->|parentPort<br/>JSON-RPC| W1
    MT <-->|parentPort<br/>JSON-RPC| W2
    MT <-->|parentPort<br/>JSON-RPC| W3

    W1 -.->|❌ no direct channel| W2
    W2 -.->|❌ no direct channel| W3
    W1 -.->|❌ no direct channel| W3
```

**Consequences:**

- Main thread becomes a **forced message broker** for all inter-worker traffic
- Every cross-worker call costs **two hops** (sender → main → receiver) and **two serializations**
- Main-thread event loop becomes a **bottleneck** — if it stalls, all worker-to-worker traffic stalls too
- Adds **latency** and **back-pressure** on the central thread

## The Solution: Unix-Socket Gateway Side-Channels

`@gramstax/worker-thread` adds a **peer-to-peer transport** on top of `node:worker_threads`. The transport is **client–server** under the hood (via `net-ipc`): one side calls `createGatewayServer()` to bind a socket, the other side calls `createGatewayClient(path)` to connect. The main thread is no longer required to relay messages between siblings.

**Hub topology (most common):** one worker runs the gateway server and exposes its methods; every other worker (and the main thread) connects to it as a client. No main-thread relay on the hot path.

```mermaid
flowchart TB
    subgraph solved["With @gramstax/worker-thread — hub topology"]
        MT[Main Thread<br/>WorkerThreadLaunch + Pool]
        W1[Worker A<br/>Init + GatewayClient]
        W2["Worker B<br/>Init + GatewayServer<br/>exposes mtdHello, mtdGetData, ..."]
        W3[Worker C<br/>Init + GatewayClient]
    end

    MT <-->|parentPort<br/>JSON-RPC| W1
    MT <-->|parentPort<br/>JSON-RPC| W2
    MT <-->|parentPort<br/>JSON-RPC| W3

    W1 -->|"Unix socket<br/>net-ipc<br/>(client → server)"| W2
    W3 -->|"Unix socket<br/>net-ipc<br/>(client → server)"| W2
```

**Mesh topology (advanced):** any worker can be **both** a server and a client at the same time — just call `createGatewayServer()` and `createGatewayClient(peerPath)` on the same instance. That gives you a full peer-to-peer mesh where every worker can expose methods to its peers and call into them.

```mermaid
flowchart TB
    subgraph mesh["With @gramstax/worker-thread — mesh topology"]
        W1["Worker A<br/>Init + Gateway(Server + Client)<br/>binds /tmp/A.sock<br/>connects to B and C"]
        W2["Worker B<br/>Init + Gateway(Server + Client)<br/>binds /tmp/B.sock<br/>connects to A and C"]
        W3["Worker C<br/>Init + Gateway(Server + Client)<br/>binds /tmp/C.sock<br/>connects to A and B"]
    end

    W1 <-->|Unix socket| W2
    W2 <-->|Unix socket| W3
    W1 <-->|Unix socket| W3
```

**Important:** a `GatewayClient` cannot talk directly to another `GatewayClient` — there is no discovery, no peer-to-peer mode in the transport. The socket is a named pipe with exactly one bind side and one or more connect sides. The "peer-to-peer" property of the package is that **the main thread is not involved** — not that any two endpoints can speak without a server somewhere.

**Result:**

- Inter-worker calls are **one hop, one serialization** (no main-thread relay on the data path)
- Main-thread is **freed** from relaying — it only orchestrates lifecycle (`ready`, `kill`)
- Each worker can **discover and connect** to peers at runtime (via the peer's socket path)
- Back-pressure on one channel **does not** block unrelated worker-to-worker traffic

## Architecture Overview

```mermaid
flowchart LR
    subgraph Main["Main Thread"]
        Launch["WorkerThreadLaunch<br/>new Worker path, argv"]
        Pool["WorkerThreadPool<br/>thread: Map threadId → Launch"]
        Export["WorkerThreadExport.init<br/>Proxy + launchWorker + methods"]
    end

    subgraph WT1["Worker A"]
        Init1["WorkerThreadInit<br/>subclass with mtdFoo..."]
        GW1["WorkerThreadGatewayClient"]
    end

    subgraph WT2["Worker B"]
        Init2["WorkerThreadInit"]
        GW2["WorkerThreadGatewayServer"]
    end

    Export -->|launchWorker| Launch
    Pool -->|add/broadcastRequest| Launch
    Launch -->|new Worker| Init1
    Launch -->|new Worker| Init2

    Init1 <-->|parentPort| Launch
    Init2 <-->|parentPort| Launch

    Init1 -.->|createGatewayClient| GW1
    Init2 -.->|createGatewayServer| GW2
    GW1 <-->|Unix socket| GW2
```

**Key components:**

| Component                   | Lives in      | Role                                                                          |
| --------------------------- | ------------- | ----------------------------------------------------------------------------- |
| `WorkerThreadLaunch`        | main thread   | spawns a worker, holds `parentPort` link, exposes `request()`                 |
| `WorkerThreadInit`          | worker thread | base class for worker code; holds `parentPort` link, exposes `request()`      |
| `WorkerThreadRpc`           | both          | JSON-RPC dispatcher (request/result/error envelopes)                          |
| `WorkerThreadGatewayServer` | worker thread | binds a Unix socket, routes incoming RPC calls to registered methods          |
| `WorkerThreadGatewayClient` | worker thread | connects to a peer's gateway socket, sends RPC requests                       |
| `WorkerThreadPool`          | main thread   | manages many `WorkerThreadLaunch` instances, supports broadcast               |
| `WorkerThreadExport.init`   | both          | factory that returns a typed proxy whose methods auto-RPC across `parentPort` |

## Lifecycle: Spawn → Ready → RPC → Kill

```mermaid
sequenceDiagram
    autonumber
    participant M as Main Thread
    participant L as WorkerThreadLaunch
    participant W as Worker (WTInit subclass)
    participant N as node:worker_threads

    M->>L: new WorkerThreadLaunch(path, argv)
    L->>N: new Worker(path, {argv})
    N->>W: spawn worker process
    W->>W: super() → init() → this.send({method: 'readyResolve'})
    W->>N: parentPort.postMessage({method: 'readyResolve'})
    N->>L: 'message' event
    L->>L: rpc.make({method: 'readyResolve'})<br/>→ register.readyResolve()
    L-->>M: _readyPromise resolves
    M->>M: await worker.ready() ✓

    M->>L: worker.request('mtdFoo', [arg1, arg2])
    L->>L: rpc.makeRequest → {id, method, params}
    L->>N: parentPort.postMessage(payload)
    N->>W: 'message' event
    W->>W: rpc.make({id, method, params})<br/>→ this['mtdFoo'](arg1, arg2)
    W-->>N: parentPort.postMessage({id, result})
    N-->>L: 'message' event
    L->>L: rpc.make({id, result}) → resolve promise
    L-->>M: returns the result

    M->>L: worker.kill()
    L->>N: thread.terminate()
    N-->>L: 'exit' event
```

## Inter-Worker Communication (Direct, Bypassing Main Thread)

This is the headline feature. Once a worker has `createGatewayServer()` running, any other worker (or even the main thread) can reach its methods directly over a Unix socket — no relay, no main-thread bottleneck.

```mermaid
sequenceDiagram
    autonumber
    participant WA as Worker A
    participant GC as GatewayClient (in A)
    participant SOCK as Unix Socket
    participant GS as GatewayServer (in B)
    participant WB as Worker B
    participant M as Main Thread<br/>(only orchestrates)

    Note over WB,M: Phase 1: Server worker brings up gateway
    WB->>WB: this.createGatewayServer()<br/>(or in init/launchGatewayClient)
    WB->>GS: new WorkerThreadGatewayServer()
    GS->>SOCK: net-ipc.Server.start(path)<br/>bind + listen

    Note over WA,M: Phase 2: Client worker connects
    WA->>GC: new ServerBGateway(this).mtdBar(...)
    GC->>SOCK: net-ipc.Client.connect(path)
    SOCK-->>GS: 'connect' event
    GC->>GC: ensure client ready (lazily)
    GC->>SOCK: send {id, method: 'mtdBar', params: [...]}
    SOCK-->>GS: 'message' event
    GS->>WB: rpc.make({id, method, params})<br/>→ this.register['mtdBar'](...)
    WB-->>GS: returns result
    GS->>SOCK: send {id, result}
    SOCK-->>GC: 'message' event
    GC->>GC: rpc.make({id, result}) → resolve promise
    GC-->>WA: returns the result

    Note over M: Main thread was never on the path<br/>between WA and WB
```

**Key points:**

- The **main thread is completely off the inter-worker hot path** — it only spawns/kills workers
- The connection is **lazily created on first call** (`owner.createGatewayClient(path)` only runs if the gateway isn't already in `owner.gatewayClients`)
- The `register` object can be **`this`** (expose the worker itself) **or any plain object** with callable methods
- Multiple workers can **share one gateway** (server side fans out to all connected clients)
- A worker can run **both** a server and clients — it can serve peers **and** call out to others

## Pool Broadcast

`WorkerThreadPool.broadcastRequest` is the only "many-to-many" call that still uses the main-thread path — and that is by design: the main thread owns the worker registry, so fanning out from there is the natural place.

```mermaid
flowchart LR
    Pool[WorkerThreadPool<br/>broadcastRequest 'getStatus']
    L1[WorkerThreadLaunch 1]
    L2[WorkerThreadLaunch 2]
    L3[WorkerThreadLaunch 3]
    W1[Worker 1]
    W2[Worker 2]
    W3[Worker 3]

    Pool -->|request 'getStatus'| L1
    Pool -->|request 'getStatus'| L2
    Pool -->|request 'getStatus'| L3
    L1 -->|parentPort| W1
    L2 -->|parentPort| W2
    L3 -->|parentPort| W3
    W1 -.->|result| L1
    W2 -.->|result| L2
    W3 -.->|result| L3
    L1 -.-> Pool
    L2 -.-> Pool
    L3 -.-> Pool
```

If you need **worker-to-worker broadcast** (e.g. all workers need to ask every other worker the same question), wire it through a gateway — that path bypasses the pool and main thread entirely.

## Quick Start

```typescript
import { WorkerThreadExport, WorkerThreadInit } from "@gramstax/worker-thread";

class CounterWorker extends WorkerThreadInit {
  count = 0;
  mtdAutoIncrement(ms: string) {
    setInterval(() => {
      this.count += 1;
    }, ms);
  }

  mtdGetNumber() {
    return this.count;
  }
}

export const CounterJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: CounterWorker,
});

// main.ts
await CounterJob.launchWorker();
console.log(await CounterJob.mtdGetNumber()); // 0
await CounterJob.mtdAutoIncrement(`1000`); // 1 seconds
setTimeout(() => {
  console.log(await CounterJob.mtdIncrement()); // >1
}, 2000);
```

## Inter-worker gateway example

```typescript
// server-worker.ts
import { WorkerThreadExport, WorkerThreadInit } from "@gramstax/worker-thread";

class ServerWorker extends WorkerThreadInit {
  static gatewayServerPath = "/tmp/server.sock";
  mtdHello(from: string) {
    return `Hello ${from}!`;
  }

  async mtdStart() {
    return await this.createGatewayServer();
  }
}

export const Server = WorkerThreadExport.init({
  path: __filename,
  WTInit: ServerWorker,
});
export const ServerGateway = Server.launchGatewayClient();

// client-worker.ts
import { ServerGateway } from "./server-worker";
import { WorkerThreadExport, WorkerThreadInit } from "@gramstax/worker-thread";

class ClientWorker extends WorkerThreadInit {
  async mtdCallServer() {
    // pass `this` as first arg — the gateway client needs an owner with a gatewayClients map
    return await ServerGateway.mtdHello(this, "ClientWorker");
  }
}

export const Client = WorkerThreadExport.init({
  path: __filename,
  WTInit: ClientWorker,
});

// main.ts
await Server.launchWorker();
await Client.launchWorker();
await Server.mtdStart();
console.log(await Client.mtdCallServer()); // "Hello ClientWorker!"
```

## API

| Export                      | Description                                  |
| --------------------------- | -------------------------------------------- |
| `WorkerThreadInit`          | Base class for worker thread implementations |
| `WorkerThreadLaunch`        | Main-thread side to spawn workers            |
| `WorkerThreadExport`        | `init()` factory creating typed proxy        |
| `WorkerThreadPool`          | Manage multiple workers + broadcast          |
| `WorkerThreadRpc`           | JSON-RPC dispatcher                          |
| `WorkerThreadGatewayServer` | Unix-socket server for inter-worker comms    |
| `WorkerThreadGatewayClient` | Unix-socket client for inter-worker comms    |

See [JSDoc](./src/) in source for full API.

## License

Proprietary — Copyright (c) 2026 Gramstax. See [LICENSE](./LICENSE).
