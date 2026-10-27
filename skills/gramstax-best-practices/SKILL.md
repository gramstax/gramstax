---
name: gramstax-best-practices
description: Best practices for gramstax (declarative Telegram bot framework): config-driven boot from gramstax.config.ts, page base classes with hookBeforeRoute gates, page routing with mode-aware rendering and sessions, template authoring (g-* blocks, scopes, filters, AOT), keyboard reuse, E2E testing with E2eHelper, and deploy modes (polling/webhook/serverless/raw/test) with gramstax build. Use when writing, reviewing, auditing, or debugging gramstax config, pages, base classes, templates, keyboards, sessions, e2e tests, deploys, or bot startup — including when a boot fails, a render duplicates messages, a gate silently drops updates, sessions leak, or templates misbehave.
compatibility: Bun + TypeScript + Nx monorepo; gramstax workspace (packages/gramstax)
metadata:
  version: 6.0.4
  author: gramstax
  organization: gramstax
  scope: packages/gramstax
---

# Gramstax Best Practices

Router for the `references/` rule files. Read `AGENTS.md` in `packages/gramstax` for API truth; this skill adds the judgment layer distilled from prior rule sets, the `create-gramstax` templates, and the `example/` projects.

**Current behavior.** The config file is the default composition point and pages are gated by base classes. A project with no `gramstax.config.ts` may still be valid if it constructs `BotCore` directly (cluster, multi-bot, custom lifecycle) — see `references/config-programmatic.md`.

## When to Apply

- Boot, deploy, or config work: `gramstax.config.ts`, `gramstax start`, `gramstax build`, deploy modes, secrets
- New page, template, keyboard, or e2e test file
- Access control: gating a page family, choosing between a base class, a `GuardBase`, and a bot-level hook
- Debugging: duplicate/orphaned messages, silent drops, session leaks, wrong render (send vs edit), keyboard drift, flaky e2e
- Reviewing template code or touching `packages/gramstax/src/template/`

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Boot & config | CRITICAL | `config-` |
| 2 | Routing & rendering | CRITICAL | `route-` |
| 3 | Template trust boundary | CRITICAL | `security-` |
| 4 | Template authoring | HIGH | `template-` |
| 5 | Pages, base classes & structure | HIGH | `pages-` |
| 6 | Keyboards | HIGH | `keyboard-` |
| 7 | E2E testing | MEDIUM-HIGH | `e2e-` |
| 8 | Deploy modes, build & runtime | MEDIUM | `deploy-` |
| 9 | Guards | MEDIUM | `guard-` |
| 10 | Session cache store | MEDIUM | `cache-` |

## Start Here

| Task | Read first |
| --- | --- |
| Project will not boot / config error | `references/config-boot.md`, then `references/deploy-modes.md` |
| cluster, multi-bot, custom supervisor, embedding | `references/config-programmatic.md` |
| Gating pages behind admin/role/KYC | `references/pages-base-classes.md`, then `references/route-hooks.md` |
| Deploying to Workers or Lambda | `references/deploy-build.md`, then `references/deploy-modes.md` |
| Writing a new page | `references/pages-structure.md`, `references/pages-base-classes.md` |
| Long text, caption edit, or keyboard-only edit | `references/route-render-api.md` |
| Anything touching untrusted input | `references/security-trust-boundary.md` |

## How to Use

Read individual rule files for explanations with incorrect vs correct examples:

```
references/config-boot.md
references/pages-base-classes.md
references/route-hooks.md
references/_sections.md
```

Each rule file contains:

- One-line verdict first
- Why it matters (cost model or failure mode)
- Incorrect code with explanation
- Correct code with explanation
- Gramstax-specific notes (deviations and exceptions)

## References

- `packages/gramstax/AGENTS.md` — API truth and package conventions
- `example/AGENTS.md` — sample projects and e2e harness conventions
- `docs-site/guides/gramstax-start.md`, `docs-site/guides/gramstax-build.md`, `docs-site/guides/serverless-deploy.md`, `docs-site/guides/aot-contract.md` — CLI and deploy detail