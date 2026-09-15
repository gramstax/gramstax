# Changelog

## 1.2.0

- New rules: `template-media.md`, `template-i18n.md` (template-),
  `keyboard-choice.md` (keyboard-). 26 rules total.

## 1.1.0

- New rules: `route-hooks.md`, `route-broadcast.md` (route-),
  `template-rich.md` (template-), `guard-guards.md` (new `guard-`
  category), `cache-store.md` (new `cache-` category). Router table
  and `_sections.md` updated (9 categories, 23 rules).

## 1.0.0

- Initial release: router `SKILL.md` + 17 rule files across 7 categories
  (`route-`, `security-`, `template-`, `keyboard-`, `pages-`, `e2e-`,
  `deploy-`), plus `_sections.md` index and `_template.md` for new rules.
- Rules distilled from `DEPRECATED-rules/` (pages, e2e, structure, linting)
  and the `example/` projects, updated against current source:
  `renderAuto*` family with `fallbackEdit`, `{{var|filter}}` pipes,
  `<g-media-group>`, `deploy: "raw"`, session locking, and the
  concat-codegen trust boundary proven by `security-poc/`.
