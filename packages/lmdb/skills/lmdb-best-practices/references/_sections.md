# Sections Index

Map of rule files by category prefix. Read only the files relevant to the task — each is self-contained.

## query- (CRITICAL)

- `query-point-reads.md` — sync `get`/`has`/`count`, O(1) stat count, `getMany` batching
- `query-range-scans.md` — bounded scans, guardrail + `iterate` escape hatch, `like` shapes
- `query-pagination.md` — keyset (`start`) vs `offset`, with measured deltas
- `query-index-reads.md` — `findByIndex` shapes, driver selectivity, `{limit}` fan-out guard
- `query-count.md` — `count()` vs `countByPrefix()` costs and when each applies
- `query-bulk-writes.md` — `putMany` chunking, `putIfNotExists`, `increment`, prefix deletes

## index- (CRITICAL)

- `index-declaration.md` — `.unique()` vs `.index()`, paths, conflicts, reindex
- `index-write-cost.md` — write amplification, hot-write separation, forbidden ops
- `index-maintenance.md` — automatic maintenance coverage, dupSort+versions, TTL interplay

## env- (HIGH)

- `env-sizing.md` — `mapSize` (virtual), `maxDbs` accounting + warning, monitoring
- `env-runtime.md` — encoding, compression, cache, `noSync`, replicas, `commitDelay`, versions

## schema- (HIGH)

- `schema-design.md` — declaration path, keys, values, scalar/dupSort shapes
- `schema-enum.md` — `t.enum` closed sets, literal params, write-time validation
- `schema-defaults.md` — required-by-default, `.optional()`, `.default()` fill
- `schema-hooks-ttl.md` — hook pairs, TTL envelope, `putMany` TTL semantics

## txn- (MEDIUM-HIGH)

- `txn-transactions.md` — sync callbacks, snapshots, tx pinning, queue ordering
- `txn-queue.md` — single-transaction enqueue/dequeue, reuse, FIFO guarantees
- `txn-ttl.md` — lazy expiry, `purgeExpired` chunking, purge strategy

## bench- (MEDIUM)

- `bench-runner.md` — mitata setup, `_setup` helpers, scripts, `BENCH_*` knobs
- `bench-writing.md` — JIT-honest benches, labels, destructive-op safety, numbers discipline

## maintain- (LOW-MEDIUM)

- `maintain-style-tests.md` — `bun:test` layout, Biome style, lifecycle, docs co-location

## cross-cutting (HIGH)

- `search.md` — `.search()` markers, posting tables, ranked `sub.search()` reads
- `cdc.md` — outbox capture, subscribe/tail/ack/prune, consumer groups
- `migrate.md` — idempotent transform backfills, skew checks, progress
- `sync.md` — checkpointed keyset copy, resume, count+hash verify
