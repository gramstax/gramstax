# env-sizing

Size the map and count the sub-DBs before deploy, not after the crash.

## Why

`mapSize` default is 4 GB (`options.mapSize ?? 4 * 1024 * 1024 * 1024`) and `maxDbs` default is 128. Millions of rows exceed the map (runtime `LmdbError`); many schemas × indexes exhaust sub-DB slots (throw mid-registration). Both fail in production, never in dev.

## Incorrect

```typescript
new LmdbEnv({path: `./data`}) // 4 GB map, 128 subs — for millions of users
```

## Correct

```typescript
const db = new Db(`/data/prod`) // mapSize: 40 * 1024 ** 3, maxDbs: 512
db.getMapSizeUsed() // {total, used, free, ratio: free/total} — registration throws below 10% free
// slot budget: schemas + Σ indexes + 2 per queue (__queue_meta included)
```

## Notes

- `mapSize` is virtual address space, not RAM — oversizing is nearly free.
- Registration refuses below 10% free map; a one-time `console.warn` fires at remaining `<= 32` sub-DB slots, only when `maxDbs >= 32` (production configs only).
