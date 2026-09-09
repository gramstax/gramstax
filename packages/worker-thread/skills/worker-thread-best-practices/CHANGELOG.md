# Changelog

## v1.0.0

- Initial `worker-thread-best-practices` skill: `SKILL.md` router,
  `references/_sections.md` index, `references/_template.md`, 13 rule files
  (`lifecycle-*`, `rpc-*`, `gateway-*`, `pool-*`, `bench-*`,
  `maintain-style-tests`).
- Encodes the audit→fix→Oracle session: `mtd*` naming contract (public and
  effectively-private), `DENIED_RPC_METHODS` + `Object.prototype` dispatch
  gate, 30s default timeout with `timeoutMs: 0` opt-out, at-least-once
  gateway dedupe (1000-entry FIFO, 64KB skip, in-flight drop), strict token
  + allow-list auth, pool `broadcastSettled`, mitata bench conventions.
