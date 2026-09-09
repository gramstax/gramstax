# Changelog

## 1.0.0

- Initial release: router `SKILL.md` + 17 rule files across 7 categories
  (`query-`, `index-`, `env-`, `schema-`, `txn-`, `bench-`, `maintain-`),
  plus `_sections.md` index and `_template.md` for new rules.
- Rules distilled from measured optimization work: O(1) stat count,
  bounded guardrail counting, `findByIndex` batch + `{limit}`, keyset
  pagination evidence, putMany TTL semantics, purge chunking.
