# RULES — Agent Rule Sets for Generated Gramstax Projects

> Scope: `rules/` only. Inherits root `AGENTS.md` (biome, bun, tsup, repo layout). This file documents the meta-structure of `rules/` itself, not the rule content.

## OVERVIEW

- 24 files, all Markdown. Purpose: agent-guidance context loaded by AI agents when scaffolding or editing Gramstax bot projects.
- Four rule sets: `main` (top-level), `ctx-pages/`, `ctx-e2e/`, `ctx-db/`.

## TAXONOMY

| Rule set | Files | Governs |
| --- | --- | --- |
| `main` | `_INDEX.md`, `INIT.md`, `PROJECT_STRUCTURE.md`, `PRODUCTION_QUALITY.md`, `LINTING_RULES.md` (no folder of its own) | Global baseline for any generated project: CLI scaffolding flags, required directory layout/names, production-quality & UX standards, strict lint rules |
| `ctx-pages/` | `_INDEX.md` + `ROUTING_FLOW`, `TEMPLATES_RENDERING`, `KEYBOARDS`, `BASE_BLOCKS`, `PAGE_STRUCTURE`, `FILE_NAMING`, `VARIABLE_NAMING`, `EXAMPLES` (9 files) | Files under `<PROJECT>/src/pages`: page class composition, `g-base` id conventions, keyboard reuse, variable naming |
| `ctx-e2e/` | `_INDEX.md` + `E2E_SETUP`, `E2E_TEMPLATES`, `E2E_VALIDATION`, `E2E_CHECKLIST` (5 files) | `<PROJECT>/e2e`: setup.ts template, test templates, 13 validation rule groups, project checklist |
| `ctx-db/` | `_INDEX.md` + `DB_ARCHITECTURE`, `REPOSITORY_PATTERNS`, `PERFORMANCE`, `MIGRATION_GUIDE` (5 files) | `src/db` via `@gramstax/lmdb`: `LmdbEnv` subclassing, transactions, performance, raw-`lmdb` migration |

## FILE FORMAT & INDEX CONVENTION

- Every rule family (root + each `ctx-*` folder) is fronted by a `_INDEX.md`.
- Root `_INDEX.md` is the master index: lists all families and the `ctx-*` folder convention.
- Rule pages are focused `*.md` files, one topic each.

## SCHEMA OF A ctx-* _INDEX.md

Each `ctx-*` `_INDEX.md` declares:

1. Rule set name.
2. Intended source folder (e.g. `<PROJECT>/src/pages`).
3. Usage rule: "apply when editing files in this folder".
4. A quick-reference snippet.

## CONSUMPTION

- Primary consumer: AI agents via `prompts/PROMPT.md` and `prompts/PROMPT_WITH_VALUE.md` at repo root. Both contain the line `index = ./rules/_INDEX.md`; agents load the index to find the right rule set.
- `create-gramstax` does NOT copy `rules/` into generated projects (templates contain no rules reference).
- Example projects re-embed the rules inline in their own `PROMPT.md` files rather than importing `rules/`.
- This file is referenced from root `AGENTS.md` "AGENTS.md Hierarchy" section.

## MAINTENANCE (extension protocol)

From root `_INDEX.md`:

- To add a new rule family: create `./ctx-<topic>/_INDEX.md` + focused `*.md` pages, then add a top-level section to the root `_INDEX.md`.
- Expected future families per the index: `ctx-api/`, `ctx-cli/`.

## GOTCHAS

- Root `_INDEX.md` has an inline `ctx-core/` section documenting the `deploy: "raw"` pattern, but there is NO `ctx-core/` folder; the section is inline only.
- Rule set `main` has no folder of its own; its files live at `rules/` top level.
- Filename casing is mixed: `_INDEX.md`/`INIT.md` (TitleCase) vs `E2E_SETUP.md`/`FILE_NAMING.md` (UPPER_SNAKE) inside folders.

## CROSS-REFERENCES

- `ctx-e2e/E2E_SETUP.md` cites example projects (7-crud, 8-newsletter, 9-substore-bot, 10-http-request, 6-bank-system) and the gramstax API (`BotCore`, `TemplateManager`, `CacheExternal`).
- `ctx-e2e/E2E_VALIDATION.md` references `scripts/check-e2e-mirror.ts` + `scripts/generate-e2e-structure.ts` (also shipped inside create-gramstax templates).
- `ctx-pages/EXAMPLES.md` cites page classes from `~/base/page`.