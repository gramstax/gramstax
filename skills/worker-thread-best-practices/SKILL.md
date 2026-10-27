---
name: worker-thread-best-practices
description: Best practices for @gramstax/worker-thread (Bun, Node.js >=18): the class-static API surface (WorkerThreadErrorHandler/WorkerThreadGatewayPath/WorkerThreadRpc) and src/types layout, mtd*-prefixed worker methods, launch-ready-request-shutdown lifecycle, RPC timeouts and payloads, gateway auth with at-least-once reliability, cross-platform socket paths (Windows named pipes, POSIX 104-char limit), error visibility against the silent-drop default, pool dispatch (typed pool.mtdX round-robin/broadcast/settled), and mitata benchmarks. Use when writing, reviewing, auditing, or debugging worker-thread code, or when an import fails to resolve, RPC calls hang, leak, double-execute, or reject unexpectedly, a worker dies with no log output, or a gateway works on Linux but not Windows.
compatibility: Bun >= 1.0.0 or Node.js >= 18; @gramstax/worker-thread workspace (packages/worker-thread)
metadata:
  version: 6.0.4
  author: gramstax
  organization: gramstax
  scope: packages/worker-thread
---

# Worker-Thread Best Practices

Router for the `references/` rule files. Read `AGENTS.md` in
`packages/worker-thread` for API truth; this skill adds the judgment layer
distilled from the package's own audit, the `README.md` semantics sections, and
the regression locks in `test/`.

**The current API is class-static.** The helper functions are members of the
class that owns them: `WorkerThreadGatewayPath.normalize`,
`WorkerThreadRpc.estimatePayloadSize`, and the
`WorkerThreadErrorHandler.setDefault` / `resetDefault` / `report` statics.
Shared `I*` types live under `src/types/`. The old free functions are gone, so
a stale import is a compile error, not a deprecation warning. See
`references/maintain-api-surface.md` for the import and `@public` / `@internal`
rules.

## When to Apply

- Reviewing an import that stopped resolving
- New worker class, gateway server/client, pool, or bench file
- Calling a pooled worker's `mtd*` method — choosing round-robin, broadcast, or settled
- Access control: choosing `token`, `allowedMethods`, and what `register` may expose
- Cross-platform: a gateway path that binds on Linux but not Windows, or a socket `ENOENT`
- Debugging: hang, leak, double execution, auth rejection, `not found`, **or a silent failure with no output**
- Reviewing worker-thread code or touching `packages/worker-thread/src/`

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | API surface & breaking changes | CRITICAL | `maintain-api-surface` |
| 2 | RPC naming & dispatch | CRITICAL | `rpc-naming` |
| 3 | Worker lifecycle | CRITICAL | `lifecycle-` |
| 4 | Gateway security | CRITICAL | `gateway-security` |
| 5 | Error visibility | HIGH | `errors-visibility` |
| 6 | Cross-platform & runtime | HIGH | `platform-runtime` |
| 7 | Gateway reliability | HIGH | `gateway-reliability` |
| 8 | RPC payloads & middleware | HIGH | `rpc-payloads`, `rpc-middleware` |
| 9 | Worker pool | MEDIUM-HIGH | `pool-` |
| 10 | Gateway topology | MEDIUM | `gateway-topology` |
| 11 | Bench & perf | MEDIUM | `bench-` |
| 12 | Style, tests, typecheck | MEDIUM | `maintain-style-tests` |

## Start Here

| Task | Read first |
| --- | --- |
| An import will not resolve | `references/maintain-api-surface.md` |
| A worker errored and nothing was logged | `references/errors-visibility.md` |
| Gateway works on Linux, fails on Windows | `references/platform-runtime.md` |
| `not found` on a method you know exists | `references/rpc-naming.md`, then `references/maintain-api-surface.md` |
| Deciding what a socket peer may call | `references/gateway-security.md` |
| Handler ran twice for one call | `references/gateway-reliability.md` |
| Spawn, ready, shutdown, or timeout behavior | `references/lifecycle-lifecycle.md`, `references/lifecycle-timeouts.md` |
| Calling one worker method across a pool | `references/pool-dispatch.md` |
| Choosing hub vs mesh | `references/gateway-topology.md` |
| Writing or running a benchmark | `references/bench-writing.md`, `references/bench-runner.md` |

## How to Use

Read individual rule files for explanations with incorrect vs correct examples:

```
references/maintain-api-surface.md
references/errors-visibility.md
references/rpc-naming.md
references/_sections.md
```

Each rule file contains:

- One-line verdict first
- Why it matters (failure mode, measured where possible)
- Incorrect code with explanation
- Correct code with explanation
- Package-specific notes (deviations, edge cases, and the test that locks it)

## References

- `packages/worker-thread/AGENTS.md` — module map, topology, anti-patterns
- `packages/worker-thread/README.md` — lifecycle, gateway semantics, pool, API table
- `packages/worker-thread/bench/` — mitata suites proving the perf guidance
- `packages/worker-thread/test/` — regression locks for the security/correctness rules
- `references/maintain-api-surface.md` — the current API surface and `@public` / `@internal` rules
- `CHANGELOG.md` — what changed in this skill and why
