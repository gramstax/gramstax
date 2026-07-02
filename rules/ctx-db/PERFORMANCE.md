# Performance Guidelines

## Complexity Reference

| Operation               | Complexity   | Notes                                   |
| ----------------------- | ------------ | --------------------------------------- |
| `get(key)`              | O(1)         | Direct page lookup                      |
| `set(key, value)`       | O(1)         | Write to page cache                     |
| `has(key)`              | O(1)         | Same as get                             |
| `delete(key)`           | O(1)         | Remove from page cache                  |
| `count()`               | O(1)         | LMDB maintains per-sub-db count         |
| `getMany(keys)`         | O(M)         | M = number of keys, parallel page fault |
| `entries({start, end})` | O(log N + M) | Range scan, M = results                 |
| `findByPrefix(prefix)`  | O(log N + M) | Prefix scan via range                   |
| `countByPrefix(prefix)` | O(log N + M) | LMDB getKeysCount                       |
| `clear()`               | O(N)         | Removes all entries                     |
| `iterate()`             | O(N)         | Streams all entries lazily              |

## Counting

**Prefer `count()` for total entries — it's O(1) and LMDB-maintained.**

```typescript
// ✅ O(1) — LMDB keeps an accurate count per sub-database
const total = await repo.count();
```

For per-group counts (e.g., items per user), use a dedicated counter repository:

```typescript
class CounterRepo extends LmdbRepository<
  { seq: number; count: number },
  number
> {
  static dbName = `counters`;

  async total(userId: number): Promise<number> {
    return (await this.get(userId))?.count ?? 0; // O(1)
  }
}
```

## Range Queries

**Always bound range queries.** An unbounded `entries()` scans the entire sub-database.

```typescript
// ❌ BAD — reads ALL entries into memory
const all = await repo.entries();

// ✅ GOOD — bounded range query
const prefix = `${userId}:`;
const end = `${prefix}\uffff`;
const page = await repo.entries({ start: prefix, end, limit: 50, offset: 100 });
```

**How `\uffff` works:** LMDB range queries use exclusive end bounds. The Unicode character `\uffff` (a very high code point) acts as a sentinel — `${userId}:\uffff` is the first key that does NOT start with `${userId}:`. This creates an efficient prefix range scan.

## Pagination

Always pass `limit` and `offset` to prevent loading the entire dataset:

```typescript
async list(userId: number, page: number, pageSize: number = 20) {
  const offset = (page - 1) * pageSize
  const prefix = this.keyPrefix(userId)
  const end = `${prefix}\uffff`
  const entries = await this.entries({start: prefix, end, limit: pageSize, offset})
  return entries.map(([_, v]) => v)
}
```

## Batch Operations

**Use `getMany()` instead of N individual `get()` calls:**

```typescript
// ✅ FAST — parallel page faults
const users = await userRepo.getMany([1, 2, 3, 4, 5]);

// ❌ SLOW — N sequential round-trips
const u1 = await userRepo.get(1);
const u2 = await userRepo.get(2);
const u3 = await userRepo.get(3);
```

**Use `prefetch()` before a known batch of reads:**

```typescript
const ids = [100, 200, 300, 400, 500];
await userRepo.prefetch(ids); // background page-fault, non-blocking
const users = await Promise.all(ids.map((id) => userRepo.get(id))); // hot cache
```

## Like / Prefix Queries

`findByPrefix()` uses LMDB's native range scan — O(log N + M). It's efficient and preferred over iterating all entries with a filter.

`like()` with a prefix pattern (ending with `*`) also uses range scan. Non-prefix patterns fall back to full scan + regex filter.

```typescript
// ✅ Efficient — range scan
await repo.findByPrefix(`admin:`);

// ✅ Efficient — prefix pattern detected
await repo.like(`admin:*`);

// ❌ Slower — full scan + filter
await repo.like(`*admin*`);
await repo.like(`?dmin`);
```

## Encoding Impact

| Encoding            | Read p50 (small) | Write | Size   | Best For                   |
| ------------------- | ---------------- | ----- | ------ | -------------------------- |
| `msgpack` (default) | ~84µs            | Fast  | Small  | Production, large payloads |
| `json`              | ~50µs            | Fast  | Larger | Debugging, small objects   |

For typical bot data (small objects under 1KB), `json` is faster for reads because V8's `JSON.parse` is highly optimized. For large binary payloads, `msgpack` stores more compactly.

Set encoding at `LmdbEnv` construction:

```typescript
const env = new LmdbEnv({ path: `./data`, encoding: `json` });
```
