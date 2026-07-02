# @GRAMSTAX/WORKER-THREAD — Worker Thread + RPC + Gateway

Multi-runtime (Bun, Node.js >=18) worker thread lifecycle management, type-safe RPC over `parentPort`, and inter-worker Unix-socket gateway.

## Source Layout

```
packages/worker-thread/src/
├── init.ts          WorkerThreadInit — worker-side base class (ready signal, RPC handlers)
├── launch.ts        WorkerThreadLaunch — main-thread side (spawn, RPC proxy, kill)
├── export.ts        WorkerThreadExport.init() — factory creating typed RPC proxy
├── pool.ts          WorkerThreadPool — manage multiple workers + broadcast
├── rpc.ts           JSON-RPC dispatcher (request/result/error envelopes)
├── gateway-server.ts WorkerThreadGatewayServer — Unix-socket RPC server
├── gateway-client.ts WorkerThreadGatewayClient — Unix-socket RPC client
└── index.ts         Barrel (re-exports all modules)
```

## Core Pattern

```typescript
class CounterWorker extends WorkerThreadInit {
  count = 0;
  mtdGetNumber() {
    return this.count;
  }
}

export const CounterJob = WorkerThreadExport.init({
  path: __filename,
  WTInit: CounterWorker,
});

// Main thread
await CounterJob.launchWorker();
console.log(await CounterJob.mtdGetNumber());
```

## Key Concepts

- **Lifecycle**: spawn → ready (auto-signal) → RPC → kill.
- **RPC**: methods prefixed with `mtd` become async RPC calls via proxy.
- **Gateway**: inter-worker communication over Unix sockets (`net-ipc`), bypassing main thread.
- **Pool**: `WorkerThreadPool` manages multiple workers with broadcast.

## Where to Look

| Task                                   | File                |
| -------------------------------------- | ------------------- |
| Worker-side implementation             | `init.ts`           |
| Main-thread spawn/control              | `launch.ts`         |
| Typed RPC proxy setup                  | `export.ts`         |
| Worker pool + broadcast                | `pool.ts`           |
| Gateway server (bind/register methods) | `gateway-server.ts` |
| Gateway client (connect/call)          | `gateway-client.ts` |
| JSON-RPC dispatcher internals          | `rpc.ts`            |

## Gateway Topology

- **Hub (common)**: one worker runs `createGatewayServer()`, others connect as clients.
- **Mesh (advanced)**: workers can be both server and client — bind + connect simultaneously.
- Main thread is never on the inter-worker hot path.

## Build & Test

```
nx build worker-thread            # tsup → dist/src/
bun test packages/worker-thread/test/
```

## Anti-Patterns

- Do not use gateway for main-thread orchestration — use parentPort RPC.
- Gateway clients cannot talk to each other directly (server required).
- Pool broadcast still routes through main thread (by design).
