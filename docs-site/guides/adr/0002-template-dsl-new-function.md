# ADR-0002: Template DSL compiled with `new Function()`

<Info>
  **Status:** Accepted

  **Date:** 2025 (inferred from package history)
</Info>

## Context

Pages need a declarative way to describe messages, keyboards, and media that supports multilingual content and runtime data interpolation (`{{name}}`). Hand-building Telegram `reply_markup`/HTML strings in every handler is repetitive and error-prone. A small HTML-like DSL (`<g-base>`, `<g-message>`, `<g-keyboard>`, `<g-media>`, `<g-description>`, plus `<g-switch>`/`<g-map>`/`<g-script>`/`<g-div>`/`<g-space>`/`<g-import>`/`<g-names>`) lets authors write layout once.

These templates must render fast (per-update) and support arbitrary data scopes, so the compiled output should be a callable function, not a repeated regex pass at send time.

## Decision

`TemplateEngine` parses the `<g-*>` DSL and Telegram Rich HTML into **render functions created with `new Function("data", body)`** (`src/template/engine.ts:1284` and `:1287`). Compilation happens **once** at load (or on hot-reload) and the result is cached by `TemplateManager._map` as `ICompiledTemplate` (`message`/`keyboard`/`media`/`description` keyed by base id + language). Scopes/interpolation (`{{var}}`, switch, map, script, div) are resolved into the generated function body.

<Warning>
  The compiled output is dynamic code, so a runtime that forbids `new Function`
  cannot execute it — some sandboxes and CSP setups do. For those runtimes, see
  the [AOT contract](/guides/aot-contract), which emits frozen modules instead.
</Warning>

## Consequences

### Benefits

- Per-update rendering is a plain function call — no repeated parsing.
- Templates can embed dynamic expressions via scope blocks.
- Two-layer validation (`_TELEGRAM_REQUIRED_ATTRS`/`_PAGE_REQUIRED_ATTRS` + value validators) catches obvious authoring bugs before compile.

### Trade-offs

- `new Function()` is dynamic code generation (some sandboxes/CSP disallow it); acceptable here because templates are **first-party authoring**, not user-supplied untrusted input. See the [AOT contract](/guides/aot-contract) for the codegen-free output path.
- Errors surface at compile time, not necessarily at the exact template location (the engine still reports line numbers via validators).

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| Pure string templating (no compile) | Slower per-update; harder to cache render logic. |
| JSX/TSX templates | Heavier tooling; authors wanted a markup DSL close to the Telegram HTML output. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Code | `src/template/engine.ts:1284,1287` — `return new Function("data", functionBody) as any` |
| Code | `src/template/engine.ts:1270` — `_compileToFunction<T>(template, isArray)` |
| Code | `src/template/engine.ts:1333-1638` — compile call sites for media/message/keyboard/description |
| Docs | `AGENTS.md` — "Template pipeline is regex/parser-based with `new Function()` compilation." |
| Docs | `AGENTS.md` — "Complexity Hotspots: template/engine.ts (Parser + compiler + validator in one file)" |

## Related

- [Architecture](../architecture.md) — Components: TemplateEngine, TemplateManager
- [ADR-0005](/guides/adr/0005-hot-reload-chokidar.md) — recompile on file change
