# query-point-reads

Use synchronous point reads; never pay async overhead per key.

## Why

`get()`/`has()`/`count()` are synchronous native calls. `await` on them is harmless but hides the sync nature and invites `Promise.all` fan-out where a batch API exists. `count()` is a true O(1) `mdb_stat` — safe in hot loops; an earlier cursor-walk implementation was replaced after scaling tests proved O(n).

## Incorrect

```typescript
// N sequential awaits = N microtask hops + N native round trips
for (const k of keys) results.push(await users.get(k))
const n = await users.count()
```

## Correct

```typescript
// sync reads need no await; batch reads use one native prefetch
for (const k of keys) results.push(users.get(k))
const found = await users.getMany(keys) // one batch for many keys
const n = users.count() // O(1) stat, hot-loop safe
```

## Notes

- Measured: `getMany(10)` ≈ one batch vs 10 sequential gets (`bench/crud.bench.ts`).
- `has()` skips decode — prefer it over `get()` for existence probes.
- `getStrict(key, tx?)` throws `LmdbError` when absent (no `undefined` branch); `getEntry(key)` returns `{version, value}` for version-aware reads.
