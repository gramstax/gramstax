# AGENTS

## Purpose

- Provide commands and style guidance for agents working in this repo.
- Monorepo note: core library code lives in `packages/gramstax`.
- Assume a Bun + TypeScript + Nx monorepo workflow.
- Run commands from repository root unless noted.
- Keep changes focused and consistent with existing patterns.

## Repository Layout

- `packages/gramstax`: core library package (tsup build).
- `packages/create-gramstax`: CLI scaffolding tool (tsup build).
- `packages/*/src`: TypeScript sources.
- `packages/*/test`: Bun unit tests (currently only in `gramstax`).
- `packages/create-gramstax/src/templates`: template project files for the CLI.
- `example/`: sample projects used for references.
- `docs/`: documentation and API reference.
- `docs/AGENTS.md`: API reference; not repo-wide agent guidance.
- `eslint.config.ts`, `.prettierrc`, `tsconfig.json`, `nx.json`: global tooling config.
- `bunfig.toml`: Bun runtime config.

## Toolchain

- Package manager/runtime: `bun` (see `bun.lock`).
- Build orchestrator: `nx`.
- Bundler: `tsup` (invoked via `nx build` targets).
- Tests: `bun:test`.
- Linting: `eslint` + `typescript-eslint`.
- Formatting: Prettier config in `.prettierrc` (no script provided).
- Type checking: `tsc --noEmit` via `bun run ci:check`.

## Install

- `bun install`

## Build Commands

- `bun run build:all`
- `bun run build:gramstax`
- `bun run build:create-gramstax`
- `nx build gramstax`
- `nx build create-gramstax`

## Lint Commands

- `bun run lint`
- `bun run lint:fix`

## Typecheck Commands

- `bun run ci:check`
- `tsc --noEmit`

## Test Commands

- `bun run test`
- `bun test packages/gramstax/test/<file>.ts` (single test file)
- `bun test --filter "TemplateEngine"` (single test by name)
- `bun test packages/gramstax/test/core.bot.test.ts`
- `bun test packages/gramstax/test/template.engine.test.ts`
- `bun test --filter "TemplateManager"`
- `bun test --watch` (optional local dev)

## CI / Pre-push

- `bun run ci:test` (lint + typecheck + tests)
- `bun run prepush` (ci + build + safety echo)

## Release Commands (when asked)

- `bun run release`
- `bun run release:patch`
- `bun run release:minor`
- `bun run release:major`
- `bun run dry-run`
- `bun run publish:all`

## Formatting Rules

- Use Prettier settings from `.prettierrc`.
- 2-space indentation; `useTabs: false`.
- No semicolons (`semi: false`).
- `printWidth`: 300 for TS/JS, 200 for JSON.
- `trailingComma: none`.
- `bracketSameLine: false`.
- `bracketSpacing: false` (no spaces inside `{}`).
- `object-curly-spacing: never` (eslint rule).
- `arrowParens: always`.
- Prefer backticks for all strings (eslint `quotes: backtick`).

## Lint Rules (highlights)

- `@typescript-eslint/no-explicit-any: off` (allowed but avoid when possible).
- `@typescript-eslint/no-unused-vars: error` (remove or use values).
- `no-unused-vars: off` (handled by TS rule).
- `object-curly-spacing: never` (align with Prettier).
- `quotes: backtick` (use template literals).

## Imports

- Use ESM `import`/`export` (repo is `type: module`).
- Use `node:` prefixes for built-in modules (`node:fs`, `node:path`).
- Use `import type` for type-only imports.
- `~/*` path alias is available inside packages for `src` imports.
- Prefer relative imports for same-folder modules.
- Group imports by source (builtins, third-party, internal).
- Keep ordering consistent within each file.
- Remove unused imports; lint treats unused vars as errors.
- Prefer named exports over default exports unless a file already uses default.

## Types and TS Practices

- `strict: true` and `noUncheckedIndexedAccess: true` are enforced.
- Prefer explicit types at public boundaries (exports, callbacks, params).
- Add return types for exported functions when clarity helps.
- `any` is allowed but discouraged; use `unknown` or precise types.
- Use `type` aliases for unions and helper types; interfaces for public shapes.
- Keep generics focused and avoid overly broad constraints.
- Use `as` casts only when necessary; keep the cast narrow.
- Use `const` for values that do not change.
- Prefer `async`/`await` over raw promise chains.

## Naming Conventions

- Files and folders: lowercase or kebab-case (e.g., `worker-thread`).
- Classes, types, interfaces: PascalCase.
- Functions, variables, params: camelCase.
- Constants: `UPPER_SNAKE_CASE` or `__PKG_VERSION__` style for module-level constants.
- Keep public API names descriptive and concise.

## Error Handling and Logging

- Validate inputs early and throw `Error` with clear messages.
- Wrap IO/network work in `try/catch`.
- Prefer `log` or `LoggingPretty` for user-visible errors.
- Use `String(error)` when logging unknown error types.
- Avoid swallowing errors; return `null`/`undefined` only when expected.
- Favor early returns to keep control flow clear.

## Runtime and Build Notes

- Target runtime is `esnext` with bundler module resolution.
- Packages build into `packages/*/dist/src`.
- `bun` is used for tests and some runtime paths (e.g., webhook server).
- Keep Node compatibility unless a file explicitly uses Bun APIs.

## Testing Conventions

- Tests use `bun:test` (`describe`, `it`, `expect`).
- Keep tests under `packages/gramstax/test`.
- Use backticks in test strings to satisfy lint.
- Prefer deterministic inputs; avoid timers unless required.

## Template Guidelines

- When multiple `<g-base>` blocks share identical `<g-keyboard>` content, define it once in the default `<g-base>` (no `id`) and omit duplicates in other bases.
- Reuse the default keyboard by calling the inline/bottom keyboard builder without a `AGBaseId`.

## Telegram Rich HTML

Templates support 53 HTML/tg-\* tags passed through to the message `html` field, in 5 categories:

- _Inline (15):_ `a`, `b`, `code`, `del`, `em`, `i`, `ins`, `mark`, `s`, `strike`, `strong`, `sub`, `sup`, `tg-spoiler`, `u`
- _Block/structural (23):_ `aside`, `blockquote`, `blockquote expandable`, `br`, `details`, `footer`, `h1`-`h6`, `hr`, `li`, `ol`, `p`, `pre`, `summary`, `table`, `td`, `th`, `tr`, `ul`
- _Telegram-specific (8):_ `tg-collage`, `tg-emoji`, `tg-map`, `tg-math`, `tg-math-block`, `tg-reference`, `tg-slideshow`, `tg-time`
- _Media (6):_ `audio`, `cite`, `figcaption`, `figure`, `img`, `video`
- _Forms (1):_ `input`

**Format rules:**

- Void elements must be self-closing: `<hr/>`, `<img/>`, `<input/>`, `<br/>`, `<tg-map/>`. Content tags are not format-checked (both `<b>x</b>` and `<b/>` accepted).
- Enforced by `validateFormatBlock` in the same way as `<g-space/>` and `<g-import/>`.

**Attribute validation** (two layers, both wired into `validateTemplate` as steps 5 and 6):

- **Required attributes** — `TemplateEngine._TELEGRAM_REQUIRED_ATTRS` + `validateTelegramAttributesBlock`: e.g. `<a>` needs `href` or `name`; `<img>`/`<video>`/`<audio>` need `src`; `<tg-emoji>` needs `emoji-id`; `<tg-time>` needs `unix` + `format`; `<tg-map>` needs `lat` + `long` + `zoom`; `<tg-reference>` needs `name`; `<input>` needs `type`.
- **Value formats** — `TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS` + `validateTelegramAttributeValuesBlock`: e.g. `<tg-time unix>` must be a positive integer; `<tg-map lat>` ∈ [-90, 90], `<tg-map long>` ∈ [-180, 180], `<tg-map zoom>` ∈ [0, 24]; `<tg-emoji emoji-id>` must be numeric; `<a href>` must use `http(s)://`, `mailto:`, `tel:`, `tg://`, or `#` scheme; `<input type>` must be a known HTML input type.

Validators are intentionally lenient — they catch obvious bugs (wrong type, invalid scheme) but do not enforce every Telegram-side constraint. Text passthrough patterns (`#hashtag`, `$USD`, `+phone`, `card:`, `https://`, `t.me`, `a@t.me`, `/command`, `@username`) need no markup and are not in the tag list.

## PAGE Attribute Validation

`<g-*>` PAGE blocks follow the same two-layer validation pattern as Telegram Rich HTML, mirrored through the centralized specs `TemplateEngine._PAGE_REQUIRED_ATTRS` and `TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS`. Both layers are wired into `validateTemplate` as steps 21 and 22 (the per-block `validateBlockG*Attributes` methods at steps 7–20 stay for granular access and also delegate to the same value spec).

- **`_PAGE_REQUIRED_ATTRS`** — currently empty. PAGE block attributes are mostly optional; this spec is reserved for future context-dependent requirements.
- **`_PAGE_ATTR_VALUE_VALIDATORS`** — centralizes format checks for:
  - `<g-base id>` — must not be empty
  - `<g-keyboard type>` — must be `inline` or `bottom`
  - `<g-media type>` — must be one of: photo, video, audio, document, animation, voice, video_note, sticker, location, contact
  - `<g-media shared>` — must be `true` or `false`

Boolean attributes (without `=value`, e.g. `<g-media type="photo" src="x" shared>`) are intentionally skipped — they do not trigger the empty-string check. Per-block `validateBlockG*Attributes` methods have been refactored to read from `_PAGE_ATTR_VALUE_VALIDATORS`, so there is a single source of truth for value formats.

To add a new PAGE value validator: extend `_PAGE_ATTR_VALUE_VALIDATORS[tagName]` and the corresponding per-block method picks it up automatically. To add a new required-attr rule: extend `_PAGE_REQUIRED_ATTRS` and `validatePageAttributesBlock` will start enforcing it.

## Package: gramstax

- Source root is `packages/gramstax/src`; update `packages/gramstax/src/index.ts` when adding exports.
- Path alias `~/*` maps to `packages/gramstax/src/*` (from `packages/gramstax/tsconfig.json`).
- Build with `nx build gramstax` (tsup config in `packages/gramstax/tsup.config.ts`).
- Output artifacts live in `packages/gramstax/dist/src`.
- Run a single test with `bun test packages/gramstax/test/<file>.ts` or filter via `bun test --filter "Name"`.

## Template Project (create-gramstax)

- `packages/create-gramstax/src/templates` holds files copied into generated projects.
- Template directory has its own `.prettierrc` and `tsconfig.json`.
- When editing templates, keep formatting consistent with template rules.
- Updates to templates should be mirrored in CLI behavior if needed.

## Generated Artifacts

- Build output lives in `packages/*/dist`.
- Do not edit files in `dist`; update source and rebuild instead.
- Avoid committing generated build output unless explicitly required.

## Cursor/Copilot Rules

- No `.cursor/rules`, `.cursorrules`, or `.github/copilot-instructions.md` found.
