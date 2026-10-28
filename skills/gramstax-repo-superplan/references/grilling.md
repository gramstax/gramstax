# Grilling Protocol

Adapted from mattpocock's `grill-me` skill. The purpose is not to ask more questions for their own sake. It is to make every assumption visible before a plan turns it into code.

## The Design Tree

Model the change as a tree:

- **Root:** shared understanding of the outcome.
- **Branches:** scope, package surface, runtime/deploy, behavior, data/state, documentation, verification, release, and plan mechanics.
- **Leaves:** concrete decisions that can be written into the plan.

Every decision unlocks the decisions below it. Do not ask a child question before its parent is settled.

## The Frontier

The **frontier** is every decision whose prerequisites are already settled — the questions that can be answered now without guessing at answers you have not heard.

Ask the whole frontier in one round. Then wait for the user's answers. Recompute the frontier after every round. A question whose answer depends on another question still open in this round belongs to a later round.

## Round Format

Use this exact shape. Number the questions and give a recommended answer for each one.

```
❓ **Q1** - **<question title>**: <question body, including choices if any>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body>

➡️ <your recommended answer>
```

Word each question so that "yes" accepts the recommendation. Make the recommendation specific enough to become a plan decision.

## Facts vs Decisions

**Facts are your job.** If a frontier question needs a fact from the repository, filesystem, docs, or external API:

- Dispatch `explorer` for codebase facts.
- Dispatch `librarian` for external/version-specific facts.
- Read `AGENTS.md`, package `AGENTS.md`, `CONTEXT-MAP.md`, and the current plan yourself.
- Do not ask the user for a file path, command, package name, or existing behavior you can verify.

A running exploration is an unsettled prerequisite. Ask the rest of the frontier now; put only the downstream questions on hold.

**Decisions are the user's.** Put each real choice to them with a recommendation. Do not silently decide scope, compatibility, release, or risk tolerance.

## Gramstax Decision Branches

Use the branches that apply. Do not ask about LMDB for a template-only change; do not ask about deploy modes for a docs-only change.

### 1. Outcome and Scope

- What is the smallest user-visible or developer-visible outcome?
- What is explicitly out of scope?
- Is this a new capability, a fix, a refactor, a migration, or release work?
- Which existing behavior must not change?
- Is there a hard deadline, release, or compatibility boundary?

### 2. Package Surface

- `packages/gramstax` — core library, CLI, templates engine, pages, e2e.
- `packages/create-gramstax` — scaffolder, templates, generated scripts.
- `packages/lmdb` — storage, schemas, indexes, migrations, backup.
- `packages/worker-thread` — worker lifecycle, RPC, gateway, pool.
- `example/*` — runnable teaching projects.
- `docs-site` / `skills` / `AGENTS.md` — documentation and agent guidance.
- `real-projects/*` — standalone apps; do not assume workspace rules apply.

Ask which packages may change and which must stay untouched.

### 3. Runtime and Deploy

- Does this run under `deploy: "polling"`, `"webhook"`, `"serverless"`, `"raw"`, or `"test"`?
- Does it touch `gramstax start`, `gramstax build`, `Bun.serve`, or `--bundle`?
- Is the target local Bun, Cloudflare Workers, AWS Lambda, or a manifest boot?
- Are secrets, status server, rate limits, throttling, or session locks involved?
- Does the change affect the Bun-only app runtime or a standalone package's runtime support?

### 4. Behavior and API

- What is the user journey or protocol flow?
- What are the success, empty, loading, error, retry, and cancellation paths?
- Is this a public API change? Which exports, types, CLI flags, config fields, or template tags?
- Is backward compatibility required? For how long?
- What should happen on invalid input, missing config, or a failed external call?

### 5. Pages, Routing, and Templates

- Does the change add or modify a page, base class, guard, or route hook?
- Does it change `handle*` naming, session/free-text behavior, or callback routing?
- Does it add a template tag, `g-*` block, filter, scope, or keyboard pattern?
- Must it survive AOT (`gramstax build`), or is it JIT-only?
- Does it touch untrusted input or HTML escaping?

### 6. Data and State

- What is read, created, updated, deleted, or retained?
- Is LMDB involved? Which schema, key, index, TTL, queue, migration, or backup?
- Is there a transaction boundary or a consistency requirement?
- Does the worker thread own the work, or is it main-thread only?
- What happens on restart, duplicate delivery, or partial failure?

### 7. Testing and Evidence

- What test proves the behavior: unit, integration, in-process e2e, example e2e, or built-package smoke?
- What is the red test before implementation?
- Which existing suites must stay green?
- Is a scanner or guard test needed to prevent regression?
- What manual functional check remains after automation?

### 8. Documentation and Skills

- Which README, docs-site page, skill, or AGENTS file describes the behavior?
- Is the doc hand-authored or generated? Never hand-edit generated reference output.
- Does the change invalidate a skill example or a scanner test?
- Does it need a migration note, changelog, or release note?

### 9. Release and Git

- Is a version bump expected? Which package(s) share the fixed release group?
- Is this a breaking change? Does it need a migration guide?
- Does the user want a commit, and with what prefix/scope?
- Is `real-projects/production-vip-content-bot` in scope? It is standalone and may pin an older version.

### 10. Plan Mechanics

- Which plan file is being created or changed?
- Which phases are parallel, and what are their disjoint write scopes?
- Who validates each lane?
- Is the plan expected to run under `superbuild` phase-by-phase, or with `--build-all`?
- What is the stop condition after the current phase?

## Round Templates

### Small Change

Ask 3–5 questions from Outcome, Package Surface, Testing, and Plan Mechanics.

### Medium Feature

Round 1: outcome, scope, package surface, runtime/deploy.

Round 2: behavior/API, data/state, testing, docs.

Round 3: parallel lanes, release, handoff.

### Large / Cross-Package Work

Round 1: outcome, non-goals, package boundaries, compatibility, release.

Round 2: behavior contracts, data/state, deploy/runtime, failure modes.

Round 3: testing strategy, migration, docs, parallel lanes, execution mode.

Do not mechanically use all three rounds if the frontier is already empty. Do not skip a round because the user seems impatient.

## When to Stop Grilling

The frontier is empty when:

- Every branch has a decision or an explicit Known Unknown.
- No open question depends on another open question.
- The user has confirmed the shared understanding.
- The plan can name exact files, tests, commands, and stop conditions.

Do not write the plan, change the plan, or start implementation before that confirmation.

## Anti-Patterns

- Asking the user for facts you can read from the repo.
- Asking 20 questions in one paragraph with no recommendations.
- Asking child questions before the parent decision.
- Treating "yes" as agreement to an unstated design.
- Writing a plan and calling the unanswered branches "implementation details."
- Re-asking settled decisions during REFINE.
- Grilling forever after the frontier is empty.
