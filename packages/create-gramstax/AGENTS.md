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
│   │   ├── db/db.ts           LmdbEnv subclass (only when LMDB enabled)
│   │   ├── db/repositories/user.ts
│   │   ├── pages/*.ts         7 page templates (start, help, etc.)
│   │   └── utils/array.ts
│   ├── test/.gitkeep
│   └── e2e/                   setup.ts + 7 test file templates
```

## How It Works

1. User runs `npx create-gramstax [project-dir]` with optional flags (`--no-biome`, `--no-lmdb`, `--no-worker-thread`, `--pm`, `--runtime`, etc.).
2. CLI reads flags, prompts for missing values via enquirer.
3. Copies `templates/` to target dir, replacing `{{placeholders}}` (`projectName`, `installCmd`, etc.).
4. Post-processes:
   - Renames `.env.example` → `.env`
   - Removes `bunfig.toml` for npm/pnpm/yarn targets
   - Removes `src/db/` when LMDB disabled
   - Removes `src/workers/` when worker threads disabled
   - Installs `@biomejs/biome` as devDependency when Biome enabled; removes `biome.json` otherwise
5. Runs `installCmd` in the target directory.

## CLI Flags

| Flag                          | Type       | Default            |
| ----------------------------- | ---------- | ------------------ |
| `project-directory`           | positional | interactive prompt |
| `--pm <name>`                 | string     | auto-detect        |
| `--runtime <name>`            | string     | auto-detect        |
| `--biome` / `--no-biome`      | boolean    | Biome included     |
| `--lmdb` / `--no-lmdb`        | boolean    | LMDB included      |
| `--worker-thread` / `--no-worker-thread` | boolean | Workers included |

## Template Variables

Placeholders replaced recursively in all copied files:

- `{{projectName}}`
- `{{installCmd}}`, `{{runDevCmd}}`, `{{runStartCmd}}`
- Package metadata from `templates/package.json`

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
