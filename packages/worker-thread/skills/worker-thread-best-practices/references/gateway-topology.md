# gateway-topology.md

Verdict: hub by default (one server worker, N clients); gateway carries
worker↔worker traffic only — never main-thread orchestration.

## Why

`node:worker_threads` gives each worker exactly one channel (`parentPort` to
main). The gateway adds a peer socket so inter-worker calls cost one hop and
one serialization with main never in the path. Mesh (workers as both server
and client) is supported but doubles the auth/ops surface — earn it first.

## Incorrect

```typescript
// main thread relaying every worker-to-worker call through parentPort
// gateway server exposing main-thread orchestration methods
```

## Correct

```typescript
// server worker: binds once
await this.createGatewayServer(`/tmp/srv.sock`, undefined, {token, allowedMethods: [`mtdHello`]})
// client workers: connect directly, main thread uninvolved per call
await ServerGateway.mtdHello(this, `hi`)
```

## Notes

- Gateway clients cannot talk to each other — a server is always required.
- Pool `broadcastRequest` still routes through main by design (fan-out, not
  hot path); use gateway for worker-mesh traffic.
- One worker process hosts at most one gateway server (re-`create` closes
  the previous socket so it never leaks).
