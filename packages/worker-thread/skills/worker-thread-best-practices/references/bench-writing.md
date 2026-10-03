# bench-writing.md

Verdict: mitata `bench`/`group`/`run`; spawn/connect/pool in setup, only the
RPC call inside the measured closure, `do_not_optimize` every result.

## Why

Measuring spawn or connect pollutes the sample with one-time costs (thread
boot ~ms vs RPC ~µs: single-digit µs numbers drown). Shared `bench/_setup.ts`
holds `spawnEchoWorker`, `spawnGatewayPair`, `makePool`, `runBench`
(`BENCH_FILTER` → `run({filter})`), `BENCH_N` size knob. One unmeasured
priming round-trip after connect keeps lazy socket setup out of sample one.

## JIT-honest vs JIT-dishonest shapes

Every bench primes ONCE unmeasured before the measured loop, so JIT warmup
and first-touch page faults are not attributed to the code under test:

| Bench file | Prime (unmeasured) | Where |
| --- | --- | --- |
| `rpc-roundtrip` | `mtdPing` round-trip after spawn | `bench/_setup.ts:38` inside `spawnEchoWorker` |
| `gateway-roundtrip` | `ping` round-trip after connect | `bench/_setup.ts:48` inside `spawnGatewayPair` |
| `payload-codec` | `ping` prime plus a `MIXED_STRUCT` echo prime | `bench/_setup.ts:48`, `:32` in the file |
| `pool-scale` | `mtdPing` broadcast across every pool | `pool-scale.bench.ts:24` before grouping |
| `reconnect-storm` | `ping` round-trip on the fresh client | `reconnect-storm.bench.ts:76` before grouping |

The rule is structural: spawn/connect/pool in setup, exactly one priming
call, then only the measured RPC inside the `bench()` closure. A bench with
no prime measures thread boot and lazy socket setup, not the operation named
in its label.

## The destructive-op containment rule

Mitata picks its iteration count ADAPTIVELY — it keeps sampling until the
statistics settle. Any destructive operation inside the measured closure
(delete, dequeue-drain) will eventually exhaust the data: the numbers become
garbage or the run throws halfway through. Destructive ops must be
self-contained per iteration — unique keys per iteration or a refill at the
top of the closure — so iteration N never depends on what iteration N-1 left
behind. Read-only echo shapes (`mtdEcho`, `ping`) are safe by construction;
the moment a bench mutates shared state, containment is mandatory.

## Numbers discipline

- Labels state the per-iteration request count (`1 req`, `10 reqs`,
  `500 puts/1 txn`) so a reader can normalize throughput without archaeology.
- Never quote a number you did not measure in this run — no copying figures
  from a previous run, a different machine, or CI into a comment or PR.
- Compare like-for-like only: same payload shape (`SMALL_PAYLOAD`), same
  batch size (`BENCH_N`), same filter scope. A json-vs-messagepack claim
  across different payloads measures the payload, not the codec.
- Setup awaits are wrapped in `withTimeout` so a stuck spawn fails loudly
  instead of hanging the suite — a hung setup is a failed bench, not a slow
  bench.

## Incorrect

```typescript
bench(`echo`, async () => {
  const w = await Job.launchWorker() // one-time cost measured every iter
  await (Job as any).mtdEcho(payload)
})
```

```typescript
// wrong: spawn cost and lazy socket setup land in sample one — no prime
const worker = await spawnEchoWorker() // prime skipped: first sample eats boot cost
bench(`echo single (1 req)`, async () => {
  do_not_optimize(await worker.request(`mtdEcho`, [SMALL_PAYLOAD]))
})
```

```typescript
// wrong: result discarded — the optimizer may elide the call entirely
// wrong: samples measure nothing while reporting success
bench(`echo single (1 req)`, async () => {
  await worker.request(`mtdEcho`, [SMALL_PAYLOAD]) // do_not_optimize missing
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

```typescript
// correct: setup once, prime unmeasured, measure only the call
const json = await spawnGatewayPair() // correct: connect + prime inside
bench(`json echo batch concurrent (10 reqs)`, async () => {
  do_not_optimize( // correct: every result consumed, nothing elided
    await Promise.all(Array.from({length: BATCH}, () => json.client.request(`echo`, [SMALL_PAYLOAD])))
  )
})
// teardown phase: close client AND server — a lingering server holds the socket
```

```typescript
// correct: destructive work contained per iteration — unique keys, no shared drain
// schematic callee: the point is per-iteration containment, not this method
bench(`delete unique keys (500 deletes)`, async () => {
  const keys = freshKeys(BATCH) // correct: rebuilt every iteration, never drained across iters
  do_not_optimize(await worker.request(`mtdDeleteBatch`, [keys]))
})
```

## Notes

- Labels state the per-iteration request count (`1 req`, `10 reqs`) so
  throughput math needs no archaeology.
- rpc vs gateway files use IDENTICAL payload shapes — the comparison is
  like-for-like by construction.
- Fixture workers live in `bench/fixtures/` (never inline): `echo-worker.ts`,
  `gateway-echo-worker.ts`.
- Teardown kills/closes EVERY worker, server, client, and pool — see the
  `finally` blocks in each file; `pool-scale` uses best-effort `killAll`.
- Runner knobs (`BENCH_N`, `BENCH_FILTER`) and the smoke-run discipline live
  in `bench-runner`; naming and placement conventions live in
  `maintain-style-tests`.
