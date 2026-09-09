# query-count

Count from stat, not from walks — and know which count you need.

## Why

`count()` reads the O(1) `mdb_stat` entry count (flat across DB sizes; proven to 200k rows). `countByPrefix()` walks the range (O(matches)) — correct, but linear by nature. An earlier cursor-walk `count()` was replaced after scaling tests proved O(n).

## Incorrect

```typescript
// linear walk to learn a number the stat already knows
const n = (await users.keys()).length
```

## Correct

```typescript
users.count() // O(1) stat — hot-loop safe
await users.countByPrefix(`admin:`) // O(matches), no materialization
```

## Notes

- `count(tx)` inside a snapshot keeps the walk path (stat has no snapshot) — same number, snapshot-correct.
- dupSort subs count key-value pairs in both methods — consistent.
