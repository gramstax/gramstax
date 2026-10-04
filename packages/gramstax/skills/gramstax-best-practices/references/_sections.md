# Sections Index

Map of rule files by category prefix. Read only the files relevant to the task — each is self-contained.

Aligned with **gramstax v2.2.0**.

## config- (CRITICAL)

- `config-boot.md` — mandatory `gramstax.config.ts`, `BotCore` discovery, path-ref slots, boot precedence
- `config-programmatic.md` — advanced: constructing `new BotCore(...)` directly (cluster, multi-bot, own-thread bot, custom supervisor, embedded, `raw`)

## route- (CRITICAL)

- `route-render-auto.md` — `renderAuto*` default, forced send/edit, `fallbackEdit`, no manual `callbackQuery` branching
- `route-render-api.md` — the render family incl. `renderChunked`, `renderEditCaption`, `renderEditKeyboard`, `renderGift`
- `route-session.md` — session lifecycle: clear on start, `handleSessionFreeText`, never fetch manually
- `route-handlers.md` — thin handlers delegating to `g*` show/process pairs
- `route-hooks.md` — the **two** `hookBeforeRoute` gates (bot-level vs page-level), states, full hook surface
- `route-broadcast.md` — `renderBroadcast*` fan-out with per-user langs, counts, throttling

## security- (CRITICAL)

- `security-trust-boundary.md` — templates are code, data is untrusted input; never concatenate user input into template source
- `security-output-encoding.md` — `{{}}` escapes, `{{{}}}` raw by design, filter whitelist

## template- (HIGH)

- `template-logic.md` — conditionals live in templates (`<g-ifelse>`, `<g-switch>`, `<g-script>`), single-base dedup vs layouts
- `template-aot.md` — ahead-of-time compilation, `with()` restriction, regenerate discipline, parity suite
- `template-scope.md` — scopes emit values only, double-quote literals, structural branches use blocks
- `template-filters.md` — `{{var|filter:arg}}` pipes, chaining, `default` semantics
- `template-rich.md` — 54-tag allowlist, self-closing voids, attribute validation
- `template-media.md` — `g-media`/`g-media-group` authoring, pipe groups, delete-then-send types
- `template-i18n.md` — `lang` variants, `intentTextMap`, default fallback

## keyboard- (HIGH)

- `keyboard-reuse.md` — `kbk` centralization (2+ pages), local single-use builds
- `keyboard-labels.md` — `kbl` composites, short action-led labels with emoji
- `keyboard-choice.md` — inline (edit in place) vs bottom (text input) selection

## pages- (HIGH)

- `pages-base-classes.md` — base-class policy: admin gate via `hookBeforeRoute`, cases beyond hooks, vs `GuardBase`
- `pages-structure.md` — file order, `extends` choice, `g*` show/process contract, `static data`
- `pages-naming.md` — kebab-case files, parent-child routes, `sN` base ids, `bi`/`kb`/`da` shorthands
- `pages-data.md` — `buildData` typings and `callbackQueryData` args

## e2e- (MEDIUM-HIGH)

- `e2e-setup.md` — `setup.ts` harness (constructor, not config file), mirror layout, isolation
- `e2e-validation.md` — message/keyboard/media/edit/multi-call/stream assertions, reading captured payloads
- `e2e-flows.md` — fallback pages, session isolation, access-denial paths, language variants

## deploy- (MEDIUM)

- `deploy-modes.md` — `deploy` + one matching `optionsDeploy` branch, adapter-keyed serverless, mandatory secrets
- `deploy-build.md` — `gramstax build`, `.gramstax/` tree, AOT output, manifest boot, serverless entries
- `deploy-runtime.md` — rate limiting, outgoing throttling, session lock, status server, metrics

## guard- (MEDIUM)

- `guard-guards.md` — choosing between a family gate, a `GuardBase` check, and a bot-wide gate

## cache- (MEDIUM)

- `cache-store.md` — `cacheSession` builtin/path-ref forms, memory/Redis/`forceStore`, TTL, namespaces