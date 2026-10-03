# bench-runner

One shared harness, three knobs, eleven benches.

## Why

Ad-hoc timing loops (manual warmup, `hrtime` diffs, hand-rolled rankings) measure harness noise as often as code. mitata tunes iterations, reports distributions, and controls GC — the shared `_setup.ts` keeps all eleven bench files honest the same way.

## Command cheat sheet

Every bench file has one script (`packages/lmdb/package.json:23-34`). Run from the repo root with `bun run --cwd packages/lmdb` or from `packages/lmdb` directly.

| Script | File | What it measures |
| --- | --- | --- |
| `bench:crud` | `bench/crud.bench.ts` | Point ops: `put`, `get`, `has`, `delete`, `count` throughput |
| `bench:queue` | `bench/queue.bench.ts` | `LmdbQueue` enqueue/dequeue throughput |
| `bench:range` | `bench/range.bench.ts` | Range scans, keyset vs offset pagination |
| `bench:queries` | `bench/queries.bench.ts` | `like`, `findByPrefix`, filtered reads |
| `bench:transaction` | `bench/transaction.bench.ts` | Multi-op transaction commit cost |
| `bench:decode` | `bench/decode.bench.ts` | Value decode at scale (defaults to 500k rows) |
| `bench:concurrent` | `bench/concurrent.bench.ts` | Contended reads/writes across workers |
| `bench:codec` | `bench/codec.bench.ts` | Record codec encode/decode shapes |
| `bench:index` | `bench/index.bench.ts` | Secondary-index write/read maintenance |
| `bench:batch` | `bench/batch.bench.ts` | `putMany` batches, sorted vs unsorted |
| `bench:ttl` | `bench/ttl.bench.ts` | TTL put/read/expire throughput |
| `bench:quick` | crud + transaction + ttl | Fast subset (`BENCH_N=1000`, crud also `BENCH_CONC=10`) |
| `bench:all` | all eleven, in order | Full suite — slow, decode alone seeds 500k rows |

## Knobs

All three knobs live in `bench/_setup.ts:5-7` and are read per run — no code edits needed.

| Knob | Effect | Example |
| --- | --- | --- |
| `BENCH_N` | Dataset/populate size for that file (each file has its own `benchSize(fallback)` default) | `BENCH_N=1000 bun run bench:crud` |
| `BENCH_CONC` | CSV concurrency list, concurrent bench only (default `10,50,100`) | `BENCH_CONC=10,50 bun run bench:concurrent` |
| `BENCH_FILTER` | Regex passed to mitata `run({filter})` — selects benches by name | `BENCH_FILTER="count" bun run bench:crud` |

## Smoke-run discipline

A full file run seeds tens of thousands of rows before measuring anything. When iterating on one bench, filter first and scale down second — a `BENCH_FILTER` that selects exactly one bench per file keeps the feedback loop under seconds.

```typescript
// smoke run: one bench, tiny dataset — the inner loop while editing a bench
// BENCH_N=100 BENCH_FILTER="get (existing" bun run bench:crud
```

## Incorrect

```typescript
// wrong: hand-rolled stats — warmup guesswork, no distribution, GC pauses included silently
const t0 = process.hrtime.bigint()
await op()
samples.push(process.hrtime.bigint() - t0)
```

```typescript
// wrong: full-suite run to check one bench — seeds the whole dataset, waits minutes
// for a signal one filtered run gives in seconds
// bun run bench:all // to inspect a single `get` bench
```

```typescript
// wrong: editing the file to shrink the dataset — the knob already exists,
// and the edit risks being committed with a 100-row default
const POPULATE = 100 // wrong: use BENCH_N=100 instead of touching benchSize(20_000)
```

## Correct

```typescript
import {bench, group} from `mitata`
import {benchSize, populateSync, runBench, setupEnv} from `./_setup`
const POPULATE = benchSize(20_000) // correct: BENCH_N overrides per run, default stays in code
const {env} = setupEnv(`lmdb-bench-x-`, 5) // correct: temp dir + open env, no cleanup boilerplate
populateSync(env, POPULATE, (i) => items.putSync(`k${i}`, row(i))) // correct: unmeasured setup
group(`X / reads`, () => {
  bench(`get (3 reqs)`, async () => {
    // measured body only
  })
})
await runBench() // correct: honors BENCH_FILTER regex, no extra wiring
```

```typescript
// correct: single-bench smoke run while iterating — tiny data, one mitata bench
// BENCH_N=100 BENCH_FILTER="put (new key" bun run bench:crud
// correct: fast regression pass before pushing — subset, not the full suite
// bun run bench:quick
```

## Notes

- Scripts: `bench:<name>` per file, `bench:quick` (`BENCH_N=1000` on crud+transaction+ttl, crud also `BENCH_CONC=10`), `bench:all` (full suite, decode defaults to 500k rows).
- Extra knobs: `BENCH_CONC` (csv list, concurrent bench only, default `10,50,100`).
- Benches are `@internal` scripts — excluded from `bun test` and CI.
- Labels state the per-iteration request count — see `bench-writing.md` for the labeling discipline.
- Destructive ops need per-iteration containment — see `bench-writing.md` for the mitata adaptive-iteration trap.
