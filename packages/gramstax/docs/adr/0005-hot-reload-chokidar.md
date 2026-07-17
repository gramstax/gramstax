# ADR-0005: Hot-reload templates with `chokidar`

**Status:** Accepted
**Date:** 2025 (inferred from package history)

## Context

Templates (the `<g-*>` DSL) are the primary thing a bot author edits during development. Recompiling the whole bot on every template tweak — or restarting the process — breaks flow. The framework needs file-level change detection that works across platforms without polling.

## Decision

`TemplateManager` watches template source files with **`chokidar`** (`src/template/manager.ts:14` imports `watch, FSWatcher`). When `ITTemplateOptions.enableWatch` is set, the constructor calls `_initializeWatcher` and stores `FSWatcher` instances in `_watcher` (`manager.ts:71`). On add/change/delete it reloads and **recompiles** the affected template into `_map` — no bot restart required. Supported extensions are `.html`, `.ts`, `.js` (`_supportedExtensions`, `manager.ts:87`).

## Consequences

### Benefits

- Edit a template → see the change live, matching web-dev hot-reload expectations.
- `chokidar` gives robust cross-platform watching (no manual `fs.watch` quirks).

### Trade-offs

- A watcher process/descriptor is held open during dev.
- Recompilation is per-file but still runs the full `TemplateEngine` pipeline.

### Alternatives Considered

| Alternative | Why Not Chosen |
|-------------|---------------|
| `fs.watch` / `fs.watchFile` | Platform-inconsistent; recursive-watch and event coalescing are painful. |
| Poll on interval | Wastes CPU; latency between edit and reload. |

## Sources

| Source Type | Reference |
|-------------|-----------|
| Code | `src/template/manager.ts:14` — `import {watch, FSWatcher} from "chokidar"` |
| Code | `src/template/manager.ts:71` — `_watcher: FSWatcher[]` |
| Code | `src/template/manager.ts:87` — `_supportedExtensions = {".html",".ts",".js"}` |
| Code | `src/template/manager.ts:138` — `_initializeWatcher(options.watchOptions)` in constructor |
| Dependency | `package.json` — `"chokidar": "^4.0.3"` |
| Docs | `AGENTS.md` — "Supports hot-reload for template files via chokidar." |

## Related

- [Architecture](../architecture.md) — Components: TemplateManager
- [ADR-0002](0002-template-dsl-new-function.md) — recompiled output is cached `ITCompiledTemplate`
