# query-point-reads

Use synchronous point reads; never pay async overhead per key.

## Why

`get()`/`has()`/`count()` are synchronous native calls (`sub.ts:2404`). `await` on them is harmless but hides the sync nature and invites `Promise.all` fan-out where a batch API exists. `count()` is a true O(1) `mdb_stat` (`sub.ts:757`) — safe in hot loops; an earlier cursor-walk implementation was replaced after scaling tests proved O(n).

## Sync vs async dispatch

Point reads stay on the calling thread; writes and batch helpers return promises. The split is deliberate: lmdb-js queues async writes and flushes them in one batch on the next microtask, while a sync read has nothing to batch — wrapping it in a promise would add a microtask hop for zero benefit.

| Call | Shape | Cost | Reach for it when |
| --- | --- | --- | --- |
| `get(key, tx?)` | sync `T \| undefined` | one B-tree seek plus one decode | you need the row |
| `has(key, tx?)` | sync `boolean` | seek, no decode | existence probe only |
| `count(tx?)` | sync `number` | O(1) stat without `tx` | totals, hot loops |
| `getStrict(key, tx?)` | sync `T`, throws `LmdbError` | same as `get` plus one branch | the key must exist |
| `getEntry(key)` | sync `{version, value} \| undefined` | seek plus decode | version-aware reads |
| `getMany(keys)` | async `(T \| undefined)[]` | one batch, slots aligned with input order | many keys at once |
| `prefetch(keys)` | async `void` | page faults up front | warming pages before a batch read |

Two consequences fall out of the table. First, `getMany` is the only fan-out: it returns misses as `undefined` slots in input order (`sub.ts:741`), so no manual order reconstruction. Second, `has` is strictly cheaper than `get` for boolean questions — the probe never materializes the row (`sub.ts:644`).

## Incorrect

```typescript
// wrong: N sequential awaits add N microtask hops to calls that never needed one
// wrong: awaiting a sync value also teaches the next reader that this is IO
for (const k of keys) results.push(await users.get(k))
// wrong: `await` on a sync number — harmless, but signals async work to callers
const n = await users.count()
```

```typescript
// wrong: N concurrent native seeks where one batch call does the same work
// wrong: result order must be rebuilt by hand — `getMany` aligns it for you
const rows = await Promise.all(keys.map((k) => users.get(k)))
```

```typescript
// wrong: pays a full decode to answer a boolean question
// wrong: on a hot path (dedupe checks, id reservation) the decode dominates the seek
function isTaken(id: number): boolean {
  return users.get(id) !== undefined
}
```

## Correct

```typescript
// sync reads need no await; batch reads use one native prefetch
for (const k of keys) results.push(users.get(k))
// one batch for many keys — slots align with input order, misses stay `undefined`
const found = await users.getMany(keys)
// O(1) stat, hot-loop safe
const n = users.count()
```

```typescript
// existence without decode — the probe never materializes the row
if (users.has(id)) return `taken`
// must-exist read — throws `LmdbError` instead of an `undefined` branch
const row = users.getStrict(id)
// version-aware read — `{version, value}` for compare-and-swap flows
const entry = users.getEntry(id)
```

```typescript
// every point read takes a trailing `tx` — pin one snapshot for a consistent burst
await users.owner.readTransaction(async (tx) => {
  const a = users.get(idA, tx)
  const b = users.has(idB, tx)
  return [a, b]
})
```

## Notes

- Measured: `getMany(10)` ≈ one batch vs 10 sequential gets (`bench/crud.bench.ts`).
- `has()` skips decode — prefer it over `get()` for existence probes.
- `getStrict(key, tx?)` throws `LmdbError` when absent (no `undefined` branch); `getEntry(key)` returns `{version, value}` for version-aware reads.
- Point reads never touch the materialization guardrail (`MAX_MATERIALIZE` only gates the range paths, `sub.ts:455`) — no `{limit}` needed here.
- Secondary-key point reads are a different path — see `query-index-reads.md`. Multi-row reads belong in `query-range-scans.md`.
