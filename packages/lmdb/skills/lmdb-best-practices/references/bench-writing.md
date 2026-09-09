# bench-writing

JIT-honest benches with readable labels and self-contained cases.

## Why

Modern JITs eliminate side-effect-free code, hoist loop invariants, and pause for GC unpredictably. A bench that ignores this measures the optimizer, not the database. And a label without request counts (`get (existing)`) cannot be read per-op.

## Incorrect

```typescript
bench(`get`, async () => { for (const k of keys) await items.get(k) }) // result discarded: DCE-eligible
bench(`scan`, () => items.entries()) // 100k-row materialization, default GC
bench(`delete`, async () => { await items.delete(`one-shot`) }) // drains after N iterations: throws mid-run
```

## Correct

```typescript
bench(`get (existing, 3 reqs)`, async () => {
  for (const k of existingKeys) do_not_optimize(await items.get(k)) // observable side effect
}).gc(`inner`) // GC before each iteration on allocation-heavy benches
bench(`delete (3 rows + setup, 2 txns)`, async () => {
  const p = `del:${seq++}:` // unique per iteration: never drains, never flakes
  env.rootTransactionSync(() => { for (let i = 0; i < 3; i++) items.putSync(`${p}${i}`, row) })
  await users.deleteByPrefix(p)
})
```

## Notes

- Labels state per-iteration counts: `(3 reqs)`, `(500 puts/1 txn)`, `(500 matches)`.
- Setup/populate stays outside measured closures; computed (non-constant) keys per iteration defeat loop-invariant motion.
- Numbers discipline: identical code swings 2-4x between runs on throttled hardware — report orders, normalize A/B with an invariant anchor, distrust sub-3x single samples.
