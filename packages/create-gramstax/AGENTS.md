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
│   ├── package.json, tsconfig.json, .prettierrc, .gitignore, .env.example, LICENSE, README.md
│   ├── eslint.config.ts.template  (only copied when ESLint enabled)
│   ├── src/
│   │   ├── index.ts           Generated app entrypoint
│   │   ├── env.ts
│   │   ├── base/page.ts       PageBase template
│   │   ├── base/guard.ts      GuardBase template
│   │   ├── core/bot.ts        Bot wrapper (extends Gramstax)
│   │   ├── core/ctx.ts        Ctx wrapper (extends gramstax Ctx)
│   │   ├── blocks/keyboard.ts Keyboard block template
│   │   ├── helpers/log.ts     Logger re-export
│   │   ├── helpers/time.ts    Time utility
│   │   ├── guards/user.ts     User guard template
│   │   ├── db/db.ts           LmdbEnv subclass (only when LMDB enabled)
│   │   ├── db/repositories/user.ts
│   │   ├── pages/*.ts         7 page templates (start, help, etc.)
│   │   └── utils/array.ts
│   ├── test/.gitkeep
│   └── e2e/                   setup.ts + 7 test file templates
```

## How It Works

1. User runs `npx create-gramstax [project-dir]` with optional flags (`--no-eslint`, `--no-lmdb`, `--no-workers`, `--bun`, `--npm`, etc.).
2. CLI reads flags, prompts for missing values via enquirer.
3. Copies `templates/` to target dir, replacing `{{placeholders}}` (`projectName`, `installCmd`, etc.).
4. Post-processes:
   - Renames `.env.example` → `.env`
   - Renames `eslint.config.ts.template` → `eslint.config.ts` (only if ESLint enabled)
   - Removes `bunfig.toml` for npm/pnpm/yarn targets
   - Removes `src/db/` when LMDB disabled
   - Removes `src/workers/` when worker threads disabled
5. Runs `installCmd` in the target directory.

## CLI Flags

| Flag                          | Type       | Default            |
| ----------------------------- | ---------- | ------------------ |
| `project-directory`           | positional | interactive prompt |
| `--bun`                       | boolean    | auto-detect        |
| `--npm` / `--pnpm` / `--yarn` | boolean    | auto-detect        |
| `--no-eslint`                 | boolean    | ESLint included    |
| `--no-lmdb`                   | boolean    | LMDB included      |
| `--no-workers`                | boolean    | Workers included   |
| `--non-interactive`           | boolean    | false              |

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
- Template `.prettierrc` differs from root (includes `*.sol` formatting).
