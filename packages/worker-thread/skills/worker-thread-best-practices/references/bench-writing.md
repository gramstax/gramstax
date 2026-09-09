# bench-writing.md

Verdict: mitata `bench`/`group`/`run`; spawn/connect/pool in setup, only the
RPC call inside the measured closure, `do_not_optimize` every result.

## Why

Measuring spawn or connect pollutes the sample with one-time costs (thread
boot ~ms vs RPC ~µs: single-digit µs numbers drown). Shared `bench/_setup.ts`
holds `spawnEchoWorker`, `spawnGatewayPair`, `makePool`, `runBench`
(`BENCH_FILTER` → `run({filter})`), `BENCH_N` size knob. One unmeasured
priming round-trip after connect keeps lazy socket setup out of sample one.

## Incorrect

```typescript
bench(`echo`, async () => {
  const w = await Job.launchWorker() // one-time cost measured every iter
  await (Job as any).mtdEcho(payload)
})
```

## Correct

```typescript
const worker = await spawnEchoWorker() // setup phase, once
bench(`echo single (1 req)`, async () => {
  do_not_optimize(await worker.request(`mtdEcho`, [SMALL_PAYLOAD]))
})
// teardown phase: kill workers, close servers/clients/pools — always
```

## Notes

- Labels state the per-iteration request count (`1 req`, `10 reqs`) so
  throughput math needs no archaeology.
- rpc vs gateway files use IDENTICAL payload shapes — the comparison is
  like-for-like by construction.
- Fixture workers live in `bench/fixtures/` (never inline): `echo-worker.ts`,
  `gateway-echo-worker.ts`.
