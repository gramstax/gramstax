---
name: worker-thread-best-practices
description: Best practices for @gramstax/worker-thread (Bun, Node.js >=18): the class-static API surface (WorkerThreadErrorHandler/WorkerThreadGatewayPath/WorkerThreadRpc) and src/types layout, mtd*-prefixed worker methods, launch-ready-request-shutdown lifecycle, RPC timeouts and payloads, gateway auth with at-least-once reliability, cross-platform socket paths (Windows named pipes, POSIX 104-char limit), error visibility against the silent-drop default, pool dispatch, and mitata benchmarks. Use when writing, reviewing, auditing, or debugging worker-thread code, or when an import fails to resolve, RPC calls hang, leak, double-execute, or reject unexpectedly, a worker dies with no log output, or a gateway works on Linux but not Windows.
compatibility: Bun >= 1.0.0 or Node.js >= 18; @gramstax/worker-thread workspace (packages/worker-thread); targets worker-thread v2.2.0
metadata:
  author: gramstax
  organization: gramstax
  scope: packages/worker-thread
---

# Worker-Thread Best Practices

Router for the `references/` rule files. Read `AGENTS.md` in
`packages/worker-thread` for API truth; this skill adds the judgment layer
distilled from the package's own audit, the `README.md` semantics sections, and
the regression locks in `test/`.

**Know which API you are on.** The package version reads `2.2.0`, but the
`v2.2.0` tag predates the class-static reshape — `main` is 12 commits ahead of
that tag. So the published `v2.2.0` still exports free functions
(`normalizeGatewayPath`, `estimatePayloadSize`, `setDefaultErrorHandler`,
`resetDefaultErrorHandler`, `reportError`) and has **no** `src/types/`, while
`main` replaces them with `WorkerThreadGatewayPath.normalize`,
`WorkerThreadRpc.estimatePayloadSize`, and the `WorkerThreadErrorHandler`
statics. Both shapes are documented in
`references/maintain-api-surface.md`; check which one you are importing before
"fixing" a build.

## When to Apply

- Upgrading from v1.x, or reviewing an import that stopped resolving
- New worker class, gateway server/client, pool, or bench file
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
- `references/maintain-api-surface.md` — the v2.2.0 migration table
- `skills/worker-thread-best-practices/CHANGELOG.md` — what changed in this skill and why
