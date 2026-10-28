# Plan Template For Gramstax Apps

Copy this into `plans/NNN-feature-slug/plan.md`. Replace every `<...>` placeholder. Remove sections that do not apply; do not leave empty headings.

> **Plan status:** `Draft` · `In Review` · `Approved` · `In Progress` · `Complete` · `Blocked` · `Superseded`
>
> **Phase status:** `⬜` · `🔄` · `✅` · `⏸️` · `🔵` · `⏭️`
>
> **Estimates:** Fibonacci only: `1, 2, 3, 5, 8, 13, 21`. A `21` must be split before execution.

---

````markdown
# <Feature Name> Implementation Plan

> **For the executing agent:** Use `superbuild` when available; otherwise follow the phase DoD manually.
> Each phase must pass its gate before the next phase starts.

> Generated: YYYY-MM-DD
> Status: Draft
> Author: <agent/human>
> Last Updated: YYYY-MM-DD

**Context:** Greenfield bootstrap / existing app adopting Gramstax / generated Gramstax app / standalone app / ecosystem integration
**Framework:** `gramstax <version>`; optional `@gramstax/lmdb <version>`, `@gramstax/worker-thread <version>`
**Package manager:** Bun
**Deploy mode:** `polling` / `webhook` / `serverless` / `raw` / `test`

**Goal:** <one sentence describing the app outcome>

**Architecture:** <2–4 sentences describing the app-level approach and why it fits the existing pages/config/data/worker structure>

**Tech Stack:** Bun, TypeScript, `bun:test`, Biome; add only the packages actually used by the app.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Requirements](#requirements)
3. [App Findings](#app-findings)
4. [Architecture](#architecture)
5. [Implementation Phases](#implementation-phases)
6. [Testing and Verification](#testing-and-verification)
7. [Risks and Assumptions](#risks-and-assumptions)
8. [Change Log](#change-log)
9. [Execution Handoff](#execution-handoff)

---

## Executive Summary

### One-Line Summary

<what changes for the bot's users or the app's developers>

### Goals

- [ ] **Primary:** <the outcome that must be true>
- [ ] **Secondary:** <supporting outcome>
- [ ] **Success metric:** <observable evidence>

### Non-Goals

- ❌ <explicitly not doing>
- ❌ <explicitly not doing>

### Key Decisions

| Decision | Rationale | Alternatives Considered |
| --- | --- | --- |
| <decision> | <why> | <other options> |

### Phase Overview

| Phase | Name | Depends On | Parallel With | Estimate | Status |
| --- | --- | --- | --- | ---: | --- |
| 1 | <name> | — | <phase or —> | 3 | ⬜ |
| 2 | <name> | 1 | — | 5 | ⬜ |
| 3 | <name> | 2 | — | 3 | ⬜ |

**Total estimate:** <sum> points

**Parallel execution:** <which phases may run concurrently, their disjoint app write scopes, and which lane validates each>

---

## Requirements

### Original Request

```text
<verbatim request, issue text, or conversation excerpt>
```

**Source:** <verbal | issue # | app plan | docs>

### Clarifications from Grilling

| Question | Answer | Plan implication |
| --- | --- | --- |
| <question> | <answer> | <what changes> |

### Acceptance Criteria

- [ ] **AC-1:** <observable behavior>
- [ ] **AC-2:** <observable behavior>
- [ ] **AC-3:** <compatibility or error behavior>

### Constraints

- **App context:** greenfield / existing app adopting Gramstax / generated / standalone / ecosystem integration
- **Framework version:** <pinned version and compatibility note, or `create-gramstax` target>
- **Runtime:** <Bun and deploy mode>
- **Files that must not change:** <node_modules, .gramstax, data, vendored files>
- **Compatibility:** <existing users, config, data, deploy target>
- **Security:** <secrets, token handling, webhook exposure, untrusted input>
- **Git:** <commit requested? release requested? plans/ tracked?>

---

## App Findings

### Existing Patterns

| Area | File / Symbol | Pattern to follow |
| --- | --- | --- |
| <pages/base/guards/blocks/db/workers> | `<path>:<lines>` | <pattern> |
| <test/e2e> | `<path>` | <fixture or flow pattern> |

### Integration Points

| File | Change needed | Write scope |
| --- | --- | --- |
| `<path>` | <change> | <lane> |

### Version and Dependency Findings

| Fact | Evidence |
| --- | --- |
| `gramstax` version | `package.json`, or the `create-gramstax` output for greenfield |
| `@gramstax/lmdb` version | `package.json`, or the `create-gramstax` output for greenfield |
| `@gramstax/worker-thread` version | `package.json`, or the `create-gramstax` output for greenfield |
| Relevant API/docs read | `<installed README / docs URL / file>` |

### Best-Practice Sources

| Skill | Loaded? | Relevant section | Why it applies |
| --- | --- | --- | --- |
| `gramstax-best-practices` | yes | `<reference file>` | <pages/templates/config/e2e/deploy> |
| `lmdb-best-practices` | yes/no | `<reference file>` | <data surface> |
| `worker-thread-best-practices` | yes/no | `<reference file>` | <worker surface> |

Record the skill and the section actually used. Do not paste whole rule files into the plan. If a skill is unavailable, record the installed package README or docs URL used instead.

### Technical Debt / Constraints Found

| Finding | Severity | Handling |
| --- | --- | --- |
| <finding> | <low/medium/high> | <fix now / note / separate plan> |

---

## Architecture

### App Flow

<short diagram or prose showing route → page → template/keyboard → data/worker → response>

### Changed Components

| Component | File(s) | Responsibility |
| --- | --- | --- |
| <page/base/guard/keyboard> | `<path>` | <responsibility> |
| <config/env> | `<path>` | <responsibility> |
| <db/worker> | `<path>` | <responsibility> |

### Data / Control Flow

1. <entry update or command>
2. <page/guard/session step>
3. <template/keyboard response>
4. <data or worker side effect>
5. <error / fallback path>

### Public Surface

| Surface | Change | Compatibility |
| --- | --- | --- |
| <page route/callback/session> | <add/change/remove> | <breaking/non-breaking> |
| <config/env/deploy> | <add/change/remove> | <breaking/non-breaking> |

---

## Implementation Phases

> Every phase must be independently testable, have a disjoint write scope, and end with a CHECKPOINT.
> Code tasks use TDD. Docs/config-only tasks use a verifier command; they do not need a fake unit test.
> For a greenfield plan, Phase 1 is the `create-gramstax` bootstrap and Phase 2 is the generated baseline gate. Do not customize pages until the baseline passes.

### Phase 1: <Name>

**Estimate:** <1/2/3/5/8/13>
**Depends on:** <phase or —>
**Parallel with:** <phase(s) or —>
**Write scope:** `<app paths>`
**Validation owner:** `<agent/lane>`

#### Tasks

- [ ] **Task 1.1: <name>**

  **Files:**
  - Create: `<exact/app/path>`
  - Modify: `<exact/app/path>:<lines>`
  - Test: `<exact/test/path>`

  **Step 1 — Write the failing test**
  ```ts
  <full test code, not pseudocode>
  ```

  **Step 2 — Verify RED**
  - Command: `<exact app command>`
  - Expected: FAIL — `<expected failure>`

  **Step 3 — Write minimal implementation**
  ```ts
  <full implementation or a precise diff>
  ```

  **Step 4 — Verify GREEN**
  - Command: `<exact app command>`
  - Expected: PASS — `<expected output>`

  **Step 5 — Verify no regression**
  - Command: `<narrow app suite>`
  - Expected: `<pass count / no new warnings>`

- [ ] **Task 1.2: <name>**
  - <same five-step structure>

#### Definition of Done

- [ ] Tests exist for every new code path
- [ ] New tests pass
- [ ] Existing app tests pass
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Build passes when the app emits artifacts
- [ ] README or `.env.example` (when the app keeps one) updated for behavior or config changes
- [ ] Plan checkboxes and status are updated

- [ ] **CHECKPOINT: Run `/compact focus on: Phase 1 complete, <artifacts>, Phase 2 needs <context>`**

### Phase 2: <Name>

<repeat the phase structure>

### Phase 3: <Name>

<repeat the phase structure>

---

## Testing and Verification

### Test Matrix

| Behavior | Test level | File | Command |
| --- | --- | --- | --- |
| <behavior> | unit/e2e/smoke | `<path>` | `<app script>` |

### Fresh-Evidence Gate

| Claim | Command | Required evidence |
| --- | --- | --- |
| Typecheck | `bun run typecheck` | exit 0 |
| Lint | `bun run lint` | exit 0, no new warnings |
| Unit tests | `bun run test` | 0 fail |
| E2E tests | `bun run test:e2e` | 0 fail |
| All tests | `bun run test:all` | 0 fail |
| Build | `bun run build:gramstax` or project build script | exit 0 |
| CLI smoke | `bun run start -- --help` or `bunx gramstax start --help` | usage prints, no boot/config error |
| Greenfield baseline (if applicable) | `bun run test:all && bun run typecheck && bun run lint` | 0 fail, exit 0 before app customization |
| Whitespace/conflicts | `git diff --check` | no output |

> Read `package.json` first. Use the app's real script names; do not paste monorepo commands into an app plan.

### Manual / Functional Checks

1. <command or user flow>
2. <expected Telegram/bot behavior>
3. <error or restart check>

---

## Risks and Assumptions

### Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| <risk> | <low/med/high> | <low/med/high> | <mitigation> |

### Assumptions

- <assumption and how it will be verified>

### Known Unknowns

| Unknown | Owner | Resolution point |
| --- | --- | --- |
| <unknown> | <user/agent> | <before phase N> |

---

## Change Log

| Date | Mode | Change | Affected phases | Reason |
| --- | --- | --- | --- | --- |
| YYYY-MM-DD | CREATE | Initial plan | all | <request> |

---

## Execution Handoff

- **Plan path:** `plans/NNN-feature-slug/plan.md`
- **Execution mode:** phase-by-phase / `--build-all` / manual
- **First phase:** <phase>
- **Parallel lanes:** <lanes and write scopes>
- **Final gate:** `bun run test:all && bun run typecheck && bun run lint` plus build when applicable
- **Stop condition:** <stop after phase / complete all / pause on failure>
- **Commit policy:** <do not commit / conventional message only / user requested commit>
````

## Task Quality Bar

A task is ready only when:

- The app paths are exact.
- The app test command is exact.
- The expected RED failure is named.
- The expected GREEN evidence is named.
- The write scope is disjoint from every concurrent task.
- The task does not edit `node_modules`, `.gramstax`, or runtime data.
- The task states whether it changes a page route, callback, session, config, or public app behavior.
- The task has a rollback or compatibility note when it is risky.

## Phase Quality Bar

- Estimate is 3–8 points; split anything larger.
- Dependencies are explicit.
- Parallel phases have disjoint write scopes.
- Definition of Done is copied and adapted, not omitted.
- CHECKPOINT names the artifacts and next phase context.
- No phase depends on an unstated decision or an unverified dependency version.
