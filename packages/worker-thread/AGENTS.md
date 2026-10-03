# @GRAMSTAX/WORKER-THREAD — Worker Thread + RPC + Gateway

Multi-runtime (Bun, Node.js >=18) worker thread lifecycle management, type-safe RPC over `parentPort`, and inter-worker Unix-socket gateway.

## Source Layout

```
packages/worker-thread/src/
├── init.ts          WorkerThreadInit — worker-side base class (ready signal, RPC handlers)
├── launch.ts        WorkerThreadLaunch — main-thread side (spawn, RPC proxy, kill)
├── export.ts        WorkerThreadExport.init() — factory creating typed RPC proxy
├── pool.ts          WorkerThreadPool — manage multiple workers + broadcast
├── rpc.ts           WorkerThreadRpc — JSON-RPC dispatcher (request/result/error envelopes)
├── gateway-server.ts WorkerThreadGatewayServer — Unix-socket RPC server
├── gateway-client.ts WorkerThreadGatewayClient — Unix-socket RPC client
├── gateway-path.ts  WorkerThreadGatewayPath.normalize() — socket path normalization
├── error-handler.ts WorkerThreadErrorHandler — package-wide error routing (silent default)
├── types/           Shared `I*` type definitions, one file per source module
│   ├── export.ts          IWorkerThreadExportOpt, IWorkerThreadGatewayProxy, …
│   ├── gateway-client.ts  IGatewayClientOptions
│   ├── gateway-server.ts  IGatewayServerOptions
│   └── rpc.ts             IMapRpc, IRpcContext, IRpcMiddleware
└── index.ts         Barrel (re-exports all modules + the `types/` definitions)
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

## Gateway Reliability Semantics (at-least-once)

- **Retried delivery, not exactly-once**: the transport retries failed writes
  and replays in-flight requests across reconnects — handlers may see the same
  RPC `id` twice. Ids are monotonic per client and never reused within a
  connection, so the server dedupes per connection (first delivery executes,
  redeliveries replay the cached response — including redeliveries that arrive
  while the first copy is still running, which are dropped; >64KB responses
  are never cached, max 1000 entries FIFO per connection, dropped on
  disconnect). Keep handlers idempotent anyway.
- **Default RPC timeout is 30s**: omitting `timeoutMs` rejects the caller after
  30s (`DEFAULT_REQUEST_TIMEOUT_MS`); pass `timeoutMs: 0` for long tasks.
- **No ordering across reconnect**: pre-drop requests may resolve after
  post-reconnect ones.
- **`maxMessageSize` is post-buffering** (stops handler-memory growth, not a
  wire-level DoS cap — upstream `net-ipc` limitation).
- **Allow-list escape hatch is intentional**: short-circuit middleware (sets
  `ctx.result` without `next()`) skips the `allowedMethods` guard — only
  reachable by code already holding the server instance.

## Build & Test

```
nx build worker-thread            # tsup → dist/src/
bun test packages/worker-thread/test/
```

## Bench

```
cd packages/worker-thread && bun run bench                                    # full suite (5 files)
BENCH_FILTER="json echo single" bun run ./bench/gateway-roundtrip.bench.ts    # one bench only
```

- Runner: mitata (`bench`/`group`/`run`); shared setup in `bench/_setup.ts` (`spawnEchoWorker`, `spawnGatewayPair`, `makePool`, `runBench`, `benchSize`).
- Knobs: `BENCH_N` (batch/payload-size multiplier), `BENCH_FILTER` (regex → mitata `run({filter})` — smoke runs select exactly one bench per file).
- Socket paths must stay unique per server (`pid`+`Date.now`+counter via `uniqueSocketPath`) — a reused path collides with a stale socket file and hangs the runner.
- Every bench primes once unmeasured, wraps setup awaits in `withTimeout`, and kills/closes all workers, servers, clients, and pools in teardown.
- Benches are `@internal` scripts — excluded from `bun test` and CI.

## Agent skills

### Best practices

`packages/worker-thread/skills/worker-thread-best-practices/` — rule-based
skill synced with the current source: the class-static API surface and
`src/types/` layout, `mtd*` dispatch, lifecycle, gateway security and
at-least-once reliability, cross-platform socket paths, error visibility
against the silent-drop default, pool dispatch, and bench conventions. Load it
when writing, reviewing, or debugging anything in `src/`. Its
`references/maintain-api-surface.md` carries the free-function → class-static
migration table.

## Anti-Patterns

- Do not use gateway for main-thread orchestration — use parentPort RPC.
- Gateway clients cannot talk to each other directly (server required).
- Pool broadcast still routes through main thread (by design).
