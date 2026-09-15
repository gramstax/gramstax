# Sections Index

Map of rule files by category prefix. Read only the files relevant to the task — each is self-contained.

## route- (CRITICAL)

- `route-render-auto.md` — `renderAuto*` default, forced send/edit, `fallbackEdit`, no manual `callbackQuery` branching
- `route-session.md` — session lifecycle: clear on start, `handleSessionFreeText`, never fetch manually
- `route-handlers.md` — thin handlers delegating to `g*` show/process pairs
- `route-hooks.md` — `hookBeforeRoute`/`hookAfterRoute`/`hookErrorPage`/`hookNotFoundPage` + `StatusPage`
- `route-broadcast.md` — `renderBroadcast*` fan-out with per-user langs, counts, throttling

## security- (CRITICAL)

- `security-trust-boundary.md` — templates are code, data is untrusted input; never concatenate user input into template source
- `security-output-encoding.md` — `{{}}` escapes, `{{{}}}` raw by design, filter whitelist

## template- (HIGH)

- `template-logic.md` — conditionals live in templates (`<g-switch>`, `{~~}`, `<g-script>`), single-base dedup
- `template-scope.md` — scopes emit values only, double-quote literals, structural branches use blocks
- `template-filters.md` — `{{var|filter:arg}}` pipes, chaining, `default` semantics
- `template-rich.md` — 54-tag allowlist, self-closing voids, attribute validation

## keyboard- (HIGH)

- `keyboard-reuse.md` — `kbk` centralization (2+ pages), local single-use builds
- `keyboard-labels.md` — `kbl` composites, short action-led labels with emoji

## pages- (HIGH)

- `pages-structure.md` — file order (imports → Base → consts → Helper → Page), `g*` show/process contract, `static data`
- `pages-naming.md` — kebab-case files, parent-child routes, `sN` base ids, `bi`/`kb`/`da` shorthands
- `pages-data.md` — `buildData` typings and `callbackQueryData` args

## e2e- (MEDIUM-HIGH)

- `e2e-setup.md` — `setup.ts` template, mirror layout, isolation, `stream`/`autoRetry`
- `e2e-validation.md` — message/keyboard/media/edit/multi-call/stream assertions
- `e2e-flows.md` — fallback pages, session reset/isolation, language variants

## deploy- (MEDIUM)

- `deploy-modes.md` — polling/webhook/serverless/raw/test selection, `ready`, startup hooks
- `deploy-runtime.md` — rate limiting, outgoing throttling, session lock, status server

## guard- (MEDIUM)

- `guard-guards.md` — `GuardBase` access control, `_catch` to `StatusPage`, language override

## cache- (MEDIUM)

- `cache-store.md` — `CacheExternal` memory/Redis/`forceStore`, TTL, namespaces
