# query-index-reads

Match the query shape to the index; cap every fan-out.

## Why

Unique-only queries resolve to one row via point lookups. Non-unique queries materialize candidates (most-selective index drives first), so an uncapped fan-out (`{subscribed: true}` at millions of rows) materializes gigabytes to return a slice. `{limit}` pages the driver with flat memory.

## Return shape follows the queried keys

`findByIndex(query, tx?, {limit}?)` (`sub.ts`) is the single read API — `findOneByIndex` was removed before release, never use it. The return shape is driven by the uniqueness of the QUERIED keys, not by how many rows happen to match:

| Queried keys | Return | Meaning |
| --- | --- | --- |
| All unique (`{username: ...}`) | `T \| undefined` | At most one row can match — branch on it directly |
| Any non-unique (`{email: ...}`) | `T[]` | Always an array, even for one row or zero |
| Mixed (`{username, email}`, email non-unique) | `T[]` | One non-unique key anywhere flips the whole result to array form |
| Contradictory keys | `undefined` / `[]` | AND filtered everything out — never an error |
| `{}` / null value / unknown key | throws `LmdbError` | Fail fast — there is no match-everything index query |

The type side mirrors the runtime: `SchemaIndexesOf` types `findByIndex` per schema, so an undeclared key is a compile error as well as a runtime `LmdbError`.

## Driver selectivity: unique first, then the rest

Multi-key queries AND every key. One key is picked as the driver — it seeds the candidate set — and the remaining keys only verify:

- Unique indexes are tried first, then non-unique ones, so the driver is the most selective key available
- The driver pages in chunks while `{limit}` is unsatisfied; each candidate is checked against the other keys
- A `{limit}` of `0` (or below) short-circuits to empty without touching the index
- Pass `tx` inside `readTransaction` / `transaction` so every point read of the query (index lookups plus primary fetches) shares one snapshot
- Composite queries allow at most one composite key per query — a second one throws `LmdbError`, so intersect separately

The practical rule: put the most selective key you have in the query and let the driver do the work, then cap the fan-out. An unbounded non-unique query materializes every match, so `{subscribed: true}` over millions of rows builds a gigabyte array to return a page.

## Incorrect

```typescript
// wrong: materializes 2M rows to keep 10 — OOM at scale
const top = (await users.findByIndex({subscribed: true})).slice(0, 10)
```

```typescript
// wrong: email is non-unique so this is always an array — `.id` is undefined
const user = await users.findByIndex({email: `a@b.com`})
await notify(user.id)
```

```typescript
// wrong: {} throws LmdbError — there is no match-everything index query
const all = await users.findByIndex({})
```

## Correct

```typescript
// unique-only query → row | undefined, branch on it directly
const user = await users.findByIndex({username: `damar`})
if (user === undefined) return `not-found`
```

```typescript
// non-unique query → rows, bounded with {limit} so memory stays flat
const batch = await users.findByIndex({subscribed: true}, undefined, {limit: 1000})
```

```typescript
// multi-key AND: the unique key drives, the non-unique key verifies
const admins = await users.findByIndex({username, subscribed: true}, undefined, {limit: 100})
```

```typescript
// composite point and bounded range share the same driver + {limit} rules
await orders.findByIndex({[`tenant+status`]: [`t1`, `active`]}) // point tuple
await orders.findByIndex({[`tenant+status`]: {start: [`t1`], end: [`t2`]}}, undefined, {limit: 500}) // range
```

```typescript
// snapshot read: every lookup in the query shares one pinned snapshot
await env.readTransaction(async (tx) => {
  return users.findByIndex({email}, tx, {limit: 100})
})
```

## Notes

- Measured: limit-100 of 5000 matches ≈ 37x vs unbounded (`bench` A/B).
- Contradictory keys → empty (`undefined`/`[]`), never error. `{}`/null/unknown key → `LmdbError`.
- Snapshot reads: pass `tx` (sequential path preserves the snapshot; native batch cannot pin it).
- Locked by `test/index-embedded.test.ts` + `test/non-unique-index.test.ts` (shape, AND, throw cases) and `test/composite-index.test.ts` (tuple, prefix, range queries).
- Sibling rules: `index-declaration.md` (which keys exist), `index-write-cost.md` (what each key costs per write), `index-maintenance.md` (who keeps the rows fresh), `query-bulk-writes.md` (how the rows got there).
