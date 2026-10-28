# Plan Template

Copy this into `plans/NNN-feature-slug/plan.md`. Replace every `<...>` placeholder. Remove sections that do not apply; do not leave empty headings.

> **Plan status:** `Draft` · `In Review` · `Approved` · `In Progress` · `Complete` · `Blocked` · `Superseded`
>
> **Phase status:** `⬜` · `🔄` · `✅` · `⏸️` · `🔵` · `⏭️`
>
> **Estimates:** Fibonacci only: `1, 2, 3, 5, 8, 13, 21`. A `21` must be split before execution.

---

````markdown
# <Feature Name> Implementation Plan

> **For the executing agent:** Use `superbuild` with this plan.
> Each phase has a Definition of Done gate; do not skip it.

> Generated: YYYY-MM-DD
> Status: Draft
> Author: <agent/human>
> Last Updated: YYYY-MM-DD

**Goal:** <one sentence describing the outcome>

**Architecture:** <2–4 sentences describing the approach and why it fits Gramstax>

**Tech Stack:** Bun, TypeScript, Nx, tsup, `bun:test`, Biome; add only the packages actually involved.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Requirements](#requirements)
3. [Repo Findings](#repo-findings)
4. [Architecture](#architecture)
5. [Implementation Phases](#implementation-phases)
6. [Testing and Verification](#testing-and-verification)
7. [Risks and Assumptions](#risks-and-assumptions)
8. [Change Log](#change-log)
9. [Execution Handoff](#execution-handoff)

---

## Executive Summary

### One-Line Summary

<what changes for the user or developer>

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

**Parallel execution:** <which phases may run concurrently, their disjoint write scopes, and which lane validates each>

---

## Requirements

### Original Request

```text
<verbatim request, ticket text, or issue link>
```

**Source:** <verbal | issue # | plan | docs>

### Clarifications from Grilling

| Question | Answer | Plan implication |
| --- | --- | --- |
| <question> | <answer> | <what changes> |

### Acceptance Criteria

- [ ] **AC-1:** <observable behavior>
- [ ] **AC-2:** <observable behavior>
- [ ] **AC-3:** <compatibility or error behavior>

### Constraints

- **Runtime:** <Bun, deploy mode, serverless target>
- **Packages:** <which packages may change; which are untouched>
- **Compatibility:** <public API, config, generated project, version>
- **Security:** <trust boundary, secrets, input validation>
- **Documentation:** <authored vs generated>
- **Git:** <commit requested? release requested?>

---

## Repo Findings

### Existing Patterns

| Area | File / Symbol | Pattern to follow |
| --- | --- | --- |
| <pages/config/templates/storage/workers> | `<path>:<lines>` | <pattern> |

### Integration Points

| File | Change needed | Write scope |
| --- | --- | --- |
| `<path>` | <change> | <lane> |

### Technical Debt / Constraints Found

| Finding | Severity | Handling |
| --- | --- | --- |
| <finding> | <low/medium/high> | <fix now / note / separate plan> |

### Facts Verified

| Fact | Evidence |
| --- | --- |
| <runtime/API/command behavior> | `<command or file:line>` |

---

## Architecture

### System Context

<short diagram or prose showing the changed flow>

### Changed Components

| Component | File(s) | Responsibility |
| --- | --- | --- |
| <component> | `<path>` | <responsibility> |

### Data / Control Flow

1. <step>
2. <step>
3. <error / fallback path>

### Public Surface

| Surface | Change | Compatibility |
| --- | --- | --- |
| <export/type/CLI/config/template> | <add/change/remove> | <breaking/non-breaking> |

---

## Implementation Phases

> Every phase must be independently testable, have a disjoint write scope, and end with a CHECKPOINT.
> Code tasks use TDD. Docs-only tasks use a verifier command or scanner; they do not need a fake unit test.

### Phase 1: <Name>

**Estimate:** <1/2/3/5/8/13>
**Depends on:** <phase or —>
**Parallel with:** <phase(s) or —>
**Write scope:** `<paths>`
**Validation owner:** `<agent/lane>`

#### Tasks

- [ ] **Task 1.1: <name>**

  **Files:**
  - Create: `<exact/path>`
  - Modify: `<exact/path>:<lines>`
  - Test: `<exact/test/path>`

  **Step 1 — Write the failing test**
  ```ts
  <full test code, not pseudocode>
  ```

  **Step 2 — Verify RED**
  - Command: `<exact command>`
  - Expected: FAIL — `<expected failure>`

  **Step 3 — Write minimal implementation**
  ```ts
  <full implementation or a precise diff>
  ```

  **Step 4 — Verify GREEN**
  - Command: `<exact command>`
  - Expected: PASS — `<expected output>`

  **Step 5 — Verify no regression**
  - Command: `<narrow suite>`
  - Expected: `<pass count / no new warnings>`

- [ ] **Task 1.2: <name>**
  - <same five-step structure>

#### Definition of Done

- [ ] Tests exist for every new code path
- [ ] New tests pass
- [ ] Existing suites pass
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Build passes when the package emits artifacts
- [ ] Documentation/skill references are updated
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
| <behavior> | unit/integration/e2e/smoke | `<path>` | `<command>` |

### Fresh-Evidence Gate

| Claim | Command | Required evidence |
| --- | --- | --- |
| Typecheck | `bun run ci:check` or package tsc | exit 0 |
| Lint | `bun run lint` | exit 0, no new warnings |
| Package tests | `bun test packages/<pkg>/test` | 0 fail |
| Example tests | `bun run test:example` | 0 fail |
| Build | `bun run build` | exit 0 |
| Docs scanner | `bun test packages/gramstax/test/cli.docs.test.ts` | 0 fail |

### Manual / Functional Checks

1. <command or UI flow>
2. <expected result>

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
- **Execution mode:** phase-by-phase / `--build-all`
- **First phase:** <phase>
- **Parallel lanes:** <lanes and write scopes>
- **Final gate:** `bun run ci:test && bun run build`
- **Stop condition:** <stop after phase / complete all / pause on failure>
- **Commit policy:** <do not commit / conventional message only / user requested commit>
````

## Task Quality Bar

A task is ready only when:

- The file paths are exact.
- The test command is exact.
- The expected RED failure is named.
- The expected GREEN evidence is named.
- The write scope is disjoint from every concurrent task.
- The task does not edit generated docs.
- The task states whether it changes a public surface.
- The task has a rollback or compatibility note when it is risky.

## Phase Quality Bar

- Estimate is 3–8 points; split anything larger.
- Dependencies are explicit.
- Parallel phases have disjoint write scopes.
- Definition of Done is copied and adapted, not omitted.
- CHECKPOINT names the artifacts and next phase context.
- No phase depends on an unstated decision.
