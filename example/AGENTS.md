# Gramstax Agent Rules Index

> Scope: `./example/*`

This file is the entrypoint for agent-facing rules in this directory.

## Active Rule Sets

### `.rules-pages/`

Use `./.rules-pages/AGENTS.md` as the module index for page-related rules. It currently covers:

- [`PROJECT_STRUCTURE.md`](./.rules-pages/PROJECT_STRUCTURE.md) — initialization and directory layout
- [`ROUTING_FLOW.md`](./.rules-pages/ROUTING_FLOW.md) — routing logic, flow, and session handling
- [`TEMPLATES_RENDERING.md`](./.rules-pages/TEMPLATES_RENDERING.md) — template syntax, rendering, and conditional logic
- [`KEYBOARDS.md`](./.rules-pages/KEYBOARDS.md) — keyboard blocks, labels, and reuse patterns
- [`BASE_BLOCKS.md`](./.rules-pages/BASE_BLOCKS.md) — base block usage and ID naming
- [`PAGE_STRUCTURE.md`](./.rules-pages/PAGE_STRUCTURE.md) — internal class composition, suffixes, and ordering
- [`VARIABLE_NAMING.md`](./.rules-pages/VARIABLE_NAMING.md) — standardized shorthands and naming rules
- [`LINTING_RULES.md`](./.rules-pages/LINTING_RULES.md) — formatting and code style enforcement
- [`PRODUCTION_QUALITY.md`](./.rules-pages/PRODUCTION_QUALITY.md) — production standards and UX guidance
- [`EXAMPLES.md`](./.rules-pages/EXAMPLES.md) — reference implementations and code snippets

### `rules-helpers/`

Use `./rules-helpers/AGENTS.md` as the module index for helper-related rules. This rule set is currently a stub and should be expanded as helper conventions are documented.

## Rule Folder Convention

When a new rule family is added, place it in its own `rules-*` folder and add it here as a new top-level section.

Recommended structure:

1. `./rules-<topic>/AGENTS.md` — folder-level index and entrypoint
2. `./rules-<topic>/*.md` — focused rule modules for that topic

Example future additions:

- `./rules-api/AGENTS.md`
- `./rules-cli/AGENTS.md`

## Maintenance Notes

- Keep this file limited to top-level indexing across `rules-*` folders.
- Keep each `rules-*/AGENTS.md` responsible for indexing its own local rule pages.
- When adding a new rule page inside an existing folder, update that folder's local `AGENTS.md` first.
