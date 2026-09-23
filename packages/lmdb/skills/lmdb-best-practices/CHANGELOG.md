# Changelog

## 1.2.0

- Query-scale epic: 4 new rules (`search.md`, `cdc.md`, `migrate.md`,
  `sync.md`) plus a `cross-cutting` section in `_sections.md`.
- `index-declaration.md` / `query-index-reads.md`: composite `.index([a, b])`
  tuples, prefix/range seeks, one-composite-per-query.
- `index-maintenance.md`: composite + search-table maintenance parity.
- `query-bulk-writes.md`: `{sorted: true}` MDB_APPEND path (~7x at 100k),
  `importJSONL` progress, inversion errors.
- `schema-design.md`: record-codec note plus pointers to search/composite/
  version rules; `schema-hooks-ttl.md`: codec bypass note.
- `txn-transactions.md`: CDC publish-on-commit pointer.

## 1.1.0

- Breaking rename `.nullable()` → `.optional()` across all rules; columns are
  required by default and optional fields are truly omit-able.
- New rules: `schema-enum.md` (`t.enum` homogen sets + `LmdbError`
  write-time validation) and `schema-defaults.md` (`.default()` /
  `.$defaultFn()` write-time fill, last-wins, declaration-time checks).

## 1.0.0

- Initial release: router `SKILL.md` + 17 rule files across 7 categories
  (`query-`, `index-`, `env-`, `schema-`, `txn-`, `bench-`, `maintain-`),
  plus `_sections.md` index and `_template.md` for new rules.
- Rules distilled from measured optimization work: O(1) stat count,
  bounded guardrail counting, `findByIndex` batch + `{limit}`, keyset
  pagination evidence, putMany TTL semantics, purge chunking.
