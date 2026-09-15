---
name: gramstax-best-practices
description: Best practices for gramstax (declarative Telegram bot framework): page routing with renderAuto and sessions, template authoring (g-* blocks, scopes, filters), keyboard reuse, page structure and naming, E2E testing with E2eHelper, deploy modes (polling/webhook/serverless/raw/test), and the template trust boundary. Use when writing, reviewing, auditing, or debugging gramstax pages, templates, keyboards, sessions, e2e tests, or bot startup, or when renders duplicate messages, sessions leak, or templates misbehave.
compatibility: Bun + TypeScript + Nx monorepo; gramstax workspace (packages/gramstax)
metadata:
  author: gramstax
  organization: gramstax
  scope: packages/gramstax
---

# Gramstax Best Practices

Router for the `references/` rule files. Read `AGENTS.md` in `packages/gramstax` for API truth; this skill adds the judgment layer distilled from `DEPRECATED-rules/` and the `example/` projects (1-complex through 10-http-request).

## When to Apply

- New page, template, keyboard, or e2e test file
- Debugging: duplicate/orphaned messages, session leaks, wrong render (send vs edit), keyboard drift, flaky e2e
- Choosing a deploy mode, wiring rate limits, or reviewing bot startup
- Reviewing template code or touching `packages/gramstax/src/template/`

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Routing & rendering decisions | CRITICAL | `route-` |
| 2 | Template trust boundary | CRITICAL | `security-` |
| 3 | Template authoring | HIGH | `template-` |
| 4 | Keyboards | HIGH | `keyboard-` |
| 5 | Pages & structure | HIGH | `pages-` |
| 6 | E2E testing | MEDIUM-HIGH | `e2e-` |
| 7 | Deploy & runtime | MEDIUM | `deploy-` |
| 8 | Guards | MEDIUM | `guard-` |
| 9 | Session cache store | MEDIUM | `cache-` |

## How to Use

Read individual rule files for explanations with incorrect vs correct examples:

```
references/route-render-auto.md
references/security-trust-boundary.md
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
- `example/1-complex` — kitchen-sink reference (pages, guards, i18n, media, worker job)
- `DEPRECATED-rules/` — superseded rule texts this skill distills (do not follow directly)
