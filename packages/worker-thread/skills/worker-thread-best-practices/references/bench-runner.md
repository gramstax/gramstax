# bench-runner.md

Verdict: `bun run bench` from `packages/worker-thread`; `BENCH_FILTER` to run
one bench; full suites are slow — smoke first.

## Why

Five files, each self-teardowning (exit code 0, no leaked workers/sockets):
`rpc-roundtrip` (parentPort latency/throughput), `gateway-roundtrip` (same
shapes, json vs messagepack), `payload-codec` (tiny/64KB/mixed struct),
`pool-scale` (execute/broadcast at N=1/2/4/8), `reconnect-storm`
(kill/restart cycles, time-to-recover). Socket paths are unique per run
(`pid`+`Date.now`+counter) — parallel/looped runs never collide or
`EADDRINUSE`.

## Incorrect

```bash
bun bench/*.bench.ts # shell glob: shared flags lost, teardown interleaved
bun test bench/ # benches are not tests; never in the suite or CI
```

## Correct

```bash
bun run bench # all five files, chained
BENCH_FILTER="echo single" bun bench/rpc-roundtrip.bench.ts # one bench, fast
BENCH_N=1000 bun run bench # smaller datasets for quick iteration
```

## Notes

- Benches are `@internal`-style: excluded from `bun test` and CI by
  filename (`*.bench.ts` never matches the test globs).
- Setup awaits use `withTimeout` from `test/helpers` — a stuck spawn fails
  the bench instead of hanging the runner.
- Storm bench restarts the server on a FRESH path per cycle (named-pipe
  release delay makes rebind flaky on win32).
