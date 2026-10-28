# AGENTS.md

Guidance for coding agents working in this generated Gramstax app. Read `README.md`, `package.json`, `gramstax.config.ts`, and the actual source before changing behavior.

## Project Truth

- This is a **Bun-only** Gramstax app. `gramstax start`, the test runner, and the build all run on Bun. Do not add a Node app runtime, Jest, or Vitest.
- `gramstax.config.ts` is the composition point. `gramstax start` discovers the `Gramstax` subclass at `src/core/bot.ts`; there is no `src/index.ts`.
- `src/core/ctx.ts` extends the Gramstax `Ctx` class. `src/core/services.ts` wires the optional services that were kept at scaffold time.
- `e2e/setup.ts` is the only place that constructs `BotCore` directly. It uses `deploy: "test"`, a test token, and an explicit `TemplateManager` path.
- `~/*` resolves to `src/*`. Package imports use the names recorded in `package.json`; `gramstax` is the framework import.
- The route tree is `src/pages/`. The `e2e/` tree mirrors it one-to-one.

## Commands

Run these from the project root:

```bash
bun run dev
bun run start
bun run build:gramstax
bun run typecheck
bun run test
bun run test:e2e
bun run test:e2e:check
bun run test:all
```

The install command may have been chosen as Bun, npm, pnpm, or Yarn at scaffold time, but the app runtime and test runner remain Bun. Use the scripts that exist in `package.json`.

Biome is included in the default scaffold. If `biome.json` exists, use the generated lint and format scripts:

```bash
bun run lint
bun run lint:fix
bun run format
```

If `biome.json` is absent, do not assume `lint` or `format` exists.

## Configuration

- `.env` is created during scaffolding and is gitignored. Keep it local; never commit tokens or secrets. The scaffold does not keep a second environment example file; document new environment variables in `README.md`.
- The generated variables are `BOT_TOKEN`, `BOT_DEPLOY`, `CACHE_SESSION_STORE`, `CACHE_SESSION_TTL`, and `CACHE_SESSION_NAMESPACE`. With LMDB enabled, `DB_PATH` is appended and defaults to `./data`.
- `BOT_DEPLOY` defaults to `polling`. The normal modes are `polling`, `webhook`, and `serverless`; the framework also recognizes `raw` (bare grammY) and `test` (the e2e harness).
- `raw` is a bare grammY bot: pages and templates are bypassed. Do not switch to it unless that is intentional.
- Webhook and serverless settings live in `optionsDeploy` in `gramstax.config.ts`. Their secret comes from the `BOT_WEBHOOK_SECRET` runtime binding (for example, `wrangler secret put BOT_WEBHOOK_SECRET`), never a literal in the config file.
- The `log.override` entry points at `src/helpers/log.ts`, which exports `LogHe`. Use `LogHe` for application logging.

## Pages, Guards, and Templates

- A page is a class under `src/pages/` extending `PageBase`. Page behavior lives in its `show`/`process` steps, route handlers, sessions, and `static template`.
- `src/base/page.ts` is the shared page base. `src/base/guard.ts` is the guard base. `src/base/page-admin.ts` is an optional admin-gate base; extend it only for pages that need that gate.
- `src/blocks/g-keyboard.ts` contains the reusable keyboard builders. Prefer the shared `KeyboardGBlock` helpers over duplicating labels or keyboard structures.
- The scaffold's `UserGuard.ensureUsername()` rejects users without a Telegram username. That is a product decision; change it deliberately if this bot should allow them.
- Add or rename a page under `src/pages/` and update its mirror at the same relative path under `e2e/`. For example, `src/pages/foo.ts` pairs with `e2e/foo.test.ts`, and `src/pages/start/index.ts` pairs with `e2e/start/index.test.ts`.
- `e2e/COVERAGE.md` is the handler/test ledger. Every `handle*` the page defines needs a row that names the test proving it; every test file needs to be referenced. `bun run scripts/check-e2e-handlers.ts` fails when either side is missing.
- Run `bun run test:e2e:check` after adding, renaming, or removing a page or handler. It runs the bidirectional mirror check and the ledger audit.
- `g-*` template blocks, filters, keyboards, and AOT constraints are governed by the Gramstax best-practice rules. Prefer page classes and framework helpers over hand-written Telegram API calls.
- `optionsPage.shortCallbackQueryData` is enabled. Use page classes and keyboard helpers instead of hard-coded callback strings.
- `gramstax build` writes `.gramstax/`. Change the page or config source and rebuild; never hand-edit that tree.

## Optional Features

Check the project before assuming an optional feature exists.

| Feature | Enabled looks like | Disabled means |
| --- | --- | --- |
| LMDB | LMDB dependency in `package.json`; `src/db/` exists; `src/types/user.ts` exists; `DB_PATH` is set | No `src/db/`, no LMDB dependency, no user types |
| Worker threads | Worker dependency in `package.json`; `src/workers/` exists; `src/types/job.ts` exists | No `src/workers/`, no worker dependency, no job types |
| Biome | `biome.json` exists; `lint` and `format` scripts exist | No Biome config or scripts |

`src/core/services.ts` is generated to match the features kept at scaffold time. After generation it is ordinary app code. If you add or remove an optional service, update `services.ts` and its imports deliberately.

### LMDB

- `src/db/index.ts` defines the process-wide `Db` singleton. `Db.start()` opens it through `Db.open()`; `Db.get()` returns the open instance.
- The default store path is `process.env.DB_PATH` or `./data`. `data/` is runtime state.
- `Db.start()` also starts the scaffold's restart-safe `nightly-report` schedule through `LmdbJobRun`. Keep or replace that schedule intentionally.
- Schemas live under `src/db/schema/`; repositories live under `src/db/repositories/`. Keep storage operations behind repositories rather than scattering raw store calls through pages.
- When both features are present, `ServicesCore.stop()` stops workers before `Db.stop()`. Keep that order: a worker can still be reading when shutdown begins.

### Worker threads

- `src/workers/job.ts` defines the worker and exports `JobWorker`. `JobWorker` is both the typed RPC surface (`mtd*` methods) and the lifecycle handle (`launchWorker()` / `shutdown(ms)`).
- `ServicesCore.start()` launches the worker; `ServicesCore.stop()` shuts it down. `shutdown()` throws when no worker was ever launched, and the scaffold catches that case.
- Scheduling belongs on the main thread. A `setInterval` inside the worker loses its cadence when the process restarts. When LMDB is also enabled, the scaffold's restart-safe schedule lives in `Db.start()`; never schedule from the worker.
- Keep `src/workers/job.ts` free of `~/db` and LMDB imports. A worker-only project must remain valid without LMDB.

## Code Conventions

- Follow the scaffold's class-based style under `src/`: behavior lives on classes, including static lifecycle methods. Avoid module-level exported functions and module-level async function constants.
- Match the existing private-member convention: private fields use an underscore prefix, including private static fields.
- Route all logging through `LogHe` from `~/helpers/log`. Do not call `console.*` under `src/`.
- TypeScript is strict and enables `noUncheckedIndexedAccess`. Prefer precise types over `any`; narrow casts when the boundary truly requires one.
- Biome is the linter and formatter when present. Follow its config rather than adding ESLint or Prettier.
- Keep shared domain types in `src/types/<domain>.ts`. Do not declare page/domain interfaces inline when they are reused.
- Keep runtime artifacts such as `logs/`, `data/`, and `.gramstax/` out of source changes. Do not edit `node_modules` or installed package source.

## Best-Practice Skills

If this project has the Gramstax skills installed, load the matching one before designing app behavior:

- `gramstax-best-practices` for pages, templates, keyboards, guards, config, e2e, deploy, and cache.
- `lmdb-best-practices` only when `src/db/` and the LMDB dependency are present.
- `worker-thread-best-practices` only when `src/workers/` and the worker dependency are present.

If the skills are not installed, use the installed package READMEs and the Gramstax repository docs. Do not treat current `main` rules as valid for a pinned older dependency without checking the installed version.

## Planning

If the project has `gramstax-superplan`, use it for app planning. Plans live at `plans/NNN-feature-slug/plan.md`; the scaffold does not create `plans/`, so create it when the project starts using plans. Keep planning app-owned: this is a consumer project, not the Gramstax framework monorepo.

## Verification

A change is complete only when the relevant current commands pass and their output has been read:

```bash
bun run typecheck
bun run test:all        # includes test:e2e:check (mirror + coverage ledger)
bun run build:gramstax
bun run start -- --help
bun run lint                  # only when biome.json exists
git diff --check              # only when this project is a git repository
```

For a page change, exercise the real Telegram flow with `bun run dev` and record the steps and expected messages. For a worker change, check startup failure and shutdown. For an LMDB change, check restart and existing data. Do not claim a phase is complete from a prior run, a subagent summary, or "the code looks right."

## Do Not

- Do not add a Node runtime, Jest, or Vitest.
- Do not edit `node_modules`, installed package source, or `.gramstax/` output.
- Do not commit `.env`, tokens, runtime data, logs, or generated build output.
- Do not add or rename a page without its `e2e/` mirror and its `e2e/COVERAGE.md` rows.
- Do not assume LMDB or worker directories exist; check `package.json` and the tree first.
- Do not replace the scaffold's page/template wiring with raw Telegram API calls without a specific reason.
