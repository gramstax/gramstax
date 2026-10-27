# bench-writing

JIT-honest benches with readable labels and self-contained cases.

## Why

Modern JITs eliminate side-effect-free code, hoist loop invariants, and pause for GC unpredictably. A bench that ignores this measures the optimizer, not the database. And a label without request counts (`get (existing)`) cannot be read per-op.

## JIT-honest vs JIT-dishonest shapes

| Shape | Honest | Dishonest | Why it matters |
| --- | --- | --- | --- |
| Result use | `do_not_optimize(await items.get(k))` | bare `await items.get(k)`, result dropped | Dead-code elimination removes the read entirely |
| Keys per iteration | computed (`randKey()`, `seq++`) | constant literal (`get(`k1`)`) | Loop-invariant motion hoists the lookup out of the loop |
| Setup placement | `populateSync` before `group`, outside closures | seeding inside the measured closure | Setup cost lands in the measured number |
| GC control | `.gc(`inner`)` on allocation-heavy benches | default GC | A mid-iteration collection spikes one sample and skews the distribution |
| Iteration count | label states it (`3 reqs`, `500 puts/1 txn`) | bare name (`get`, `scan`) | No per-op reading without the count |

## Destructive-op containment

mitata chooses the iteration count adaptively at runtime — the measured closure runs more times than you wrote. A destructive op inside the closure (delete a fixed key, drain a queue) exhausts its data partway through: later iterations measure empty-set behavior or throw, and the reported numbers are garbage.

The rule: every destructive iteration must bring its own data. Unique keys per iteration (`del:${seq++}:`) or an in-closure refill keep each iteration independent of how many ran before it.

## Incorrect

```typescript
// wrong: result discarded — DCE-eligible, the JIT may delete the read
bench(`get`, async () => {
  for (const k of keys) await items.get(k)
})
```

```typescript
// wrong: label without counts plus default GC on a 100k-row materialization
bench(`scan`, () => items.entries())
```

```typescript
// wrong: fixed key deleted every iteration — drains after N iterations, throws mid-run
// once mitata exceeds the seeded rows
bench(`delete`, async () => {
  await items.delete(`one-shot`)
})
```

## Correct

```typescript
// correct: observable side effect per read, GC pinned, label states the count
bench(`get (existing, 3 reqs)`, async () => {
  for (const k of existingKeys) do_not_optimize(await items.get(k)) // correct: result escapes, DCE defeated
}).gc(`inner`) // correct: GC before each iteration on allocation-heavy benches
```

```typescript
// correct: unique prefix per iteration — never drains, never flakes,
// independent of mitata's adaptive iteration count
let seq = 0
bench(`delete (3 rows + setup, 2 txns)`, async () => {
  const p = `del:${seq++}:` // correct: fresh keys each iteration
  env.rootTransactionSync(() => {
    for (let i = 0; i < 3; i++) items.putSync(`${p}${i}`, row)
  })
  await users.deleteByPrefix(p)
})
```

## Numbers discipline

Identical code swings 2-4x between runs on throttled hardware. Report orders, not digits: normalize A/B comparisons with an invariant anchor bench run in the same process, and distrust any single sample under a 3x gap. Never quote a number you did not measure in this run — stale figures from a previous machine mislead worse than no figures.

## Notes

- Labels state per-iteration counts: `(3 reqs)`, `(500 puts/1 txn)`, `(500 matches)`.
- Setup/populate stays outside measured closures; computed (non-constant) keys per iteration defeat loop-invariant motion.
- Numbers discipline: identical code swings 2-4x between runs on throttled hardware — report orders, normalize A/B with an invariant anchor, distrust sub-3x single samples.
- Runner, knobs, and smoke runs — see `bench-runner.md`.
