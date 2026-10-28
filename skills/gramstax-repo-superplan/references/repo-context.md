# Gramstax Repo Context For Planning

Read root `AGENTS.md` for repo-wide rules and the matching package `AGENTS.md` for API truth. This reference is the planning map for the framework monorepo: what exists, what can be touched, and which commands prove a plan is done.

**Scope:** framework repository only. For a downstream app that consumes Gramstax, use `gramstax-superplan` and its app-context reference instead.

## Workspace Map

| Path | Role | Planning notes |
| --- | --- | --- |
| `packages/gramstax` | Core library + published CLI | Pages, routing, templates, cache, e2e harness, `gramstax start/build` |
| `packages/create-gramstax` | Scaffolding CLI + templates | Generated projects are Bun-only; no runtime selector |
| `packages/lmdb` | `@gramstax/lmdb` | Standalone storage package with its own runtime support and test suite |
| `packages/worker-thread` | `@gramstax/worker-thread` | Standalone worker/RPC package; separate lifecycle |
| `example/1-complex` … `example/11-cloudflare-worker` | Teaching projects | Build before running; e2e mirrors page trees |
| `real-projects/production-vip-content-bot` | Standalone app | Not a workspace member; use `gramstax-superplan`, not this skill |
| `docs-site` | Authored guides + generated reference | Never hand-edit `docs-site/reference/**` |
| `skills` | Agent skills | Rule routers plus app and repo superplan skills |
| `plans` | Numbered implementation plans | Gitignored; `NNN-slug/plan.md` |
| `scripts` | Root e2e/docs tooling | `build:docs`, e2e mirror checks |

## Non-Negotiable Invariants

- **Bun is required** for the `gramstax` app runtime, CLI, project boot, webhook/status server, and `--bundle`.
- **Generated projects are Bun-only.** There is no alternate app runtime selector and no Node app fallback.
- **`@gramstax/lmdb` and `@gramstax/worker-thread` are separate packages.** Do not apply Gramstax app runtime claims to their own multi-runtime support without checking their docs.
- **Do not hand-edit generated output.** `docs-site/reference/**` and `packages/*/docs/{markdown,yaml}` come from `bun run build:docs`.
- **No `@ts-ignore` / `@ts-expect-error` in source.** Suppression in tests is tolerated only as an existing test convention.
- **No Jest or Vitest.** Use `bun:test`.
- **Formatting:** Biome, 2 spaces, no semicolons, `bracketSpacing: false`, line width 300 for TS/JS.
- **Imports:** ESM; `node:` prefixes for built-ins; `import type` for types; `~/*` alias inside packages.
- **No commit, stage, push, version, tag, or publish** unless the user explicitly asks.
- **No alternate app runtime planning.** The CLI and generated app are Bun-only.

## Plan File Convention

```
plans/
  046-bun-only-runtime/
    plan.md
    plan-2.md              # optional split for a very large plan
    execution-report.md    # superbuild/resume evidence
```

- Number: highest existing number + 1, zero-padded to three digits.
- Slug: lowercase, hyphenated, specific.
- `plans/` is ignored by git; the file is the durable record.
- Existing plans are historical. Do not renumber or rewrite completed work; add a new plan or a marked superseding section.
- The plan content remains compatible with `superbuild`: phase table, estimates, `- [ ]` tasks, DoD, and CHECKPOINTs.

## Package-Specific Read-This-First

| If the plan touches… | Read |
| --- | --- |
| Core bot, config, pages, templates, e2e | `packages/gramstax/AGENTS.md`; `skills/gramstax-best-practices/SKILL.md` |
| CLI, env loading, build, deploy targets | `packages/gramstax/AGENTS.md`; `docs-site/guides/gramstax-start.md`, `gramstax-build.md`, `serverless-deploy.md` |
| Scaffolding or generated templates | `packages/create-gramstax/AGENTS.md`; `packages/create-gramstax/README.md` |
| LMDB schema, indexes, migration, backup | `packages/lmdb/AGENTS.md`; `skills/lmdb-best-practices/SKILL.md` |
| Workers, RPC, gateway, pool | `packages/worker-thread/AGENTS.md`; `skills/worker-thread-best-practices/SKILL.md` |
| Examples or generated e2e | `example/AGENTS.md`; `docs-site/guides/e2e-testing.md` |
| Docs, skills, agent guidance | Root `AGENTS.md`; `docs-site/guides/packages.md` |

## Quality Commands

Use the narrowest command that proves the claim, then the full gate when the change crosses packages.

| Surface | Command |
| --- | --- |
| Typecheck + lint (full repo) | `bun run ci:check` |
| Typecheck + lint (packages only) | `bun run ci:check:packages` |
| All package tests | `bun run test:packages` |
| Core library tests | `bun test packages/gramstax/test` |
| Scaffold tests | `bun test packages/create-gramstax/test` |
| LMDB tests | `bun test packages/lmdb/test` |
| Worker-thread tests | `bun test packages/worker-thread/test` |
| Example suites | `bun run test:example` |
| Full test gate | `bun run ci:test` |
| Build every package | `bun run build` |
| Docs reference generation | `bun run build:docs` |
| Whitespace/conflict check | `git diff --check` |
| CLI smoke | `bun run --cwd example/1-complex start --help` |

## Runtime and Deployment Notes

- `deploy: "polling"` is the normal local loop; `gramstax start --watch` is the dev loop.
- `deploy: "webhook"` uses `Bun.serve`; `deploy: "serverless"` emits a target-specific server entry.
- `deploy: "raw"` is a bare grammY bot: no pages, templates, or Gramstax routing.
- `deploy: "test"` is the in-process e2e harness; it constructs `BotCore` directly.
- `gramstax build` freezes pages into `.gramstax/`; only serverless auto-loads it.
- Cloudflare Workers uses `compatibilityFlags: ["nodejs_compat"]`; Lambda has its own deployment runtime. Do not confuse those with local app runtime support.

## Planning Checklist

- Which package owns the behavior?
- Which file paths are exact, not approximate?
- Which test is red first?
- Which existing suites must stay green?
- Which docs are authored and which are generated?
- Which phases can run in parallel with disjoint writes?
- What is the final fresh-evidence command?
