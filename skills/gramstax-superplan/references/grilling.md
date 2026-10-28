# Grilling Protocol For App Work

Adapted from mattpocock's `grill-me` skill. The purpose is to make every assumption visible before an app plan turns it into code.

## The Design Tree

Model the change as a tree:

- **Root:** shared understanding of the app outcome.
- **Branches:** scope, app surface, runtime/deploy, behavior, pages/templates, data/state, testing, documentation, release/dependencies, plan mechanics.
- **Leaves:** concrete decisions that can be written into the plan.

Every decision unlocks the decisions below it. Do not ask a child question before its parent is settled.

## The Frontier

The **frontier** is every decision whose prerequisites are already settled — the questions that can be answered now without guessing at answers you have not heard.

Ask the whole frontier in one round. Then wait. Recompute the frontier after every round. A question whose answer depends on another open question belongs to a later round.

## Round Format

```text
❓ **Q1** - **<question title>**: <question body, including choices if any>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body>

➡️ <your recommended answer>
```

Word each question so that “yes” accepts the recommendation. Make the recommendation specific enough to become a plan decision.

## Facts vs Decisions

**Facts are your job.** If a frontier question needs a fact from the app, installed dependency, or docs:

- read `package.json` when present, `gramstax.config.ts` when present, `README.md`, source, and tests yourself;
- dispatch `explorer` for app code facts;
- dispatch `librarian` for framework/version-specific facts;
- read the installed package README when the app pins an older version.

**Decisions are the user's.** Put each real choice to them with a recommendation. Do not silently decide scope, compatibility, release, or risk tolerance.

A running exploration is an unsettled prerequisite. Ask the rest of the frontier now; only questions downstream of that fact wait.

## App Decision Branches

Use the branches that apply. Do not ask about LMDB for a template-only change; do not ask about workers for a docs-only change.

### 0. Greenfield Baseline

Ask only when the project is empty or has no Gramstax dependency.

- Is this a new app, or an existing project adopting Gramstax?
- Should `create-gramstax` scaffold a new subdirectory, or the current effectively empty directory?
- What project name should be used? (Letters, numbers, hyphens, underscores; not `.`.)
- Which optional features are wanted: LMDB, worker threads, Biome?
- Is Bun the intended install/runtime? (Recommended; generated projects are Bun-only.)
- What is the first deploy mode: `polling`, `webhook`, or `serverless`?
- Where should the plan live so it does not make the scaffold target non-empty?
- What is the first user journey after the generated baseline passes?

Recommended default: `bunx create-gramstax@latest <name> --pm bun --lmdb --worker-thread --biome` in a new subdirectory; plan the first page flow in the same plan, then scaffold and verify the generated baseline.

### 1. Outcome and Scope

- What is the smallest user-visible or developer-visible outcome?
- What is explicitly out of scope?
- Is this a new page/flow, a fix, a refactor, a dependency upgrade, or release work?
- Which existing behavior must not change?
- Is there a deadline, app release, or compatibility boundary?

### 2. App Surface

Which app-owned surface may change?

- `src/pages` — routes, handlers, navigation, sessions.
- `src/base` — shared page/guard behavior.
- `src/guards` — access control and input validation.
- `src/blocks` — keyboards and reusable template fragments.
- `src/core` — bot/context/services wiring.
- `src/db` — LMDB schemas, repositories, indexes, migrations.
- `src/workers` or `src/jobs` — background jobs and RPC.
- `e2e` / `test` — journeys, unit tests, fixtures.
- `gramstax.config.ts` / env documentation (`.env.example` if present) — deploy, caches, runtime knobs.
- `README.md` — app docs.

Ask which surfaces may change and which must stay untouched.

### 3. Runtime and Deploy

- Does the app run under `deploy: "polling"`, `"webhook"`, `"serverless"`, `"raw"`, or `"test"`?
- Is the change local only, or does it affect webhook/status/serverless behavior?
- Does it touch secrets, status-server exposure, rate limits, throttling, or session locks?
- Does it change `gramstax start`, `gramstax build`, or `.gramstax/` output?
- Is the app on an older Gramstax major? Which API applies?

### 4. Behavior and API

- What is the user journey or protocol flow?
- What are the success, empty, loading, error, retry, and cancellation paths?
- Does it change a page handler, callback data, session shape, keyboard, or template?
- Is the change public to the app's users or internal only?
- What should happen on invalid input, missing config, or a failed external call?

### 5. Pages, Templates, and Keyboards

- Which page or route is entered?
- Does it add or change a page class, base class, guard, or hook?
- Does it add a `g-*` block, template tag, filter, scope, or keyboard?
- Must the template survive `gramstax build` (AOT), or is it JIT-only?
- Does it touch untrusted input or HTML escaping?
- Is the e2e mirror updated for every added/renamed page?

### 6. Data and State

- What is read, created, updated, deleted, or retained?
- Is LMDB involved? Which schema, key, index, TTL, queue, migration, or backup?
- Is there a transaction boundary or consistency requirement?
- Does a worker own the work, or is it main-thread only?
- What happens on restart, duplicate delivery, or partial failure?

### 7. Testing and Evidence

- What proves the behavior: unit, in-process e2e, example flow, or a built-app smoke?
- What is the red test before implementation?
- Which existing suites must stay green?
- Is a scanner/guard needed for the e2e mirror or config?
- What manual check remains after automation?

### 8. Documentation and Versioning

- Which README, app doc, or `AGENTS.md` describes the behavior?
- Does the change depend on a specific `gramstax`, `@gramstax/lmdb`, or `@gramstax/worker-thread` version?
- Does the app need a migration note, changelog, or release note?
- Are we planning against the installed version or the current framework `main`?

### 9. Release and Git

- Is an app version bump expected?
- Is this a breaking change for the app's users or deployment?
- Does the user want a commit, and with what prefix/scope?
- Are secrets, `.env` files, data, or generated output excluded from the commit?

### 10. Plan Mechanics

- Which plan file is being created or changed?
- Does `plans/` exist, and is it tracked by Git?
- Which phases are parallel, and what are their disjoint write scopes?
- Who validates each lane?
- Is the plan executed by `superbuild` or manually phase-by-phase?
- What is the stop condition after the current phase?

## Round Templates

### Small Change

Ask 3–5 questions from Outcome, App Surface, Testing, and Plan Mechanics.

### Medium Feature

Round 1: outcome, scope, app surface, runtime/deploy.

Round 2: behavior/API, pages/templates, data/state, testing.

Round 3: docs/version, release, parallel lanes, handoff.

### Large / Cross-Cutting Work

Round 1: outcome, non-goals, app surface, compatibility, dependency version.

Round 2: behavior contracts, pages/templates, data/state, deploy, failure modes.

Round 3: testing strategy, migration/upgrade, docs, parallel lanes, execution mode.

Do not mechanically use all three rounds if the frontier is already empty. Do not skip a round because the user seems impatient.

## When to Stop Grilling

The frontier is empty when:

- Every branch has a decision or an explicit Known Unknown.
- No open question depends on another open question.
- The user has confirmed the shared understanding.
- The plan can name exact app files, tests, commands, and stop conditions.

Do not write the plan, change the plan, or start implementation before that confirmation.

## Anti-Patterns

- Asking the user for a path or version you can read from `package.json`.
- Planning against the framework `main` API when the app pins an older major.
- Asking 20 questions in one paragraph with no recommendations.
- Asking child questions before the parent decision.
- Treating “yes” as agreement to an unstated design.
- Writing a plan and calling unanswered branches “implementation details”.
- Re-asking settled decisions during REFINE.
- Grilling forever after the frontier is empty.
