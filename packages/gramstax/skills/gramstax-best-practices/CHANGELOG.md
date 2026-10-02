# Changelog

## 2.0.0

Realigns the skill with **gramstax v2.2.0**. The v2.1 rules taught an entrypoint
and a deploy grammar that no longer exist, so most rule files were rewritten
rather than amended.

### New rules

- `config-boot.md` (new `config-` category, priority 1) — the mandatory
  `gramstax.config.ts`, `BotCore` discovery, path-ref slots, boot precedence.
- `config-programmatic.md` (new, `config-`) — the **advanced** entry path:
  constructing `new BotCore(...)` directly, for cases the config shape cannot
  express (cluster, multi-bot, a worker thread running its own bot, custom
  supervisor, embedding in a larger app, `raw`, benchmarks). Also clarifies that
  `@gramstax/worker-thread` is a background-job runner launched from
  `hookAfterStart`, not a bot-instance scaler.
- `pages-base-classes.md` (new, `pages-`) — gate a page family by extending a
  base class that defines `hookBeforeRoute`. Covers admin access plus the cases
  beyond hooks (telemetry, cooldowns, shared `g*`, shared defaults), when *not*
  to use a base class, and the split against `GuardBase`.
- `deploy-build.md` (new, `deploy-`) — `gramstax build`, the `.gramstax/` tree,
  AOT output, manifest boot, which deploys consume the output, and what actually
  reaches a deployed entry.
- `template-aot.md` (new, `template-`) — AOT is always on for `gramstax build`;
  the `with()` script-block restriction and the four distinct staleness failures.
- `route-render-api.md` (new, `route-`) — `renderChunked`, `renderEditCaption`,
  `renderEditKeyboard`, `renderGift`, and the template-backed query answers.

### Rewritten

- `route-hooks.md` — the load-bearing correction: there are **two**
  `hookBeforeRoute` gates, not one. Bot-level takes `(ctx, data)` and runs before
  matching; page-level takes **no args**, runs on the instantiated page, and
  renders the denial itself. AND semantics, and they fail differently.
- `deploy-modes.md` — nested `optionsDeploy` branches with the one-branch rule,
  serverless keyed by adapter, mandatory `url` + `secretToken`.
- `deploy-runtime.md`, `cache-store.md` — tuning moved from constructor args to
  config fields and path-refs.
- `guard-guards.md` — restructured around *choosing* between a family gate, a
  `GuardBase` check, and a bot-wide gate.

### Corrected

- `keyboard-reuse.md` — dropped the static `Helper` class that
  `pages-structure.md` already declared retired (internal contradiction).
- `e2e-setup.md` — documented that e2e is the one place the constructor form is
  still correct, and why it must not load `gramstax.config.ts`.
- `e2e-flows.md` — added the access-denial path both-directions requirement.
- `template-logic.md` — authoritative 29-block `ALLOWED_BLOCKS_PAGE` registry;
  `<g-script>` / `{~~}` flagged as AOT-blocked.
- `pages-structure.md`, `route-render-auto.md` — base-class selection, render
  cross-references.

### Framework defects found and fixed while verifying

Verifying every rule against source surfaced JSDoc that documented renamed or
never-existing members. All fixed in the framework:

| File | Defect |
| --- | --- |
| `core/ctx.ts:2090,2109` | `hookBeforeRoute` docs called `renderAnswerCallback` with 1 arg; real method is `renderCallbackAnswer(showAlert, data, AGBaseId, options?)` |
| `core/ctx.ts` ×10 | route examples used `this.msgText`; correct is `this.msg?.text` |
| `core/ctx.ts` ×24 | route examples used `this.msgCaption`; correct is `this.msg?.caption` |
| `core/ctx.ts:6623,6659` | examples named `handleTextArgs` / `handleCommandTextArgs`; the handlers are `handleArgsText` / `handleCommandArgsText` |
| `core/ctx.ts:6662` | singular `msgTextArg` shown with an array value |
| `core/ctx.ts:6718` | malformed `msgCaptionArgs["123", "aaa"]` (missing `//`) |
| `core/bot.ts:2552` | `templateManager._path` → `.path` |
| `template/manager.ts:628,631,634` | `_getBaseAtLine` → `getGBaseAtLine` |
| `template/manager.ts:752` | `compile()` missing an `@param filename` line |

`metrics.counts.blocked` counts session-lock contention and bot-level hook
denials only, **never** a page-level gate denial — documented in
`route-hooks.md`, `deploy-runtime.md`, and `e2e-flows.md`, since the recommended
admin pattern is page-level.

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