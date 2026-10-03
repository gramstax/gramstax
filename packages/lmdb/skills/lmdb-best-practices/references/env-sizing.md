# env-sizing

Size the map and count the sub-DBs before deploy, not after the crash.

## Why

`mapSize` defaults to 4 GB (`options.mapSize ?? 4 * 1024 * 1024 * 1024`, `env.ts:231`) and `maxDbs` defaults to 128 (`options.maxDbs ?? 128`, `env.ts:232`). Millions of rows exceed the map and throw a runtime `LmdbError`; schemas times indexes exhaust the sub-DB slots and throw mid-registration. Both failure modes hide in dev and detonate in production, where data volume and the full schema set finally meet.

## What consumes a slot

Every sub-DB opened against the env costs one `maxDbs` slot, and the count runs wider than the schema list:

| Consumer | Slots | When opened |
| --- | --- | --- |
| Each registered schema (primary sub) | 1 | `register()` |
| Each `.unique()` / `.index()` column | 1 per column | `register()` |
| Each composite table (`.index([...])`) | 1 | `register()` |
| Each search column (`.search()`) | 1 per column | `register()` |
| Each queue payload sub | 1 | `new LmdbQueue()` |
| `__queue_meta` sequence counters | 1, shared | first `new LmdbQueue()` |
| `__cdc_log` + `__cdc_meta` | 2 | first CDC touch, lazy |
| `__sync_state` | 1 | first `syncTo()`, lazy |

Breaching the cap throws mid-registration. Below 32 remaining slots a one-time `console.warn` fires, but only on production-scale configs (`maxDbs >= 32`, `sub-manager.ts:255`).

## The lazy-open trap

CDC and sync slots open lazily on first use, so a budget counted from the boot registration list silently undercounts. The failure arrives weeks later: the first `subscribe()` or `syncTo()` on a new code path opens `__cdc_log` + `__cdc_meta` (or `__sync_state`) with no free slot left, and the open throws. Touch every CDC and sync API once at boot in staging, or budget those 3 lazy slots up front, so the registration order you tested matches the one production runs.

## Worked example

Six schemas (`users` with 2 unique + 1 plain index, `orders` with 1 composite, `sessions` with TTL, `docs` with 1 search column, `counters` scalar) plus one queue, plus CDC at runtime:

| Consumer | Slots |
| --- | --- |
| 6 primary subs | 6 |
| `users` indexes (2 unique + 1 plain) | 3 |
| `orders` composite table | 1 |
| `docs` search posting table | 1 |
| queue payload + `__queue_meta` | 2 |
| `__cdc_log` + `__cdc_meta`, lazy | 2 |
| Total committed before headroom | 15 |

`maxDbs: 16` fits today and breaks on the next schema. `maxDbs: 32` leaves room to grow. Recompute this table on every schema change, not once at launch.

## Incorrect

```typescript
// wrong: bare defaults for a production dataset, 4 GB map and 128 slots against millions of rows
// wrong: the breach throws a runtime `LmdbError` in prod, never in dev
class Db extends LmdbEnv {
  constructor() {
    super({path: `./data`})
    this.register(UserSchema)
  }
}
```

```typescript
// wrong: map sized at 1x expected data, growth needs 10-50x headroom
// wrong: registration already refuses below 10% free map, so tight maps fail at boot
class Db extends LmdbEnv {
  constructor() {
    super({path: `./data/prod`, mapSize: 2 * 1024 * 1024 * 1024})
  }
}
```

```typescript
// wrong: slots counted from schemas only, the first `subscribe()` opens `__cdc_log` + `__cdc_meta` with no free slot
// wrong: throws mid-run, weeks after deploy, on a path that passed staging
class Db extends LmdbEnv {
  constructor() {
    super({path: `./data/prod`, maxDbs: 8}) // 6 schemas + 2 indexes = 8, CDC forgotten
  }
}
```

## Correct

```typescript
// correct: map at 10-50x expected data, `mapSize` is virtual address space, not RAM
// correct: slots counted from the table above, lazy CDC included, with room to grow
class Db extends LmdbEnv {
  constructor() {
    super({path: `./data/prod`, mapSize: 40 * 1024 ** 3, maxDbs: 32})
  }
}
```

```typescript
// correct: monitor in production, `{total, used, free, ratio}` returns synchronously
// correct: act before `ratio` nears 10% free, where registration starts refusing
const usage = db.getMapSizeUsed()
if (usage.ratio < 0.3) {
  alert(`map pressure: ${usage.used} of ${usage.total} bytes used`)
}
```

## Notes

- `mapSize` is virtual address space, not RAM, so oversizing is nearly free while undersizing throws `LmdbError` at runtime.
- Registration refuses new sub-DBs below 10% free map (`sub-manager.ts:199`); the `<= 32` remaining-slots `console.warn` fires once and only when `maxDbs >= 32`.
- Locks: `test/env.b2.test.ts` pins the 4 GB default via `getMapSizeUsed().total`; `test/sub-manager.test.ts` stubs the 10% refusal.
- See `env-runtime.md` for what each constructor option does once it is sized.
