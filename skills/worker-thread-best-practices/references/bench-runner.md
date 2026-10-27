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

## Command cheat-sheet

Run from `packages/worker-thread` — `bun run bench` chains all five files
sequentially (`package.json:23`); each file also runs standalone:

| File | What it measures | Groups inside |
| --- | --- | --- |
| `bench/rpc-roundtrip.bench.ts` | `parentPort` RPC round-trip, single + concurrent batch | `RPC / round-trip` |
| `bench/gateway-roundtrip.bench.ts` | socket round-trip, json vs messagepack | `Gateway / json`, `Gateway / messagepack` |
| `bench/payload-codec.bench.ts` | codec throughput across sizes, json vs messagepack | `Codec / json`, `Codec / messagepack` |
| `bench/pool-scale.bench.ts` | `execute` rate and `broadcastRequest` fan-out at N=1/2/4/8 | `Pool / execute round-robin`, `Pool / broadcast fan-out` |
| `bench/reconnect-storm.bench.ts` | time-to-recover per kill/restart cycle | `Gateway / reconnect-storm` |

The rpc and gateway round-trip files use IDENTICAL payload shapes
(`SMALL_PAYLOAD` at `bench/_setup.ts:34`) — the comparison is like-for-like
by construction. Fixture workers live in `bench/fixtures/` (never inline):
`echo-worker.ts`, `gateway-echo-worker.ts`.

## Knobs

| Knob | Where it lands | Effect |
| --- | --- | --- |
| `BENCH_N` | `benchSize(fallback)` at `bench/_setup.ts:24` | batch / payload-size multiplier (`BATCH`, `BIG_KB`) |
| `BENCH_FILTER` | `runBench()` at `bench/_setup.ts:57` → mitata `run({filter})` | regex selecting which benches actually run |

`BENCH_N=1000 bun run bench` shrinks datasets for quick iteration;
`BENCH_N` unset keeps each file's default (`10` batch, `64` KB big string).

## Smoke-run discipline

A smoke run selects exactly ONE bench per file via `BENCH_FILTER` — never
run the full suite to check that a bench still boots:

```bash
BENCH_FILTER="json echo single" bun run ./bench/gateway-roundtrip.bench.ts
```

Pick a filter that matches a single `bench()` label (labels state the
per-iteration request count — see `bench-writing`). Full suites are slow and
flaky under load; smoke first, then run the file, then the suite.

## The unique-socket-path trap

Socket paths MUST stay unique per server. `uniqueSocketPath` at
`bench/_setup.ts:28` builds one from `pid` + `Date.now()` + a counter — a
reused path collides with a stale socket file left by a previous run and
HANGS the runner instead of failing loudly. That silence is the trap: no
error, no timeout message, just a bench that never finishes.

Consequences for bench code:

- Never hardcode a socket path — always call `uniqueSocketPath()`.
- The storm bench restarts the server on a FRESH path per cycle
  (`reconnect-storm.bench.ts:38`) — named-pipe release delay makes rebind
  flaky on win32, so recycle-never-rebind.
- Stale files are unlinked best-effort (`unlinkStaleSocket` at `:26`, skipped
  on win32 pipes) — cleanup is a courtesy, uniqueness is the guarantee.

## Incorrect

```bash
bun bench/*.bench.ts # shell glob: shared flags lost, teardown interleaved
```

```bash
bun test bench/ # benches are not tests; never in the suite or CI
```

```bash
bun run ./bench/gateway-roundtrip.bench.ts # full file when one bench would do
```

## Correct

```bash
bun run bench # all five files, chained
```

```bash
BENCH_FILTER="echo single" bun bench/rpc-roundtrip.bench.ts # one bench, fast
```

```bash
BENCH_N=1000 bun run bench # smaller datasets for quick iteration
```

```bash
BENCH_FILTER="json echo single" bun run ./bench/gateway-roundtrip.bench.ts # smoke run
```

## Notes

- Benches are `@internal`-style: excluded from `bun test` and CI by
  filename (`*.bench.ts` never matches the test globs).
- Setup awaits use `withTimeout` from `test/helpers` — a stuck spawn fails
  the bench instead of hanging the runner.
- Storm bench restarts the server on a FRESH path per cycle (named-pipe
  release delay makes rebind flaky on win32).
- Shared helpers (`spawnEchoWorker`, `spawnGatewayPair`, `makePool`,
  `runBench`, `benchSize`) all live in `bench/_setup.ts` — new bench files
  reuse them instead of re-spawning (see `bench-writing`).
- Naming, formatting, and file-placement conventions for new benches live in
  `maintain-style-tests`.
