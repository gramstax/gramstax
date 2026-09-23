# bench-runner

One shared harness, three knobs, eleven benches.

## Why

Ad-hoc timing loops (manual warmup, `hrtime` diffs, hand-rolled rankings) measure harness noise as often as code. mitata tunes iterations, reports distributions, and controls GC — the shared `_setup.ts` keeps all eleven bench files honest the same way.

## Incorrect

```typescript
// hand-rolled stats: warmup guesswork, no distribution, GC pauses included silently
const t0 = process.hrtime.bigint(); await op(); samples.push(process.hrtime.bigint() - t0)
```

## Correct

```typescript
import {bench, group} from "mitata"
import {benchSize, populateSync, runBench, setupEnv} from "./_setup"
const POPULATE = benchSize(20_000) // BENCH_N overrides per run
const {env} = setupEnv(`lmdb-bench-x-`, 5) // temp dir + open env
populateSync(env, POPULATE, (i) => items.putSync(`k${i}`, row(i))) // unmeasured setup
group(`X / reads`, () => { bench(`get (3 reqs)`, async () => { /* measured */ }) })
await runBench() // honors BENCH_FILTER regex
```

## Notes

- Scripts: `bench:<name>` per file, `bench:quick` (`BENCH_N=1000` on crud+transaction+ttl; crud also `BENCH_CONC=10`), `bench:all` (full suite; decode defaults to 500k rows).
- Extra knobs: `BENCH_CONC` (csv list, concurrent bench only, default `10,50,100`).
- Benches are `@internal` scripts — excluded from `bun test` and CI.
