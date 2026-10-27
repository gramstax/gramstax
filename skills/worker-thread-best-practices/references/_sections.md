# Sections Index

Read only the rule your task needs.

## API Surface (read first when an import will not resolve)

- `maintain-api-surface.md` — the current API surface: five class-static helpers
  (`WorkerThreadErrorHandler.setDefault/resetDefault/report`,
  `WorkerThreadGatewayPath.normalize`, `WorkerThreadRpc.estimatePayloadSize`);
  shared `I*` types live in `src/types/`; deep imports are unsupported; the two
  independent deny-lists (`DENIED_RPC_METHODS` dispatcher vs module-private
  `DENIED_RPC_PROPS` proxy); `@public` vs `@internal` discipline.

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

## Errors

- `errors-visibility.md` — the default handler is a **silent drop** and the
  library never console-logs, so an unhandled worker error produces no output;
  `setDefault` / `resetDefault` wiring; per-instance `error` listeners win;
  `onError` must re-call `report` or you break package-wide observability; a
  throwing user handler is swallowed by design.

## Platform

- `platform-runtime.md` — Windows named-pipe transform (dash-escape before
  slash→dash, so `/tmp/a-b` ≠ `/tmp/a/b`); POSIX 104-char `sun_path` limit and
  the cryptic `ENOENT` it prevents; relative paths resolve to `os.tmpdir()`;
  `engines` (`node >=18`, `bun >=1.0.0`); unique socket paths per server; and
  the verification gap — CI is ubuntu-only so the win32 branch never runs and
  Node never runs the suite (all 9 `.test.ts` files plus `test/helpers.ts`
  import `bun:test`).

## Pool

- `pool-dispatch.md` — typed `pool.mtdX(…)` dispatch; worker-class inference
  from `launchWorker()` handles; no-options round-robin, `{mode: "broadcast"}`
  fail-fast vs `{mode: "settled"}`; trailing options object rules; timeout
  forwarding; empty-pool throw.
- `pool-membership.md` — no double-`add`; `add`/`addMany` return ids; async
  `kill`/`killAll`; `threadCount` live-only; exit-listener cleanup;
  SIGINT/SIGTERM.

## Bench & Maintain

- `bench-writing.md` — mitata `bench`/`group`/`run`, setup outside measured
  closures, `do_not_optimize`, unique socket paths, teardown kills all.
- `bench-runner.md` — `bun run bench`, `BENCH_FILTER`, `BENCH_N`, file map
  (rpc/gateway/codec/pool/storm).
- `maintain-style-tests.md` — `bun:test` only, per-package `tsc` gate, full
  suite green (254), no type suppression in source, and which Biome rules are
  actually enforced versus convention-only backticks.
