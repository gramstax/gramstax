# CREATE-GRAMSTAX — CLI Scaffolding Tool

Generates new Gramstax bot projects via `bunx create-gramstax` with interactive or non-interactive mode.

## Source Layout

```
packages/create-gramstax/src/
├── index.ts           CLI entrypoint (commander)
├── create.ts          Project generator (copy + placeholder replacement + conditional post-processing)
├── utils/fs.ts        Filesystem helpers, package-manager command resolution
├── utils/log.ts       Logger singleton
├── templates/         All scaffolded project files (copied verbatim, then processed)
│   ├── package.json, tsconfig.json, biome.json, gitignore, .env.example, LICENSE, README.md, AGENTS.md
│   ├── gramstax.config.ts  Typed composition (default export `: GramstaxConfig`) — the boot entry
│   ├── src/
│   │   ├── base/page.ts       PageBase template
│   │   ├── base/page-admin.ts PageAdminBase template (hookBeforeRoute access gate)
│   │   ├── base/guard.ts      GuardBase template
│   │   ├── core/bot.ts        Bot wrapper (extends Gramstax) — calls ServicesCore on start/stop
│   │   ├── core/ctx.ts        Ctx wrapper (extends gramstax Ctx)
│   │   ├── core/services.ts  Service seam — `ServicesCore.start()`/`ServicesCore.stop()` — REGENERATED per feature set
│   │   ├── blocks/g-keyboard.ts Keyboard block template
│   │   ├── helpers/log.ts     Logger re-export
│   │   ├── guards/user.ts     User guard template
│   │   ├── db/index.ts        Db (LmdbEnv subclass) + static Db.open/get/start/stop (only when LMDB enabled)
│   │   ├── db/schema/user.ts
│   │   ├── db/repositories/user.ts
│   │   ├── workers/job.ts     WorkerThreadInit subclass + JobWorker export (RPC surface + launchWorker/shutdown) (only when workers enabled)
│   │   ├── pages/*            9 page templates (nested start/random)
│   │   ├── types/             Shared types grouped by domain: user.ts (LMDB), job.ts (workers), page.ts (always kept)
│   ├── test/.gitkeep
│   ├── e2e/                   setup.ts + COVERAGE.md ledger + 9 test file templates (shared enUser/idUser fixtures, 4001/5001)
│   └── scripts/               check-e2e-mirror.ts + check-e2e-handlers.ts + generate-e2e-structure.ts (single-project e2e tooling)
```

## How It Works

1. User runs `bunx create-gramstax [project-name]` with optional flags (`--skip-install`, `--no-biome`, `--no-lmdb`, `--no-worker-thread`, `--pm`, etc.). The positional is a bare name (not a path).
2. CLI reads flags, prompts for missing values via enquirer (non-TTY without full flags errors out naming what is missing).
3. Copies `templates/` to target dir, replacing generator placeholders (`projectName`, `packageName`, `installCmd`, etc.); runtime `{{userName}}`/`{{result}}`/`{{res}}` placeholders are intentionally preserved, and any other leftover `{{...}}` fails the run.
4. Post-processes:
   - Renames `.env.example` → `.env` (preserves a pre-existing `.env`)
   - Strips every monorepo `tsconfig` `paths` entry — scaffolds are standalone, and a `gramstax` → `src` mapping breaks `gramstax start`'s `instanceof Gramstax` discovery (two copies of the package)
   - Removes `src/db/` + `src/types/user.ts` + `@gramstax/lmdb` deps when LMDB disabled
   - Removes `src/workers/` + `src/types/job.ts` + `@gramstax/worker-thread` dep when workers disabled
   - Regenerates `src/core/services.ts` from `buildServicesSource(useLmdb, useWorkerThread)` — `BotCore` calls `ServicesCore.start()`/`ServicesCore.stop()` unconditionally, so it must never statically reference a pruned directory
   - Adds `@biomejs/biome` to devDependencies when Biome enabled (installed with the rest); removes `biome.json` + `lint*`/`format*` scripts otherwise
5. Runs `installCmd` in the target directory (unless `--skip-install`).
6. Errors: `Create` only throws (never `process.exit`); `index.ts` maps to exit codes (0 ok, 1 error, 2 usage, 0 + `Setup cancelled` on cancel).

## Boot Model

Generated projects have **no `src/index.ts`**. `gramstax.config.ts` is the composition point and `gramstax start` constructs the `Gramstax` subclass found at `src/core/bot.ts`:

```json
"dev": "gramstax start --watch",
"start": "gramstax start",
"build:gramstax": "gramstax build"
```

Bun is required, but the published bin has a Bun shebang; no `bun --bun` prefix is needed. The CLI loads project-root `.env*` files automatically. Generated projects are Bun-only: there is no runtime selection, and every app, test, and build script runs through Bun.

## CLI Flags

| Flag                          | Type       | Default            |
| ----------------------------- | ---------- | ------------------ |
| `project-name`                | positional | interactive prompt |
| `--pm <name>`                 | string     | detect (lockfile/user-agent) → `bun` |
| `--lmdb` / `--no-lmdb`        | boolean    | LMDB included      |
| `--worker-thread` / `--no-worker-thread` | boolean | Workers included |
| `--biome` / `--no-biome`      | boolean    | Biome included     |
| `--skip-install`              | boolean    | install runs       |

Case-insensitive `--pm` (normalized before validation). Boolean flags are declared on both sides; with neither side supplied, the corresponding prompt is reachable.
## Template Variables

Placeholders replaced in all copied files:

- `{{projectName}}` (display case, dirs/README)
- `{{packageName}}` (lowercased, `package.json` name — npm-valid)
- `{{installCmd}}`, `{{runDevCmd}}`, `{{runStartCmd}}`
- Runtime template syntax `{{userName}}`, `{{result}}`, `{{res}}` is intentionally left untouched.

## Build & Test

```
nx build create-gramstax     # tsup → dist/src/index.js
bun test packages/create-gramstax/test/
```

## Anti-Patterns

- Do not add new runtime dependencies — CLI already has `commander`, `enquirer`, `logging-pretty`.
- Template files use backtick strings to match repo lint rules.
- When adding new template files, update `create.ts` copy/post-processing logic.
- Never let a template file import an optional module (`~/db`, `~/workers/job`) unless that file is itself pruned with it. The single exception is `src/core/services.ts`, which `buildServicesSource` rewrites per feature combination — keep it byte-identical to `buildServicesSource(true, true)`, which `test/generation.test.ts` asserts.
- Keep each optional feature self-contained: its lifecycle lives inside the directory that gets pruned (`Db.start`/`Db.stop`; the worker is driven through `JobWorker.launchWorker()`/`shutdown()`), and `services.ts` only dispatches. This is what keeps `--lmdb` and `--worker-thread` independently combinable.
- **Scaffolded source is class-based only.** No module-level `export function` and no `export const x = async () => …` under `templates/src/` — put the behaviour on a class (static members are fine, and are how the lifecycle is exposed). `test/generation.test.ts` walks `templates/src` and fails on any offender, so this is enforced, not merely reviewed.
- **No `console.*` under `templates/src/`.** Route everything through `LogHe` from `~/helpers/log`, so output honours the log destination configured in `gramstax.config.ts` (`log.override`). `warn` for diagnostics, `info` for progress, `errorMake(err, Class, fn)` for failures. Enforced by a test.
- **Every `private` member takes an underscore prefix** (`_instance`, `_job`, `_user`), including `private static`. Enforced by a test.
- `JobWorker` is the worker-thread package's export — it is already the typed RPC surface (`await JobWorker.mtdPing()`) *and* the lifecycle handle (`launchWorker()` / `shutdown(ms)`). Do not wrap it, store the handle, or add `start()`/`stop()` helpers; `shutdown()` drains every worker it launched and throws only when nothing was ever launched. Call it straight from `ServicesCore`.
- The worker never touches storage: `src/workers/job.ts` must stay import-clean of `@gramstax/lmdb` and `~/db`, because `--worker-thread` is valid without `--lmdb`. Scheduling belongs to `LmdbJobRun` on the main thread.
- Template `biome.json` mirrors the root config with environment conditioning: `root: true` (standalone projects — `root: false` would silently disable the config when no parent config exists), project-specific excludes (`dist`, `database`, `experiments`, `logs`, `data`), and a test/e2e override for `noExplicitAny`.
- The root `biome.json` excludes `packages/create-gramstax/src/templates` (a nested `root: true` config conflicts with the monorepo root). Lint/format templates with their own config: `bunx biome lint packages/create-gramstax/src/templates` works from inside the templates dir, or `bunx biome lint --config-path=packages/create-gramstax/src/templates/biome.json <path>`.
- The generated project is Biome-only.
- `templates/scripts/check-e2e-handlers.ts` must stay byte-identical to the repo-root `scripts/check-e2e-handlers.ts`; it is the generated project's coverage gate.
- A new page template needs its mirrored `e2e/*.test.ts` **and** a row for every handler in `templates/e2e/COVERAGE.md`; `test:all` in the generated project runs both checks.
