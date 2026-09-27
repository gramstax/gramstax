# CREATE-GRAMSTAX — CLI Scaffolding Tool

Generates new Gramstax bot projects via `npx create-gramstax` with interactive or non-interactive mode.

## Source Layout

```
packages/create-gramstax/src/
├── index.ts           CLI entrypoint (#!/usr/bin/env node, commander)
├── create.ts          Project generator (copy + placeholder replacement + conditional post-processing)
├── utils/fs.ts        Filesystem helpers, package-manager command resolution
├── utils/log.ts       Logger singleton
├── templates/         All scaffolded project files (copied verbatim, then processed)
│   ├── package.json, tsconfig.json, biome.json, .gitignore, .env.example, LICENSE, README.md
│   ├── src/
│   │   ├── index.ts           Generated app entrypoint
│   │   ├── env.ts
│   │   ├── base/page.ts       PageBase template
│   │   ├── base/guard.ts      GuardBase template
│   │   ├── core/bot.ts        Bot wrapper (extends Gramstax)
│   │   ├── core/ctx.ts        Ctx wrapper (extends gramstax Ctx)
│   │   ├── blocks/g-keyboard.ts Keyboard block template
│   │   ├── helpers/log.ts     Logger re-export
│   │   ├── guards/user.ts     User guard template
│   │   ├── db/index.ts        LmdbEnv subclass (only when LMDB enabled)
│   │   ├── db/schema/user.ts
│   │   ├── db/repositories/user.ts
│   │   ├── workers/job.ts     Worker (mtdStart/mtdStop/mtdPing + onBeforeExit) + JobWorker export (only when workers enabled)
│   │   ├── pages/*            9 page templates (nested start/random)
│   │   └── utils/array.ts
│   ├── test/.gitkeep
│   ├── e2e/                   setup.ts + 8 test file templates (shared enUser/idUser fixtures, 4001/5001)
│   └── scripts/               check-e2e-mirror.ts + generate-e2e-structure.ts (single-project e2e tooling)
```

## How It Works

1. User runs `npx create-gramstax [project-name]` with optional flags (`--skip-install`, `--no-biome`, `--no-lmdb`, `--no-worker-thread`, `--pm`, `--runtime`, etc.). The positional is a bare name (not a path).
2. CLI reads flags, prompts for missing values via enquirer (non-TTY without full flags errors out naming what is missing).
3. Copies `templates/` to target dir, replacing generator placeholders (`projectName`, `packageName`, `installCmd`, etc.); runtime `{{userName}}`/`{{result}}`/`{{res}}` placeholders are intentionally preserved, and any other leftover `{{...}}` fails the run.
4. Post-processes:
   - Renames `.env.example` → `.env` (preserves a pre-existing `.env`)
   - Removes `src/db/` + `@gramstax/lmdb` deps + monorepo tsconfig paths when LMDB disabled (monorepo paths are always stripped — scaffolds are standalone)
   - Removes `src/workers/` + `@gramstax/worker-thread` dep when workers disabled
   - Adds `@biomejs/biome` to devDependencies when Biome enabled (installed with the rest); removes `biome.json` + `lint*`/`format*` scripts otherwise
   - For `--runtime node`: dev/start → `node`, build → `tsc --outDir dist` (kept), `test*` → `node --test`, template `noEmit` flipped off
5. Runs `installCmd` in the target directory (unless `--skip-install`).
6. Errors: `Create` only throws (never `process.exit`); `index.ts` maps to exit codes (0 ok, 1 error, 2 usage, 0 + `Setup cancelled` on cancel).

## CLI Flags

| Flag                          | Type       | Default            |
| ----------------------------- | ---------- | ------------------ |
| `project-name`                | positional | interactive prompt |
| `--pm <name>`                 | string     | detect (lockfile/user-agent) → `bun` |
| `--runtime <name>`            | string     | detect → `bun`     |
| `--lmdb` / `--no-lmdb`        | boolean    | LMDB included      |
| `--worker-thread` / `--no-worker-thread` | boolean | Workers included |
| `--biome` / `--no-biome`      | boolean    | Biome included     |
| `--skip-install`              | boolean    | install runs       |

Case-insensitive `--pm`/`--runtime` (normalized before validation). Boolean flags are single-side definitions with default `true` (negation is commander-automatic).
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
- Template `biome.json` mirrors the root config with environment conditioning: `root: true` (standalone projects — `root: false` would silently disable the config when no parent config exists), project-specific excludes (`dist`, `database`, `experiments`, `logs`, `data`), and a test/e2e override for `noExplicitAny`.
- The root `biome.json` excludes `packages/create-gramstax/src/templates` (a nested `root: true` config conflicts with the monorepo root). Lint/format templates with their own config: `bunx biome lint packages/create-gramstax/src/templates` works from inside the templates dir, or `bunx biome lint --config-path=packages/create-gramstax/src/templates/biome.json <path>`.
- The generated project is Biome-only.
