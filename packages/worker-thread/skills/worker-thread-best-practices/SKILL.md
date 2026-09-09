---
name: worker-thread-best-practices
description: Best practices for @gramstax/worker-thread (Bun, Node.js): mtd*-prefixed worker methods, launch-ready-request-shutdown lifecycle, RPC timeouts and payloads, gateway auth with at-least-once reliability, pool dispatch, and mitata benchmarks. Use when writing, reviewing, auditing, or debugging worker-thread code, or when RPC calls hang, leak, double-execute, or reject unexpectedly.
compatibility: Bun, Node.js @gramstax/worker-thread workspace (packages/worker-thread)
metadata:
  author: gramstax
  organization: gramstax
  scope: packages/worker-thread
---

# Worker-Thread Best Practices

Router for the `references/` rule files. Read the index, load only the rule
your task needs — each file is self-contained (verdict → why → incorrect vs
correct → notes).

## When to Apply

- New worker class, gateway server/client, pool, or bench file.
- Debugging: hang, leak, double execution, auth rejection, `not found` errors.
- Reviewing worker-thread code or touching `packages/worker-thread/src/`.

## Rule Priority

| Prefix | Impact | Load when |
| --- | --- | --- |
| `rpc-naming` | correctness | naming any worker method |
| `lifecycle-*` | hang/leak | spawn, ready, shutdown, argv, timeouts |
| `gateway-security` | auth bypass | exposing methods over a socket |
| `gateway-reliability` | double-exec | handlers, retries, reconnects |
| `rpc-payloads`, `rpc-middleware` | correctness | payloads, errors, middleware |
| `pool-*` | correctness | dispatch, membership, broadcast |
| `bench-*`, `maintain-*` | perf/hygiene | measuring, style, tests, typecheck |

## How to Use

1. Open `references/_sections.md`, pick the rule.
2. Read that ONE file (never the whole directory).
3. Apply the correct pattern; run the checks in `maintain-style-tests`.

## Rule-File Anatomy

Every rule file: one-line verdict, why (measured where possible),
incorrect vs correct TypeScript, notes (edge cases, evidence).

## References

- `packages/worker-thread/AGENTS.md` — module map, topology, anti-patterns.
- `packages/worker-thread/README.md` — lifecycle, gateway semantics, pool, API table.
- `packages/worker-thread/bench/` — mitata suites proving the perf guidance.
- `packages/worker-thread/test/` — regression locks for the security/correctness rules.
