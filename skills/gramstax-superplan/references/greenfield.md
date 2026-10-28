# Greenfield Gramstax Bootstrap

Use this reference when the project does **not** exist yet, or the directory is empty/near-empty and the user wants to create a Gramstax app.

## Detect Greenfield

Treat the project as greenfield when:

- there is no `package.json`; or
- there is a `package.json` but no application source and no `gramstax` dependency or `gramstax.config.ts`; or
- the target directory is effectively empty.

An “effectively empty” directory may contain only `.git`, `.gitignore`, `.gitkeep`, `.DS_Store`, or `Thumbs.db`, at the top level or one level of nesting; `create-gramstax` treats those as empty.

If the project already has a `package.json` and app code, do not call it greenfield. Treat it as an existing app and plan an incremental integration instead: `bun add gramstax`, a `gramstax.config.ts`, a `Gramstax` subclass at `src/core/bot.ts`, a first page, and the app's Bun scripts. Do not scaffold over existing code.

## Questions To Grill

- Is this a brand-new app, or an existing project that should adopt Gramstax?
- Project name and destination: a new subdirectory, or the current empty directory?
- Which optional features should be enabled from the start?
  - `@gramstax/lmdb` for persistence
  - `@gramstax/worker-thread` for background jobs
  - Biome for lint/format
- Which package manager should install dependencies? Bun is recommended; the generated app itself is Bun-only.
- Which first user journey should replace or extend the starter pages?
- Which deploy mode is the first target: `polling`, `webhook`, or `serverless`?
- Is `--skip-install` needed (CI/offline), with `bun install` run separately?
- Where will the plan live, given that a plan file makes an empty directory non-empty?

## Recommended Bootstrap

From the parent directory:

```bash
bunx create-gramstax@latest my-bot --pm bun --lmdb --worker-thread --biome
```

For a smaller app:

```bash
bunx create-gramstax@latest my-bot --pm bun --no-lmdb --no-worker-thread --biome
```

In a non-TTY/CI environment, all three feature flags must be stated explicitly (`--lmdb`/`--no-lmdb`, `--worker-thread`/`--no-worker-thread`, `--biome`/`--no-biome`). The CLI will not guess.

If dependencies must be installed separately:

```bash
bunx create-gramstax@latest my-bot --pm bun --lmdb --worker-thread --biome --skip-install
cd my-bot
bun install
```

## Scaffolding Into The Current Empty Directory

The project name must match `/^[a-z0-9-_]{1,100}$/i`. **Do not pass `.` as the project name.**

To scaffold into the current directory, run `bunx create-gramstax@latest` interactively and submit an empty project name. The current directory must be effectively empty. If you already created a plan file there, it is no longer empty; scaffold into a new subdirectory or keep the plan in the parent instead.

## Plan Placement

There are two safe patterns:

1. **Plan in the parent, scaffold a subdirectory (recommended)**
   ```text
   workspace/
     plans/000-bootstrap-greenfield/plan.md
     my-bot/                         # created by create-gramstax after approval
   ```
   After the scaffold exists, create `my-bot/plans/` and move the approved plan there. Record the path change in the plan's change log.

2. **Plan in conversation, scaffold the current empty directory**
   Finish the grill and design first, scaffold interactively with an empty project name, then write `plans/000-bootstrap-greenfield/plan.md` inside the new app before customizing pages.

Do not create `plans/` inside an otherwise empty directory and then try to scaffold in place; the directory is no longer effectively empty.

## Bootstrap Phases

Use a normal plan with these phases:

### Phase 1 — Scaffold

- Load `gramstax-best-practices` before finalizing scaffold flags and the first page flow.
- Run the chosen `create-gramstax` command.
- Record the generated package manager, feature flags, and framework version.
- Confirm the target directory was created and dependencies installed (or install them).

### Phase 2 — Baseline Verification

From the new app:

```bash
bun run test:all
bun run typecheck
bun run lint
bun run build:gramstax
bun run start -- --help
```

Do not customize pages before the generated baseline passes.

### Phase 3 — App Configuration

- Set `BOT_TOKEN` in `.env` (never commit it).
- Choose the initial deploy mode in `gramstax.config.ts`.
- Record every new environment variable in the app README; add a safe `.env.example` only if the project uses one. The generated project starts with `.env` and may not keep a committed example.
- Record whether LMDB and worker threads were kept.

### Phase 4 — First Real Journey

- Replace or extend the starter pages with the user's first flow.
- Keep the e2e mirror: a new page needs `e2e/<page>.test.ts`.
- Use `gramstax-best-practices` for page, template, keyboard, guard, and e2e rules.
- If LMDB is enabled, load `lmdb-best-practices`.
- If worker threads are enabled, load `worker-thread-best-practices`.

### Phase 5 — Verification and Handoff

- Run the app's full gate from `package.json`.
- Perform one manual Telegram journey with `bun run dev`.
- Record the final framework version and evidence in the plan/execution report.

## Greenfield Traps

| Trap | Why it matters | Correct handling |
| --- | --- | --- |
| `bunx create-gramstax@latest .` | `.` is not a valid project name | Use a subdirectory, or run interactively and submit an empty name in an empty current directory |
| Creating `plans/` in an empty target before scaffolding | The target is no longer effectively empty | Keep the plan in the parent, then move it after scaffold; or grill before in-place scaffold |
| Non-TTY without all three feature flags | The CLI reports missing options instead of guessing | State `--lmdb`/`--no-lmdb`, `--worker-thread`/`--no-worker-thread`, `--biome`/`--no-biome` |
| Customizing before baseline tests pass | You cannot tell scaffold breakage from your change | Run the generated suite first |
| Treating the generated app as the framework repo | Monorepo paths and commands do not exist in the app | Use the app's `package.json` and `bun` scripts |
| Forgetting the e2e mirror | Generated projects enforce page/test parity | Add the mirror test with every new page |
| Committing `.env` or tokens | Secrets leak | Keep `.env` local; document safe variables in the README, or add `.env.example` if the app uses one |
