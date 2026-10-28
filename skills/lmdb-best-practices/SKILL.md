---
name: lmdb-best-practices
description: Best practices for @gramstax/lmdb (LMDB key-value store): class-only src with per-module types under src/types/, schema-class declaration via LmdbSchema + register(), embedded unique/non-unique/composite indexes, full-text search, CDC subscriptions, migrations, differential sync, sorted bulk import, production env sizing (mapSize, maxDbs), high-performance query patterns, transactions, TTL, queues, backup lifecycle, restart-safe scheduled jobs, and mitata benchmarking. Use when working in packages/lmdb, designing schemas or indexes, tuning LMDB performance, debugging slow queries, sizing databases for production scale, syncing data, or writing bench files.
compatibility: Bun >= 1.0.0 or Node.js >= 18; @gramstax/lmdb workspace (packages/lmdb)
metadata:
  version: 6.1.0
  author: gramstax
  organization: gramstax
  scope: packages/lmdb
---

# LMDB Best Practices

Performance and maintenance rules for `@gramstax/lmdb`, distilled from production-scale optimization (Telegram bot, millions of users). Read `AGENTS.md` in `packages/lmdb` for API truth; this skill adds the judgment layer.

**Current source shape.** The source is class-only — every helper is a static member or an instance method on the class that owns it, and the shared `I*` types live under `src/types/` (one file per module, re-exported from the barrel). The old escape hatches (`LmdbRepository`, `LmdbCollection`, `LmdbCodec`, `_createRepo`, static `codec`/`serialize`/`deserialize`/`ttlMs`, schema-class-first env methods, raw `dbName` overloads) are **deleted**, not deprecated. `register(SchemaClass)` is the only declaration path and it returns a pre-bound `LmdbEnvSub<S>` handle.

## When to Apply

Reference these rules when:
- Designing schemas, keys, or value shapes
- Adding unique/non-unique/composite embedded indexes or search markers
- Diagnosing slow queries or write amplification
- Sizing `mapSize`/`maxDbs` for production
- Writing transactions, TTL, CDC, migration, sync, or queue code
- Scheduling recurring work, or reviewing a backup/retry loop that must survive restarts
- Writing or interpreting mitata benchmarks
- Reviewing storage code for maintenance risk

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Query Patterns | CRITICAL | `query-` |
| 2 | Index Design | CRITICAL | `index-` |
| 3 | Env Sizing | HIGH | `env-` |
| 4 | Schema Design | HIGH | `schema-` |
| 5 | Cross-cutting features | HIGH | `search`, `cdc`, `migrate`, `sync`, `backup-schedule` |
| 6 | Transactions, TTL & Queue | MEDIUM-HIGH | `txn-` |
| 7 | Benchmarking | MEDIUM | `bench-` |
| 8 | Maintenance | LOW-MEDIUM | `maintain-` |

## Start Here

| Task | Read first |
| --- | --- |
| Compilation error on an old API (`LmdbRepository`, `LmdbCodec`, `dbName`) | `references/schema-design.md`, then `references/schema-hooks-ttl.md` |
| A query is slow or scans too much | `references/query-index-reads.md`, `references/query-range-scans.md` |
| Page 100+ of a listing is slow | `references/query-pagination.md` |
| `LmdbError: MDB_MAP_FULL` or sub-DB slots exhausted | `references/env-sizing.md` |
| Unique conflict, or an index looks stale | `references/index-declaration.md`, `references/index-maintenance.md` |
| Adding change-data-capture or a sync consumer | `references/cdc.md`, `references/sync.md` |
| Scheduling a recurring job, or a backup that must survive restarts | `references/backup-schedule.md` |
| Rewriting rows on a schema change | `references/migrate.md` |
| Full-text search returns nothing or ranks wrong | `references/search.md` |
| Enqueue/dequeue ordering or durability | `references/txn-queue.md` |
| Writing or interpreting a benchmark | `references/bench-writing.md`, `references/bench-runner.md` |

## How to Use

Read individual rule files for explanations with incorrect vs correct examples:

```
references/query-pagination.md
references/index-write-cost.md
references/_sections.md
```

Each rule file contains:
- Why it matters (with measured impact where known)
- Incorrect code with explanation
- Correct code with explanation
- Package-specific notes (deviations from raw lmdb-js)

## References

- `packages/lmdb/AGENTS.md` — API truth and package conventions
- `packages/lmdb/README.md` — full user documentation
- `packages/lmdb/bench/` — mitata benchmarks proving the numbers
