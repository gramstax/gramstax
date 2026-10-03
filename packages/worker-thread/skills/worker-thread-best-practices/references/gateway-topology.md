# gateway-topology.md

Verdict: hub by default (one server worker, N clients); gateway carries
worker↔worker traffic only — never main-thread orchestration.

## Why

`node:worker_threads` gives every worker exactly one channel: its
`parentPort` back to the main thread. Two sibling workers cannot talk
without the main thread relaying every message, so a worker-mesh built
on `parentPort` pays two hops and two serializations per call and parks
the main thread in the hot path. The gateway adds a peer-to-peer socket
channel, so an inter-worker call is one hop and one serialization and
the main thread only orchestrates lifecycle (spawn, ready, shutdown).
Mesh (workers as both server and client) is supported but doubles the
auth and ops surface — earn it first.

## Topology shapes

Hub is the default. One worker binds via `createGatewayServer`, the
rest connect via `createGatewayClient` / `launchGatewayClient`. Mesh is
the advanced shape: a worker binds AND connects at the same time, so it
is both server and client.

```
HUB (most common)                    MESH (advanced)

  Worker-S (server)                    Worker-A (server + client)
   |  Unix socket                      |  Unix socket  |  Unix socket
   +-- Worker-A (client)               +-- Worker-B (server + client)
   +-- Worker-B (client)               +-- Worker-C (server + client)
   +-- Worker-C (client)
                                       every worker binds once AND
Main thread: spawn/ready/shutdown      connects N-1 times
only, never per-call.
```

Two hard limits shape every diagram: gateway clients cannot talk to
each other directly, a server is always required in between. And one
worker process hosts at most one gateway server — re-`create` closes
the previous socket so it never leaks (`src/init.ts:277` replaces and
closes before rebinding).

## Hub vs mesh

| | Hub | Mesh |
| --- | --- | --- |
| Servers | exactly one worker binds | every peer binds AND connects |
| Auth surface | one `token`, one `allowedMethods` list | one per server, must stay in sync |
| Ops cost | one socket path to manage | N paths, N bind orderings |
| Failure mode | server worker is the single point | any peer restart drops its clients |
| Use when | fan-in to one service (lookup, store, router) | true peer traffic (A calls B calls A) |

Start hub. Move to mesh only when two workers genuinely call each
other, not because the diagram looks symmetric.

## parentPort RPC or gateway

| Task | Channel | Why |
| --- | --- | --- |
| Main thread spawns / waits-ready / shuts down a worker | `parentPort` RPC | Lifecycle is main-thread orchestration by design |
| Pool fan-out (`broadcastRequest`) to all workers | `parentPort` via main | Fan-out, not hot path, main already owns the roster |
| Worker A calls worker B (hot path) | gateway socket | One hop, one serialization, main never in the path |
| Worker calls back into main (config, flags) | `parentPort` RPC | Main is the authority, no socket needed |
| Main thread relays worker-to-worker messages | neither, use gateway | Relay doubles hops and serializations per call |

## Incorrect

```typescript
// wrong: main thread relaying every worker-to-worker call through parentPort
// pays two hops + two serializations per call and parks main in the hot path
class RelayWorker extends WorkerThreadInit {
  async mtdAskSibling(question: string) {
    return await this.request(`mtdRelayToSibling`, [question]) // wrong: main relays
  }
}
```

```typescript
// wrong: client-to-client call with no server in between
// gateway clients cannot talk directly, this path never binds
const a = new WorkerA(this) // wrong: no server bound on either side
await a.mtdPing(`hi`) // hangs or rejects, there is nothing listening
```

```typescript
// wrong: gateway used for main-thread orchestration
// lifecycle belongs on parentPort RPC, not the socket
await ServerGateway.mtdShutdown(this) // wrong: shutdown via gateway
```

## Correct

```typescript
// correct: hub, static call style — owner passed as first arg, per-prop
// closures cached in staticCache so repeat calls reuse the same fn
const ServerGateway = WorkerThreadExport.launchGatewayClient<ServerWorker>(`/tmp/srv.sock`, {token: `shared-secret`})
class ClientWorker extends WorkerThreadInit {
  async mtdCallServer() {
    return await ServerGateway.mtdHello(this, `hi`) // correct: one hop, main uninvolved
  }
}
```

```typescript
// correct: hub, constructor call style — fresh instance cache per owner,
// same wire call underneath, reads better when one worker calls often
const ServerGateway = WorkerThreadExport.launchGatewayClient<ServerWorker>(`/tmp/srv.sock`, {token: `shared-secret`})
class ClientWorker extends WorkerThreadInit {
  async mtdCallServer() {
    const gateway = new ServerGateway(this) // correct: instance cache, no static arg
    return await gateway.mtdHello(`hi`)
  }
}
```

```typescript
// correct: mesh peer — bind AND connect in the same worker
class PeerWorker extends WorkerThreadInit {
  async mtdStart() {
    // correct: this worker serves its own methods while calling peers
    await this.createGatewayServer(`/tmp/peer-a.sock`, undefined, {token: `s3`, allowedMethods: [`mtdHello`]})
    await this.createGatewayClient(`/tmp/peer-b.sock`, {token: `s3`})
    return true
  }
}
```

## Notes

- `instanceof` against the gateway proxy is always false
  (`src/export.ts:166-167`) — the constructor returns a fresh proxy by
  design. Duck-type or compare against `WorkerThreadInit`.
- `WorkerThreadInit.createGatewayServer(path, register?, options?)`
  (`src/init.ts:277`) throws when `register` is omitted and
  `allowedMethods` is missing or empty — omitting `register` would expose
  the whole worker instance to every socket client.
- `WorkerThreadInit.createGatewayClient(serverPath, options?)`
  (`src/init.ts:309`) replaces and closes an existing client for the
  same path first, so a socket is never leaked.
- Pool `broadcastRequest` still routes through main by design (fan-out,
  not hot path) — see `pool-dispatch.md`.
- Socket path rules (length cap, `tmpdir()` fallback, pipe escaping) live
  in `WorkerThreadGatewayPath.normalize` — see `platform-runtime.md`.
