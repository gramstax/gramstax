---
name: lmdb-best-practices
description: Best practices for @gramstax/lmdb (LMDB key-value store): schema design, embedded unique/non-unique indexes, production env sizing (mapSize, maxDbs), high-performance query patterns, transactions, TTL, queues, and mitata benchmarking. Use when working in packages/lmdb, designing schemas or indexes, tuning LMDB performance, debugging slow queries, sizing databases for production scale, or writing bench files.
compatibility: Bun >= 1.0.0 or Node.js >= 18; @gramstax/lmdb workspace (packages/lmdb)
metadata:
  author: gramstax
  organization: gramstax
  scope: packages/lmdb
---

# LMDB Best Practices

Performance and maintenance rules for `@gramstax/lmdb`, distilled from production-scale optimization (Telegram bot, millions of users). Read `AGENTS.md` in `packages/lmdb` for API truth; this skill adds the judgment layer.

## When to Apply

Reference these rules when:
- Designing schemas, keys, or value shapes
- Adding unique/non-unique embedded indexes
- Diagnosing slow queries or write amplification
- Sizing `mapSize`/`maxDbs` for production
- Writing transactions, TTL, or queue code
- Writing or interpreting mitata benchmarks
- Reviewing storage code for maintenance risk

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Query Patterns | CRITICAL | `query-` |
| 2 | Index Design | CRITICAL | `index-` |
| 3 | Env Sizing | HIGH | `env-` |
| 4 | Schema Design | HIGH | `schema-` |
| 5 | Transactions, TTL & Queue | MEDIUM-HIGH | `txn-` |
| 6 | Benchmarking | MEDIUM | `bench-` |
| 7 | Maintenance | LOW-MEDIUM | `maintain-` |

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
- Gramstax-specific notes (deviations from raw lmdb-js)

## References

- `packages/lmdb/AGENTS.md` — API truth and package conventions
- `packages/lmdb/README.md` — full user documentation
- `packages/lmdb/bench/` — mitata benchmarks proving the numbers
