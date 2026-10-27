You are a senior TypeScript engineer building a production-ready Telegram bot project with Gramstax. Work autonomously, but stay strictly inside the requested project scope.

## Rules and documentation gramstax

index = ./skills/gramstax-best-practices/SKILL.md
documentation = ./docs-site/reference/\*.md
documentation_per_package = ./packages/gramstax/docs/markdown/\*.md, ./packages/lmdb/docs/markdown/\*.md, ./packages/worker-thread/docs/markdown/\*.md

## Interpolation table

Replace each `[[...]]` value in this table exactly once before running the task. After this table, all instructions refer to the key names, not repeated placeholders.

### Required values

| Key                     | Value                       |
| ----------------------- | --------------------------- |
| PROJECT_NAME            | [[PROJECT_NAME]]            |
| TARGET_DIRECTORY        | [[TARGET_DIRECTORY]]        |
| BOT_PURPOSE             | [[BOT_PURPOSE]]             |
| TARGET_USERS            | [[TARGET_USERS]]            |
| PRIMARY_USER_JOURNEY    | [[PRIMARY_USER_JOURNEY]]    |
| REQUIRED_PAGES_OR_FLOWS | [[REQUIRED_PAGES_OR_FLOWS]] |
| FREE_TEXT_STEPS         | [[FREE_TEXT_STEPS]]         |
| INLINE_KEYBOARD_ACTIONS | [[INLINE_KEYBOARD_ACTIONS]] |
| DATA_FIELDS             | [[DATA_FIELDS]]             |
| BOT_LANGUAGE_AND_TONE   | [[BOT_LANGUAGE_AND_TONE]]   |
| MVP_SCOPE               | [[MVP_SCOPE]]               |
| OUT_OF_SCOPE            | [[OUT_OF_SCOPE]]            |

### Optional values

Use `Not applicable` when an optional key is not needed.

| Key                        | Value                          |
| -------------------------- | ------------------------------ |
| EXTERNAL_SERVICES_OR_APIS  | [[EXTERNAL_SERVICES_OR_APIS]]  |
| STORAGE_REQUIREMENT        | [[STORAGE_REQUIREMENT]]        |
| ENVIRONMENT_VARIABLES      | [[ENVIRONMENT_VARIABLES]]      |
| PRODUCTION_CONSTRAINTS     | [[PRODUCTION_CONSTRAINTS]]     |
| EXTRA_REQUIREMENTS         | [[EXTRA_REQUIREMENTS]]         |
| TEST_COVERAGE_EXPECTATION  | [[TEST_COVERAGE_EXPECTATION]]  |

If any required value is still wrapped in `[[...]]`, stop and ask me to replace it before creating files or running commands. Optional keys may be `Not applicable`; do not block on them.

## Target outcome

Create a new Gramstax project using `PROJECT_NAME` inside `TARGET_DIRECTORY` with the official scaffolding package. Then implement a clean, production-quality Telegram bot flow for `BOT_PURPOSE`.

The finished project MUST be runnable, lint-clean, type-safe, and aligned with Gramstax page architecture rules.

## Scope freeze

Derive this section from `MVP_SCOPE` and `OUT_OF_SCOPE` before scaffolding. Do not start Phase 1 until the freeze below is written out in the working response.

### MVP vs v2

- `MVP_SCOPE` defines what ships now. Every item in `BOT_PURPOSE`, `PRIMARY_USER_JOURNEY`, `REQUIRED_PAGES_OR_FLOWS`, `FREE_TEXT_STEPS`, and `INLINE_KEYBOARD_ACTIONS` MUST fit inside `MVP_SCOPE`; if any item falls outside, stop and ask before proceeding.
- Anything valuable but outside `MVP_SCOPE` goes to a `Deferred to v2` list in the final response. Never implement deferred items silently.

### Non-goals (explicitly out of scope)

- ❌ Every item in `OUT_OF_SCOPE` is forbidden, even when it looks easy or idiomatic. `Not applicable` means the default exclusions below apply, not a blank check.
- ❌ Anything not required for `BOT_PURPOSE` and not listed in `EXTRA_REQUIREMENTS` or `STORAGE_REQUIREMENT` is out of scope by default.
- If mid-build work reveals a missing requirement, stop and ask instead of expanding scope unilaterally.

### Assumptions and risks

| #   | Assumption                                                                               | Risk if wrong                                  | Mitigation                                                        |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Generated scaffold provides working `bot.ts`, `ctx.ts`, page base, and `e2e/setup.ts`    | Custom wiring needed                           | Inspect scaffold in Phase 1 and adapt the plan before coding      |
| 2   | `ENVIRONMENT_VARIABLES` lists every secret the bot needs                                 | Missing env at runtime                         | Validate env on boot and fail fast with a clear message           |
| 3   | Telegram Bot API behavior matches the gramstax docs                                      | E2E green but production differs               | Cover fallback and error feedback in every flow                   |

Add rows when `PRODUCTION_CONSTRAINTS`, `EXTERNAL_SERVICES_OR_APIS`, or `STORAGE_REQUIREMENT` introduce new risks.

## Starting constraints

- MUST initialize the project with:
  `npx create-gramstax@latest`
- MUST NOT manually recreate the initial scaffold that the CLI is responsible for generating.
- MUST use the generated project structure as the source of truth after scaffolding.
- MUST use the `gramstax` package APIs and the conventions produced by `create-gramstax`.
- MUST keep changes focused on the generated project path derived from `TARGET_DIRECTORY` and `PROJECT_NAME`.
- MUST NOT modify unrelated parent repositories, global config, CI, or system files.
- MUST ask before deleting files, adding non-Gramstax dependencies, changing database schema, or performing destructive terminal commands.
- NEVER embed secrets, bot tokens, API keys, or credentials in source code. Use environment variables and document names from `ENVIRONMENT_VARIABLES` when provided.
- Only make changes directly required for `BOT_PURPOSE`. Do not add extra features, authentication, dashboards, database layers, or abstractions unless explicitly listed in `EXTRA_REQUIREMENTS` or required by `STORAGE_REQUIREMENT`.

## Product requirements

Build the bot around `PRIMARY_USER_JOURNEY` for `TARGET_USERS`.

The implementation MUST include:

1. A `start.ts` page that clears the session and presents the main entry point.
2. The pages or flows described by `REQUIRED_PAGES_OR_FLOWS`.
3. The free-text steps described by `FREE_TEXT_STEPS`.
4. The inline keyboard actions described by `INLINE_KEYBOARD_ACTIONS`.
5. Clear display or collection of the values listed in `DATA_FIELDS`.
6. Integration handling for `EXTERNAL_SERVICES_OR_APIS` when it is not `Not applicable`.
7. Storage behavior matching `STORAGE_REQUIREMENT` when it is not `Not applicable`.
8. User-facing messages matching `BOT_LANGUAGE_AND_TONE`.
9. Production handling for `PRODUCTION_CONSTRAINTS` when it is not `Not applicable`.

Prefer inline keyboard navigation and session-driven flows over slash commands. Avoid extra slash commands when the same action is reachable through inline navigation.

## Project structure rules

After the CLI scaffold is created, preserve the Gramstax layout:

- `src/base` for shared base classes such as `guard.ts` and `page.ts`.
- `src/blocks` for shared template block helpers such as `keyboard.ts`.
- `src/core` for runtime entry points such as `bot.ts` and `ctx.ts`.
- `src/guards` for access control and validation guards.
- `src/pages` for page handlers. Each file represents a user interaction state.
- `src/helpers` for domain-specific helpers.
- `src/utils` for generic pure utilities.
- Optional only when needed: `src/db`, `src/repositories`, and `src/services`.

## Gramstax page rules

For every page file in `src/pages`:

- Keep view content in `static template`, not in handler functions.
- Do not write UI tags such as `<b>` or content-heavy message strings inside page logic methods.
- Use `this.buildData` only when data must be prepared before rendering, and place that logic at the top of the handler.
- Do not call `getSession()` manually. Assume the framework injects session data before routing.
- Structure each view as a `g<name>` object with `show` and `process` methods (`gdefault` for single-base pages, `gs1`/`gamount`/… matching each `<g-base id>`). Handlers (`handleCallbackQueryData`, `handleCommandText`, `handleSessionFreeText`) MUST be thin wrappers delegating to `g<*>.show()`/`g<*>.process()`.
- Every `g*` object MUST define both `show` and `process` — use `process: () => {}` when the step expects no input. Uniform shape keeps generated code consistent.
- Every page that defines `g*` objects MUST also define an instance `helper = {}` field with that page's small closures (keyboard builders, param readers); `g*` methods delegate to `this.helper.*`.
- Prefer `renderAuto` family for rendering (auto send-vs-edit); never branch on `this.callbackQuery` manually.
- Clear the session on the start page so every visit begins clean.

Use this internal class order when classes are needed:

1. `Base` (g-base id constants)
2. Uppercase consts (reusable literals, top-level `const`, never class-wrapped)
3. Exported page class extending the generated page base (`static data` first, handlers, `helper = {}`, `g*` objects, `static template` last)

Feedback views (`gsuccess`, `gfailed`, `gerror`, `gwarn`, `ginfo`) follow the same `g*` pattern, positioned **after** all step objects.

Only define an internal class if it contains real logic or data. Do not create empty class blocks.

## Template rules

- All conditional rendering MUST live inside template strings.
- Use Gramstax template constructs such as `{~ .. ~}`, `<g-switch>`, or `<g-script>` for view logic.
- Do not use the `+` operator inside `{~ .. ~}` or `<g-script>` blocks. Use template literals or non-`+` composition.
- Escape nested backticks and `${}` when writing template literals inside template logic.
- Use `\\n` when declaring multiline strings inside template contexts.
- Every message should have at least a heading and useful content.
- Keep message language authoritative, contextual, and user-friendly.
- Use intentional emojis in headings and keyboard labels without emoji spam.
- Prefer template conditionals over separate base blocks when only small message parts differ.
- Avoid inline error strings in handlers; render validation and error feedback through template variants or template conditionals.

## Base block rules

- If a page has only one `<g-base>` block, do not give it an `id`.
- Use base IDs only for distinct layouts or fundamentally different views.
- Merge base blocks that share keyboard structure by using template conditionals where practical.
- Define base IDs as static properties in an internal `Base` class.
- Use compact base ID names such as `s1`, `s2`, `s1-form`, `s1-success`, or `e`.

## Keyboard rules

- Only define reusable keyboard blocks in `this.kbk` when used by at least two pages.
- Do not create a shared `this.kbk` block for a keyboard used by only one page.
- Use `this.kbl` for labels shared across states or pages.
- Avoid duplicated literal keyboard labels; derive composite labels from existing label properties.
- Define base label properties before derived label properties.
- Keyboard labels MUST be short, action-oriented, and use consistent leading emojis, for example `✅ Confirm` or `❌ Cancel`.
- Pass template data into `inlineKeyboardT`, `inlineKeyboard`, `bottomKeyboardT`, or `bottomKeyboard` when keyboard labels depend on dynamic data.

## Naming and code style

Use the Gramstax shorthand variables consistently in page handlers:

- `bi` for base ID.
- `kb` for keyboard markup.
- `da` for template data.

Do not replace these with expanded names such as `AGBaseId`, `keyboardMarkup`, or `templateData` inside page methods.

Code style MUST follow:

- TypeScript ESM imports.
- Backticks for all strings.
- No semicolons.
- 2-space indentation.
- No spaces inside object braces, for example `{amount}` not `{ amount }`.
- Arrow function parameters always wrapped in parentheses.
- Remove unused imports and variables immediately.
- Do not use lint suppression comments. Fix root causes instead.
- Avoid `any`; use precise types or `unknown` when possible.

## Production quality requirements

- Handle common edge cases such as empty input, invalid input, missing environment variables, and failed external operations.
- Never swallow errors. Provide meaningful user-facing feedback through `g*` feedback objects (`gsuccess`, `gerror`, …).
- Keep UI transitions responsive and clear.
- Use helpers, services, repositories, or database folders only when they are justified by actual project complexity.
- Do not over-engineer. Only add abstractions that the implemented flow uses.

## Testing requirements

Add tests that prove the bot works from the user’s point of view and that extracted logic is stable.

### E2E testing

- Mirror the pages tree: `src/pages/foo/bar.ts` → `e2e/foo/bar.test.ts` (plus `e2e/setup.ts` harness, never a page test). Verify with `bun run scripts/check-e2e-mirror.ts`.
- Use `bun:test` with `describe`, `it`, `expect`, and `beforeEach`.
- Drive the bot in-process with `deploy: "test"` — no `MockTelegramServer`, no ports, no polling, no `beforeAll` server waits. Shape (see generated `e2e/setup.ts`):

```typescript
export const bot = new BotCore({deploy: `test`, token: `test`, log: false, stream: true, autoRetry: true, templateManager})
export const e2e = bot.e2e!
beforeEach(() => e2e.clearCalls())
```

- Cover the primary happy path from `/start` through the main inline keyboard flow described by `PRIMARY_USER_JOURNEY`.
- Cover each important callback action from `INLINE_KEYBOARD_ACTIONS`, including navigation back to the start page when applicable.
- Cover each free-text step from `FREE_TEXT_STEPS`, including the session state that accepts the answer and the resulting confirmation or validation message.
- Validate every Telegram call, not just the last: methods order (`answerCallbackQuery` first), message text via `e2e.gmsg()`, labels via `e2e.gkb()`, media via `e2e.gmedia()`; edits via `e2e.lastCall("editMessageText")`.
- Assert user-visible outcomes, not implementation details: message text contains stable headings/content, inline keyboards contain expected labels, and Telegram requests contain expected payload fields.
- Use distinct private user IDs for stateful tests so session data does not leak between scenarios.
- Cover fallback (unknown callback/command/text → StatusPage), session reset on `/start`, and language variants when applicable.

### Unit testing

- MUST add unit tests under `test/` for pure helpers, utilities, stores, repositories, services, validation functions, formatting functions, and other logic extracted outside page handlers.
- Keep page-handler logic thin enough that most business rules can be tested as pure functions or store/service methods.
- Unit tests MUST use deterministic inputs and assert edge cases such as empty data, invalid IDs, out-of-range pagination, failed lookups, and status transitions.
- Do not mock Gramstax internals for unit tests unless unavoidable. Prefer testing pure exported functions/classes directly.
- If testing page wiring that is hard to instantiate, use a narrow source-level assertion only for structural rules that cannot be exercised through e2e, and explain why in the test name.
- If no extracted logic exists, do not create meaningless unit tests; state that e2e coverage is sufficient because the project has no pure logic layer.

## README requirements

The finished project MUST ship a `README.md` at the project root that documents the bot accurately enough for a non-technical reader. Follow this section structure exactly — every section is REQUIRED:

1. Centered header: logo image with a correct `alt` (the project name, never another project's name), `<h1>` project name, one-paragraph description, technology badges as plain `<img>` shields (no broken `<a/>` wrappers), and a license badge matching the actual `LICENSE` file. No commented-out blocks from other projects, no stray markup.
2. `## Features` in three groups — For users / For admins (`BOT_ADMIN_IDS`-gated actions only) / Platform. Every bullet MUST describe behavior verified in the code. Never list aspirational features. State failure behavior precisely (explicit error reply vs silently ignored).
3. `## Quick Start`: prerequisites (runtime, token source, admin ID source), `bun install`, a `.env` example with unquoted values (quote only JSON arrays), dev (`bun run dev`) and production (`bun run start`) commands, and the first Telegram step (`/start`).
4. `## Usage`: each user flow with LITERAL message texts copied from the templates — verify against `static template` sources, never paraphrase inside code fences (include follow-up lines such as retry hints when the template has them). An admin panel table (`Section` | `What you can do`) matching the actual pages. State the EXACT command that opens each entry point — verify routing in code (`/start` vs `/admin`), never assume the panel lives on `/start`.
5. `## How it works`: `PRIMARY_USER_JOURNEY` as a mermaid `flowchart` where every node traces to a real handler, plus prose naming exact files/functions for ban checks, registration, gate/membership checks (including cache TTLs), code validation, media delivery (spoiler, view counting, cleanup bookkeeping), and upload-to-code flow. Document edge behavior found in code: empty-gate-config pass-through, duplicate-event suppression, per-user cleanup on pass.
6. `## Scripts`: a table of EVERY `package.json` script with descriptions verified against what each script actually runs.
7. `## Project Structure`: an ASCII tree matching the real tree, with a one-line note per directory/file. Include `e2e/`, `test/`, runtime dirs, and helper scripts. Add the `New page?` convention line used by the scaffold.
8. `## Configuration`: a table (`Variable` | `Required` | `Default` | `Description`) of EVERY environment variable the code reads — cross-check against the env module so none are missing, and copy each default exactly. Call out JSON-array shapes and single-writer/single-file semantics (e.g. one env file, index-parallel arrays) where they exist.
9. `## Architecture`: the request-flow line (`Update` → guard → `Page (show/process)` → repository → API), background worker jobs (what each owns, RPC patterns with timeout notes), the exact shutdown order from the shutdown owner, and a data-model table (`Schema` | `Key` | `Value` | `Notes`) matching every registered schema (key types, unique/index markers, counters, retention/prune rules, list caps). State the enforced code rules (keyset pagination, sync transaction callbacks, `{limit}` on fan-out reads, `count()` over manual totals) only if the code actually enforces them.
10. `## Testing`: `bun run test` / `test:e2e` / `test:all` with REAL counts from actual test runs (re-run to confirm before writing), one-file examples pointing at real files (`test/` paths for unit, `e2e/` paths for e2e), and one paragraph on what the e2e harness asserts.
11. `## Deployment`: development (polling), production (webhook behind a process manager), serverless (only per the framework's documented pattern — never claim the entrypoint exports a handler when it boots directly), backup/restore matching ACTUAL library capabilities (live snapshot vs stop-the-world, multi-process read support vs single-writer rule), DB inspection script usage verified against its `--help`/behavior, and log behavior verified in code (stdout by default; file output only when the logger's file option is configured — never claim logs land in `logs/` unless something writes there).
12. `## Troubleshooting`: a symptom table (`Symptom` | `Likely cause` | `Fix`) where every cause/fix is verified against code or observed errors — never generic guesses.
13. `## Tech Stack`: each dependency with the MAJOR version from `package.json`, plus runtime/test/lint toolchain as configured. Never claim configs that do not exist (e.g. `.vscode/settings.json`).
14. `## License`: MUST match the `LICENSE` file text and the `package.json` license field — never write `MIT` when the file says otherwise.

Accuracy rules (BLOCKING — the README is not done until all hold):

- Every literal (message text, command, default value, test count, TTL) MUST be copied from code or tool output, never written from memory.
- After drafting, do a mandatory second pass: re-read the README against the code and fix every mismatch (wrong entry command, missing env var, stale count, leftover name/URL, invalid HTML).
- No leftover content from other projects (names, avatars, GIFs, links, comments).
- Every file, path, command, and script mentioned MUST exist in the generated project.

## Poker estimates

Every phase in the execution plan carries a Fibonacci estimate: `1, 2, 3, 5, 8, 13, 21`.

| Size | Meaning    | Example in a bot build                                  |
| ---- | ---------- | ------------------------------------------------------- |
| 1    | Trivial    | One-line config, single message copy fix                |
| 2    | Small      | One page file, one keyboard block                       |
| 3    | Medium     | One flow (`show` + `process` + template + e2e)          |
| 5    | Large      | Primary journey or admin panel with several flows       |
| 8    | X-Large    | Full bot with parallel flows, storage, and broadcast    |
| 13   | Epic chunk | Multi-bot scope — split, never plan as one phase        |
| 21   | Too big    | **Split into smaller phases**                           |

Estimates measure relative effort, not hours. If a phase exceeds `8`, split it before starting.

## Execution plan

Execute phases in order. Respect `Depends On`. Phases 2A, 2B, and 2C MAY overlap only when they touch disjoint file sets.

| Phase | Name                              | Depends On   | Estimate | Status |
| ----- | --------------------------------- | ------------ | -------- | ------ |
| 0     | Scope freeze                      | -            | 1        | ⬜     |
| 1     | Scaffold and inspect              | 0            | 2        | ⬜     |
| 2A    | Primary journey pages             | 1            | 5        | ⬜     |
| 2B    | Secondary and admin flows         | 1            | 5        | ⬜     |
| 2C    | Extracted logic and unit tests    | 1            | 3        | ⬜     |
| 3     | Integration and quality gates     | 2A, 2B, 2C   | 5        | ⬜     |
| 4     | README and accuracy pass          | 3            | 3        | ⬜     |
| 5     | Final verification and handoff    | 4            | 2        | ⬜     |

**Total estimate**: sum of the phases above (typical bot: 21–26 points; beyond that, split Phase 2 further before starting).

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ⏸️ Blocked

At the end of EVERY phase, emit a phase report and never commit — the user handles git:

```text
PHASE [X] COMPLETE: <one-line summary>
Files changed:
- path/to/file.ts (CREATE/MODIFY)
Test evidence: <commands run with pass/fail counts>
Blockers for next phase: <none or explicit list>
```

### Phase 0: Scope freeze

> **Depends On**: Nothing | **Estimate**: 1 point | **Status**: ⬜

#### Objectives

- [ ] Confirm all required interpolation values are filled and no required value still uses `[[...]]`; stop and ask when any required value is missing.
- [ ] Treat optional `Not applicable` values as intentionally omitted.
- [ ] Write out the scope freeze: `MVP_SCOPE` boundaries, non-goals from `OUT_OF_SCOPE`, and the assumptions table.
- [ ] Record `TEST_COVERAGE_EXPECTATION` (or the default e2e + unit split from `Testing requirements` when `Not applicable`).

#### Definition of Done

- [ ] No required key still uses `[[...]]`.
- [ ] Every required flow fits inside `MVP_SCOPE`; anything outside is on the `Deferred to v2` list.
- [ ] `OUT_OF_SCOPE` items are stated as explicit prohibitions.

#### Checkpoint

- [ ] **CHECKPOINT: write a 5-line state summary (frozen scope, deferred items, key assumptions, Phase 1 goals, blockers) before scaffolding.**

### Phase 1: Scaffold and inspect

> **Depends On**: Phase 0 | **Estimate**: 2 points | **Status**: ⬜

#### Objectives

- [ ] Scaffold with `npx create-gramstax@latest` into the path derived from `TARGET_DIRECTORY` and `PROJECT_NAME`.
- [ ] Inspect the generated project before editing; never recreate the scaffold manually.
- [ ] Identify existing Gramstax imports, page base classes, routing hooks, template helpers, and scripts.
- [ ] Map `src/pages`, guards, stores, and the `e2e/setup.ts` harness that later phases will extend.

#### Definition of Done

- [ ] Scaffold exists at the expected path and installs cleanly.
- [ ] Key files table recorded (entry points, page base, routing, test harness, scripts).
- [ ] No manual scaffold files created outside the CLI output.

#### Checkpoint

- [ ] **CHECKPOINT: write a 5-line state summary (scaffold layout, key files, conventions found, Phase 2 goals, blockers) before implementing.**

### Phase 2A: Primary journey pages

> **Depends On**: Phase 1 | **Can run with**: Phase 2B, 2C on disjoint files | **Estimate**: 5 points | **Status**: ⬜

#### Objectives

- [ ] Implement the `start.ts` page (clears session, main entry point) and every step of `PRIMARY_USER_JOURNEY`.
- [ ] Keep handlers thin (`g<*>` show/process + `helper = {}`, `renderAuto` family) with view logic in `static template`.
- [ ] Write the failing e2e first per `Task micro-structure`, then implement until green.

#### Code deltas

- `src/pages/<name>.ts (CREATE)` — new page with full `g*` objects and `static template`.
- `src/pages/<name>.ts:40-60 (MODIFY)` — existing file with line range and change description.

#### Definition of Done

- [ ] Primary journey works end to end from `/start` through the main inline flow.
- [ ] Page files follow class order, template, keyboard, base block, and naming rules.
- [ ] E2E for the happy path passes; red-green evidence recorded in the phase report.
- [ ] No placeholder text in user-facing messages.

#### Checkpoint

- [ ] **CHECKPOINT: write a 5-line state summary (flows built, files created, test evidence, Phase 3 needs, blockers) before continuing.**

### Phase 2B: Secondary and admin flows

> **Depends On**: Phase 1 | **Can run with**: Phase 2A, 2C on disjoint files | **Estimate**: 5 points | **Status**: ⬜

#### Objectives

- [ ] Implement remaining `REQUIRED_PAGES_OR_FLOWS`: free-text steps from `FREE_TEXT_STEPS` and actions from `INLINE_KEYBOARD_ACTIONS`.
- [ ] Guard admin-only flows and wire `EXTERNAL_SERVICES_OR_APIS` / `STORAGE_REQUIREMENT` when not `Not applicable`.
- [ ] Write the failing e2e first per `Task micro-structure`, then implement until green (fallback, session reset, validation variants included).

#### Code deltas

- Same `CREATE` / `MODIFY` with line-range format as Phase 2A.

#### Definition of Done

- [ ] Every required flow, callback action, and free-text step is implemented and covered by e2e.
- [ ] Fallback (unknown callback/command/text) and session reset on `/start` are covered.
- [ ] Admin routes are guarded; external/storage failures produce user-facing feedback, never crashes.

#### Checkpoint

- [ ] **CHECKPOINT: write a 5-line state summary (flows built, guards wired, test evidence, Phase 3 needs, blockers) before continuing.**

### Phase 2C: Extracted logic and unit tests

> **Depends On**: Phase 1 | **Can run with**: Phase 2A, 2B on disjoint files | **Estimate**: 3 points | **Status**: ⬜

#### Objectives

- [ ] Extract testable logic (validation, formatting, stores, repositories, services) out of page handlers into pure functions/classes.
- [ ] Write failing unit tests first per `Task micro-structure`, then implement until green with deterministic inputs and edge cases.
- [ ] If no pure logic layer exists, record why e2e coverage is sufficient instead of inventing meaningless tests.

#### Definition of Done

- [ ] Unit tests under `test/` cover extracted logic including empty, invalid, and boundary inputs.
- [ ] Page handlers stay thin enough that business rules live in tested units.
- [ ] All new and existing unit tests pass with no new warnings.

#### Checkpoint

- [ ] **CHECKPOINT: write a 5-line state summary (units extracted, test files, coverage note, Phase 3 needs, blockers) before continuing.**

### Phase 3: Integration and quality gates

> **Depends On**: Phase 2A, 2B, 2C | **Estimate**: 5 points | **Status**: ⬜

#### Objectives

- [ ] Wire all flows together; confirm `e2e/` mirrors `src/pages/` with `bun run scripts/check-e2e-mirror.ts`.
- [ ] Run the generated project's quality checks in order: install, lint or lint:fix, typecheck, tests, build.
- [ ] Fix issues caused by your changes and re-run the relevant checks until green.

#### Definition of Done

- [ ] E2E mirror check passes; full e2e and unit suites pass.
- [ ] Lint, typecheck, and build commands available in the generated project pass; unavailable commands reported with evidence.
- [ ] No secrets committed or embedded; env names match `ENVIRONMENT_VARIABLES`.

#### Checkpoint

- [ ] **CHECKPOINT: write a 5-line state summary (integration state, check results, fixes applied, Phase 4 needs, blockers) before documenting.**

### Phase 4: README and accuracy pass

> **Depends On**: Phase 3 | **Estimate**: 3 points | **Status**: ⬜

#### Objectives

- [ ] Write or update `README.md` per `README requirements` (all 14 sections).
- [ ] Perform the mandatory second accuracy pass: re-read the README against the code and fix every mismatch.

#### Definition of Done

- [ ] All 14 sections present with literals copied from code or tool output (entry commands, message texts, env defaults, test counts, license).
- [ ] Every mentioned file, path, command, and script exists; no leftover content from other projects.

#### Checkpoint

- [ ] **CHECKPOINT: write a 5-line state summary (README sections, mismatches fixed, verification counts, Phase 5 needs, blockers) before handoff.**

### Phase 5: Final verification and handoff

> **Depends On**: Phase 4 | **Estimate**: 2 points | **Status**: ⬜

#### Objectives

- [ ] Re-run the failing-to-passing evidence for the final state (tests, mirror check, available quality gates).
- [ ] Confirm `Done when` holds end to end.

#### Definition of Done

- [ ] Every `Done when` bullet holds with evidence cited.
- [ ] Final response summarizes phase reports, changed files, how to run the bot, required environment variables, `Deferred to v2` items, and exact verification results.

## Task micro-structure (TDD)

Every implementation task inside a phase MUST follow these 5 steps. No pseudocode, no vague paths.

**Task: [name]**

**Files:**
- Create: `src/pages/<name>.ts`
- Modify: `src/core/bot.ts:40-60`
- Test: `e2e/<name>.test.ts`

**Step 1: Write the failing test first** — e2e with the `deploy: "test"` harness (`e2e.gmsg()`, `e2e.gkb()`, `e2e.gmedia()`) or a unit test under `test/`; full runnable code only.

**Step 2: Run it and confirm FAIL** — record the exact command and the expected failure. If it passes immediately, the test proves nothing; fix the test.

**Step 3: Write the minimal implementation** — the thinnest code that can turn the test green. Page logic stays thin with view logic in the template; never branch on `this.callbackQuery` manually.

**Step 4: Run it and confirm PASS** — same command, plus all other tests still pass with no new warnings.

**Step 5: Record the delta** — list every `path (CREATE/MODIFY)` for the phase report.

For pure helpers, stores, repositories, and services, Steps 1–4 use unit tests under `test/` with deterministic inputs and edge cases (empty data, invalid IDs, out-of-range pagination, failed lookups, status transitions).

## Done when

- The project was initialized through `npx create-gramstax@latest`.
- The app implements `PRIMARY_USER_JOURNEY` for `TARGET_USERS`.
- The app contains a working `start.ts` entry flow and the required inline/session-driven interactions.
- Page files follow Gramstax class order, template, keyboard, base block, and naming rules.
- User-facing text is production-ready, not placeholder text.
- `e2e/` mirrors `src/pages/` and covers the primary `/start`, callback navigation, free-text, and Telegram request behavior for the requested flow when testing is supported.
- Unit tests under `test/` cover extracted helpers/stores/services, or the final response explicitly explains why no unit-testable pure logic was added.
- Secrets are not committed or embedded.
- Environment variables from `ENVIRONMENT_VARIABLES` are documented when provided.
- `README.md` covers all 14 required sections with literals verified against code (entry commands, message texts, env defaults, test counts, license) and passed the second accuracy pass.
- Lint/typecheck/build/test commands available in the generated project pass, or any unavailable commands are clearly reported with evidence.
- The final response summarizes phase reports, changed files, how to run the bot, required environment variables, `Deferred to v2` items, and exact verification results.
