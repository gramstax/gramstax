# Gramstax Superplan

Portable plan lifecycle for apps built on the Gramstax ecosystem: greenfield scaffolds, generated projects, existing Bun apps adopting Gramstax, standalone apps, and `real-projects/*`.

## Use It In Your App

Copy this directory into your app's `skills/` directory (or the skill directory your agent uses), keeping `references/`, `CHANGELOG.md`, and `LICENSE`.

For full coverage, also copy the three best-practice skills this planner routes to:

- `gramstax-best-practices`
- `lmdb-best-practices`
- `worker-thread-best-practices`

Then ask your agent to use `gramstax-superplan` when planning app work. It will:

- detect whether the project is greenfield, an existing app adopting Gramstax, generated, standalone, or an ecosystem integration;
- read `package.json` when present, `gramstax.config.ts`, `README.md`, and the app source;
- plan a `create-gramstax` bootstrap when the project is empty;
- load the relevant best-practice skill before designing pages, config, data, or workers;
- grill the open decisions with `grill-me`-style design-tree rounds;
- write a plan to `plans/NNN-feature-slug/plan.md`;
- use the app's own Bun scripts for verification;
- hand the plan to `superbuild` or a manual phase-by-phase loop.

## Greenfield

Yes — it supports an empty/near-empty project. Read `references/greenfield.md`. The skill plans the scaffold as Phase 1:

```bash
bunx create-gramstax@latest my-bot --pm bun --lmdb --worker-thread --biome
```

It then requires the generated baseline (`bun run test:all`, `bun run typecheck`, `bun run lint`) to pass before app customization. Do not pass `.` as the project name; use a subdirectory, or run interactively and submit an empty name in an effectively empty directory. Keep the approved plan in the parent, scaffold the app directory, then move the plan under the app's `plans/`. If scaffolding into the current empty directory, finish the grill/design first and write the plan inside the new app.

## Best-Practice Skills

`gramstax-superplan` routes rather than duplicates:

| Work surface | Skill |
| --- | --- |
| Pages, templates, keyboards, config, e2e, deploy | `gramstax-best-practices` |
| LMDB schemas, indexes, migrations, backups | `lmdb-best-practices` |
| Workers, RPC, gateway, pool, jobs | `worker-thread-best-practices` |

If the app does not have those skills, read their `SKILL.md` from the Gramstax repository or use the installed package README. Record the sections consulted in the plan. See `references/best-practices.md`.

## Scope

This skill is for app-owned files:

- greenfield bootstrap through `create-gramstax`
- `src/pages`, `src/base`, `src/guards`, `src/blocks`, `src/core`
- `src/db` and `@gramstax/lmdb` usage
- `src/workers` / `src/jobs` and `@gramstax/worker-thread` usage
- `e2e`, `test`, `gramstax.config.ts`, `.env`/env documentation, `README.md`
- `plans/`

It does **not** plan edits to installed `node_modules`, the Gramstax framework source, or generated `.gramstax/**` output.

## Framework Repository

If you are working on the Gramstax monorepo itself (`packages/gramstax`, `packages/create-gramstax`, `packages/lmdb`, `packages/worker-thread`), use `gramstax-repo-superplan` instead. It knows the workspace package boundaries and monorepo commands.

## Contents

- `SKILL.md` — modes, context detection, workflow, hard rules.
- `references/grilling.md` — design tree, frontier, rounds, app decision branches.
- `references/greenfield.md` — `create-gramstax` bootstrap, flags, plan placement, baseline gates.
- `references/best-practices.md` — routing to the three best-practice skills.
- `references/app-context.md` — app layout, versions, scripts, deploy/data/worker notes.
- `references/plan-template.md` — app plan skeleton.
- `references/plan-lifecycle.md` — create/refine/review/resume/reconcile/handoff.
- `references/plan-review.md` — app review checklist and traps.
- `references/execution-lanes.md` — app write scopes and parallel safety.
- `references/verification.md` — app command matrix and fresh-evidence rules.

Licensed under MIT.
