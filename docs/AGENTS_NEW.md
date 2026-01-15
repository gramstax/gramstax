# AGENTS_NEW (Bot Project Guidance)

## Purpose

- Guides agentic coding assistants working on Gramstax-based bot projects.
- This file is for user-side bot projects generated from templates.
- Focus on `src/` app code, not core library internals.

## Anti-Hallucination Pattern

- Confirm APIs, files, and commands by reading the project before stating them.
- If a symbol or file is not found, say so and ask for the correct path.
- Never invent scripts, CLI flags, or configuration keys.
- Quote exact names/paths from source when describing behavior.
- When uncertain, propose the next concrete check instead of guessing.

## Expected bot project structure

- `src/base` for shared base classes (`guard.ts`, `page.ts`).
- `src/blocks` for template block helpers (`keyboard.ts`).
- `src/core` for runtime entry points (`bot.ts`, `ctx.ts`).
- `src/labels` for label/translation helpers (`keyboard.ts`).
- `src/guards` for guard checks (`__example.ts` removable once real guards exist).
- `src/pages` for page handlers (`start.ts`, `general-status.ts`).
- `src/utils` for logging and helpers (`log.ts`).
- Optional: `src/db`, `src/repositories`, `src/services`.

## Runtime and commands

- Use `bun` as the runtime and package manager.
- Check `package.json` for available scripts before running commands.
- Run tests with `bun test` if a test suite exists.
- Run a single test file with `bun test <path/to/file>`.
- Run a single test by name with `bun test --filter "<Name>"`.

## Gramstax bot (bot.ts) API essentials

- Construct with `new Gramstax({ token, deploy, log, cacheSession, cacheKeyboard, templateManager, optionsPage })`.
- `deploy` values: `polling`, `webhook:<url>`, or `serverless:<adapter>`.
- `log` accepts a `LoggingPretty` instance or `true` for auto-created logger.
- `cacheSession` uses `CacheExternal` (defaults to in-memory cache).
- `cacheKeyboard` defaults to `new Map()` for keyboard caching.
- `templateManager` defaults to the `src/pages` loader if omitted.
- `optionsPage.shortCallbackData` toggles numeric callback keys (default `false`).
- Properties: `.bot`, `.pages`, `.templateManager`, `.cacheSession`, `.cacheKeyboard`, `.log`, `.handlerBotUpdate`.
- Lifecycle hooks: `hookBeforeStart()`, `hookAfterStart()`, `hookBeforeRoute(ctx, listenerName)`, `hookErrorPage(ctx, listenerName, error, isEdit)`, `hookErrorInputNotFoundPage(ctx)`.
- Routing priority: `staticSession` → `static` → `staticIntent` → `dynamicSpecific` → `dynamic`.

## Ctx base class (ctx.ts) API essentials

- Static `.template` defines HTML-like blocks; omit to rely on external templates.
- Static `.data` comes from `buildData()` and configures routing metadata.
- `buildData` signatures: `buildData()`, `buildData(dataCallbackFn)`, or `buildData({ dataCallback, intentText, intentTextCommand })`.
- `dataCallback` must return an array (use `[]` for no payloads).
- `intentText` applies to `text()` and `textPayload()`; `intentTextCommand` applies to `textCommand()` and `textCommandPayload()`.
- Intent defaults derive from the filename (`this.data.name`) unless overridden.
- User properties: `userId`, `userName`, `userFirstName`, `userLastName`, `userFullName`, `userLanguage`, `userIsPremium`, `userIsBot`.
- Message properties: `msgText`, `msgTextPayload`, `msgTextPayloads`, `msgCaption`, `msgPhoto`, `msgVideo`, `msgAudio`.
- Callback properties: `callbackData`, `callbackDataPayload`, `callbackDataPayloads`.
- Session helpers: `sessionGet`, `sessionSet`, `sessionClear`, plus `sessionCallback`, `sessionCallbackPayload`, `sessionText`, `sessionTextPayload`, `sessionTextFree`.
- Reply helpers: `reply`, `replyPhoto`, `replyVideo`, `replyAudio`, `replyDocument`, `replyAnimation`, `replyVoice`, `replyVideoNote`, `replySticker`, `replyLocation`, `replyContact`.
- Edit helpers: `edit`, `editPhoto`, `editVideo`, `editAudio`, `editDocument`, `editAnimation`.
- Utilities: `delete`, `callbackQueryAnswer`.
- Keyboard builders: `inlineKeyboard((k, a) => ...)` and `bottomKeyboard((k, a) => ...)`.
- Page transition: `to(data?)` to move to another page instance.
- Route methods include `callback`, `callbackPayload`, `text`, `textPayload`, `textCommand`, `textCommandPayload`, `textFree`, and media caption/free variants (`photoCaption*`, `videoCaption*`, `audioCaption*`, `documentCaption*`, `animationCaption*`, `voiceCaption*`, `videoNoteCaption*`, plus `stickerFree`, `locationFree`, `contactFree`, `free`).

## Template system essentials

- Templates use `<base>` blocks; missing `id` implies `default`.
- `<message>` renders text with `{{key}}` interpolation from `data`.
- `<keyboard>` defines comma-separated labels; `type="bottom"` for reply keyboards.
- `<media>` is the only supported media block (no `<photo>`, `<video>` tags).
- `<map src="items" join="\\n">` iterates arrays with `{{e}}`, `{{e.prop}}`, `{{i}}` must be use double slash if join like this \\n not this \n.
- `<switch value="status">` with `<case is="a,b">` and `<default>` for fallback.
- `<import src="other" block="message,keyboard" base="default" />` for reuse.
- `{~ ... ~}` and `<script>` evaluate JS; return empty string on errors.

## Template best practices

- Use a single `<base>` when keyboards are identical across variants.
- Reuse the default keyboard without providing a `baseId`.
- Avoid duplicate `<base>` blocks that only change the `id`.
- Use `buildData(...)` only when callback payloads are required.
- `dataCallback` must return an array (use `[]` for no payloads).
- Avoid `intentTextCommand` unless overriding filename-derived defaults.
- `textFree()` only fires when text exists; no empty-text guard needed.
- Prefer core handlers (`textCommand`, `callback`, `callbackPayload`) over wrappers.
- Use destination page callbacks like `BalancePage.data.callback()`.
- `callbackQueryAnswer()` is auto-handled for routed callbacks; call only for custom toasts.

## Performance and safety tips

- Cache keyboard and data objects before `edit`/`reply` calls.
- Avoid passing `{}` unless you need a `baseId` argument.
- Prefer fast paths by reusing computed data and avoiding duplicate lookups.

## Page and routing rules

- Pages must export a class (not default export) that extends `Ctx`.
- Centralize guard/account checks before routing into page handlers.
- Prefer classes for mandatory flow components and keep state inside classes.

## Template manager notes

- Templates can be defined by static `template` strings or `.html` files.
- Only `.html`, `.ts`, and `.js` sources are supported; `.tpl` is not.
- Hot reload uses file watching; ensure paths exist before enabling.

## Coding style for bot projects

- Use backticks for strings and avoid semicolons.
- Keep imports grouped: builtins, third-party, internal.
- Use `import type` for type-only imports.
- Prefer `const` and explicit types at public boundaries.
- Avoid unused imports/variables; keep exports named.

## Error handling and logging

- Validate inputs early and throw clear `Error` messages.
- Wrap IO/network work in `try/catch`.
- Use `log`/`LoggingPretty` utilities for user-visible errors.
- Use `String(error)` when logging unknown error types.

## Notes for agents

- Treat this file as the primary guide for generated bot projects.
- Do not modify Gramstax core unless explicitly requested.
