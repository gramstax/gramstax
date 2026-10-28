# Gramstax Repo Superplan

Plan lifecycle for the Gramstax framework monorepo.

Use this skill when the workspace contains the framework packages:

- `packages/gramstax`
- `packages/create-gramstax`
- `packages/lmdb`
- `packages/worker-thread`
- `example/`, `docs-site/`, and repository-level `skills/`

It knows the package boundaries, Bun-only app runtime rules, generated documentation rules, framework test/build commands, and parallel package lanes.

## Not For Apps

If you are working in an app that **depends on** Gramstax, such as a `create-gramstax` project or a standalone app under `real-projects`, use `gramstax-superplan` instead.

## Contents

- `SKILL.md` — repo modes, workflow, hard rules.
- `references/grilling.md` — maintainer decision branches.
- `references/repo-context.md` — workspace map, invariants, package commands.
- `references/plan-template.md` — repo plan skeleton.
- `references/plan-lifecycle.md` — create/refine/review/resume/reconcile/handoff.
- `references/plan-review.md` — repo review checklist and traps.
- `references/execution-lanes.md` — package write scopes and parallel safety.
- `references/verification.md` — repo command matrix and fresh-evidence rules.

Licensed under MIT.
