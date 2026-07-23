# Gramstax Rules Index

This file is the entrypoint for rules in this directory.

## Active Rule Sets

### `main`

General project rules — initialization, structure, and code quality. Covers:

- `./INIT.md`: Scaffolding with `create-gramstax`, CLI flags, non-interactive mode
- `./PROJECT_STRUCTURE.md`: Directory layout, file naming (kebab-case + parent-child), and organization
- `./PRODUCTION_QUALITY.md`: Production standards, error handling, UX guidelines
- `./LINTING_RULES.md`: Formatting, linting, and code style enforcement

### `ctx-pages/`

Use this `_INDEX.md` as the module index for page-related rules. It currently covers:

- `./ctx-pages/ROUTING_FLOW.md`: routing logic, flow, and session handling
- `./ctx-pages/TEMPLATES_RENDERING.md`: template syntax, rendering, and conditional logic
- `./ctx-pages/KEYBOARDS.md`: keyboard blocks, labels, and reuse patterns
- `./ctx-pages/BASE_BLOCKS.md`: base block usage and ID naming
- `./ctx-pages/PAGE_STRUCTURE.md`: internal class composition, suffixes, and ordering
- `./ctx-pages/VARIABLE_NAMING.md`: standardized shorthands and naming rules
- `./ctx-pages/EXAMPLES.md`: reference implementations and code snippets

### `ctx-helpers/`

Use this `_INDEX.md` as the module index for helper-related rules. This rule set is currently a stub and should be expanded as helper conventions are documented.

### `ctx-e2e/`

Use this `_INDEX.md` as the module index for E2E test rules. It currently covers:

- `./ctx-e2e/E2E_STRUCTURE.md`: file layout, `setup.ts` template with `gmsg`/`gkb`/`gmedia` helpers, test file templates, assertion rules, session isolation, and Language variants.

### `ctx-db/`

Use this `_INDEX.md` as the module index for `@gramstax/lmdb` database layer rules. It currently covers:

- `./ctx-db/DB_ARCHITECTURE.md`: Architecture patterns, root DB class, repository design
- `./ctx-db/REPOSITORY_PATTERNS.md`: Repository CRUD, transactions, cross-repo access
- `./ctx-db/PERFORMANCE.md`: Performance guidelines, O(1) vs O(N), range queries
- `./ctx-db/MIGRATION_GUIDE.md`: Migrating from raw `lmdb` to `@gramstax/lmdb`

### `ctx-core/`

This section documents core architecture patterns and exceptions that apply to any Gramstax project.

#### Worker Bot — Use `deploy: "raw"` Instead

When a scheduler/worker thread needs a minimal Gramstax instance solely to call raw `bot.api` methods (e.g., `deleteMessage`) — without loading page templates, routing, or sessions — use `deploy: "raw"`:

```typescript
const bot = new Gramstax({
  token: process.env.BOT_TOKEN!,
  deploy: "raw",      // bare grammY bot: no pages, no templates, no routing
  log: true
})
// use bot.bot directly:
await bot.bot.api.deleteMessage(chatId, messageId)
```

This is the **official** path:

- No `TemplateManager` is instantiated (no filesystem scanning, no watchers).
- No pages or routing listeners are registered.
- No auto-start — you control the lifecycle (`bot.bot.start()`, etc.).
- `bot.bot` exposes the raw grammY `Bot` with `.api`, `.use`, `.on`, `.command`.
- `_pageLoads()` is skipped entirely — no override needed.

The legacy `templateManager: {} as any` exception was **removed**. Passing a non-`TemplateManager` value in the `templateManager` param for any non-raw deploy mode now throws a clear error directing you to use `deploy: "raw"`.

Do **not** apply this pattern in the main bot instance, which **must** load pages and render templates properly.

## Rule Folder Convention

When a new rule family is added, place it in its own `ctx-*` folder and add it here as a new top-level section.

Recommended structure:

1. `./ctx-<topic>/_INDEX.md` — folder-level index and entrypoint
2. `./ctx-<topic>/*.md` — focused rule modules for that topic

Example future additions:

- `./ctx-api/_INDEX.md`
- `./ctx-cli/_INDEX.md`

## Maintenance Notes

- Keep this file limited to top-level indexing across `ctx-*` folders.
- Keep each `ctx-*/_INDEX.md` responsible for indexing its own local rule pages.
- When adding a new rule page inside an existing folder, update that folder's local `_INDEX.md` first.
