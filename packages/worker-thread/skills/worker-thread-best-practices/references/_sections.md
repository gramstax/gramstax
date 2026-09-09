# Sections Index

Read only the rule your task needs.

## Lifecycle

- `lifecycle-lifecycle.md` — launch → ready → request → shutdown; `kill` vs
  `shutdown`; `argv` slot convention; `ready()` post-mortem; `send` boolean.
- `lifecycle-timeouts.md` — 30s default timeout, `timeoutMs: 0` opt-out,
  pool forwarding, crash-before-ready, pending rejection on exit.

## RPC

- `rpc-naming.md` — every remotely-called method is `mtd*`-prefixed, public
  or effectively-private; lifecycle/plumbing names stay unprefixed and most
  are remotely denied; the `DENIED_RPC_METHODS` contract.
- `rpc-payloads.md` — serializability per transport (JSON vs messagepack),
  `undefined` results, error shape, id-less notifications get no reply.
- `rpc-middleware.md` — `use()` order, single-`next` guard, short-circuit as
  intentional escape hatch, `rpc.context` merge cost.

## Gateway

- `gateway-topology.md` — hub vs mesh; gateway is not for main-thread
  orchestration; clients never talk directly.
- `gateway-security.md` — `token` strictness (`""` ≠ unset), `allowedMethods`
  required when exposing `this`, timing-safe compare, path rules.
- `gateway-reliability.md` — at-least-once (idempotent handlers), no
  ordering, post-buffering `maxMessageSize`, reconnect storms, dedupe caps
  (1000 entries, 64KB skip, drop on disconnect).

## Pool

- `pool-dispatch.md` — `execute` round-robin, `broadcastRequest` fail-fast vs
  `broadcastSettled`, empty-pool throw, timeout forwarding.
- `pool-membership.md` — no double-`add`, `kill`/`killAll` semantics,
  `threadCount` live-only, exit-listener cleanup, SIGINT/SIGTERM.

## Bench & Maintain

- `bench-writing.md` — mitata `bench`/`group`/`run`, setup outside measured
  closures, `do_not_optimize`, unique socket paths, teardown kills all.
- `bench-runner.md` — `bun run bench`, `BENCH_FILTER`, `BENCH_N`, file map
  (rpc/gateway/codec/pool/storm).
- `maintain-style-tests.md` — backticks, no semicolons, `bun:test`,
  per-package `tsc`, full suite green, no-ai-slop rules.
