<div align="center">
  <p><img src="https://avatars.githubusercontent.com/u/187108398?s=200&v=4" alt="create-gramstax logo" width="120" height="120" /></p>
  <h1>create-gramstax</h1>

  <p>Scaffolds a <a href="https://github.com/gramstax/gramstax">Gramstax</a> Telegram bot that passes its own test suite before you write a line: config, pages, an e2e harness, and the linting setup already wired.</p>
  <p>
    <a href="https://github.com/gramstax/gramstax/actions/workflows/release.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/gramstax/gramstax/release.yml?branch=main&label=build&style=flat&logo=githubactions&logoColor=white"/></a>
    <img alt="Bun" src="https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white"/>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=typescript&logoColor=white"/>
    <img alt="Telegram" src="https://img.shields.io/badge/Telegram-26A5E4.svg?style=flat&logo=telegram&logoColor=white"/>
    <img alt="npm" src="https://img.shields.io/npm/v/create-gramstax?style=flat&logo=npm&logoColor=white&color=CB3837"/>
    <img alt="License" src="https://img.shields.io/badge/License-Apache--2.0-blue.svg"/>
  </p>
</div>

`create-gramstax` is the scaffolding CLI for the Gramstax framework. It copies a template tree, substitutes five generator placeholders, prunes whatever the selected feature set does not include, regenerates the one file that has to know which features survived, and runs a single install.

## 💡 Why this package

Most scaffolders hand you a hello-world and an empty `tests/` folder, and then "add a test for the page you just added" is a thing you have to remember. This one is opinionated about that.

**No test suite to bootstrap.** The generated project ships nine pages and nine e2e test files that cover them, wired into `bun run test:e2e`. You can clone a scaffold, set a token, and watch it pass before you have edited anything.

**No "did I remember?" step.** `scripts/check-e2e-mirror.ts` compares the two trees in *both* directions (a page with no test is a `MISSING`, a test with no page is an `ORPHAN`), and exits non-zero. That turns a convention into a build failure, which is the only version of the convention that survives contact with a deadline. It is wired into `test:e2e:check`, and the generated `test:all` runs that before the suite.

**No hand-written `new Gramstax({...})`.** Generated projects have no `src/index.ts`. `gramstax.config.ts` is the single composition point (token, deploy mode, session cache, log override), and `gramstax start` discovers the `Gramstax` subclass at `src/core/bot.ts`, materialises each ref slot, and constructs it. Construction *is* boot.

**No "wire the storage in later" chore.** With LMDB kept, `src/db/` arrives with `Db extends LmdbEnv`, a real `UserSchema`, a `UserRepository` that demonstrates `putIfNotExists` and a transaction for read-then-write, and a restart-safe `nightly-report` schedule already started by `ServicesCore.start()`. With worker threads kept, `src/workers/job.ts` arrives with a `WorkerThreadInit` subclass exposing `mtdPing`/`mtdSummarize` and `launchWorker()`/`shutdown()` already called. Either can be dropped without touching the other.

**No monorepo leakage.** The shipped `tsconfig.json` maps `gramstax`, `@gramstax/lmdb` and `@gramstax/worker-thread` at `../../../`: which would give a standalone scaffold two copies of the framework and break `gramstax start`'s `instanceof Gramstax` discovery. The generator strips every one of those mappings and keeps only `~/*`.

**No `workspace:*` in a standalone project.** Template dependencies ship as `workspace:*` because they live inside this monorepo. `resolveWorkspaceDeps` rewrites each one to `^<create-gramstax version>` before the install runs, so `bun install` resolves them from npm like any other dependency.

## ✨ Features

### A working bot, not a skeleton

- 🚀 **Nine pages on first run**: `start`, `start/random`, `start/random/number`, `start/random/text`, `help`, `sum-number`, `status`, `username-notfound` and `blank`. Each is a class extending `PageBase`, with an inline keyboard, English and Indonesian `<g-message lang="id">` variants, and a `g*` step machine.
- ✅ **Nine e2e tests on first run**: one per page, mirroring the tree, asserting the actual outgoing Telegram calls (`body?.text`, `rich_message.html`, button labels) rather than snapshotting the page.
- 🪞 **A failure path that is not a stub**: `username-notfound` blocks a user with no `username`, so `UserGuard` has something real to do and its test uses its own fixture id (`77777`).
- 🧭 **Nested routing, proven**: `start/random/*` is a three-level route; its tests drive `/start → callback → callback` the way a user would.
- 🧮 **A session state machine**: `sum-number` is a two-step free-text flow (`left` → `right` → `success`) driven by `setSessionFreeText`/`clearSession`, including the re-prompt on non-numeric input.

### Two seams every page inherits

- 🧩 **`PageBase`, `GuardBase`, `PageAdminBase`**: the three base classes under `src/base/`. `PageAdminBase.hookBeforeRoute()` is a documented admin gate you extend instead of writing from scratch.
- ⌨️ **`KeyboardGBlock`**: `kbk`/`kbl` give every page a bilingual keyboard builder (`home`, `back`, `cancel`, `backHome`) without repeating markup or re-typing the `id` labels.
- 🧱 **`StatusPage`**: a two-base page (`e` / `nf`) already wired to `BotCore.hookErrorPage` and `hookNotFoundPage`, so an unhandled throw has somewhere to go.

### Optional services that are actually wired

- 💾 **LMDB, kept by default**: `Db extends LmdbEnv` with `MAX_DBS = 32`, compression on, msgpack encoding, and an `onWarn` sink wired to `LogHe` so LMDB diagnostics land in your logger instead of nowhere.
- 🧵 **Worker threads, kept by default**: `Worker extends WorkerThreadInit`; `JobWorker` is simultaneously the typed RPC surface (`JobWorker.mtdPing()`) and the lifecycle handle (`launchWorker()` / `shutdown(ms)`).
- 🔌 **A regenerated service seam**: `src/core/services.ts` is rebuilt by `buildServicesSource(useLmdb, useWorkerThread)` for whichever features survived, so `BotCore`'s unconditional `ServicesCore.start()`/`stop()` can never statically import a pruned directory.
- 🧹 **Stop ordering that is not obvious**: workers are stopped before the database, because a tick can still be mid-read and tearing the store down underneath it turns an orderly stop into an LMDB error.

### Linting, config and install, done

- 🎨 **Biome wired, in one install pass**: a standalone `biome.json` (`root: true`) mirroring the repo's rules, plus `@biomejs/biome@^2.5.5` added to `devDependencies` *before* the installer runs.
- 🔑 **`.env` created for you**: `.env.example` is renamed to `.env` at generation; if you already had one, the example is deleted instead and yours is left alone.
- 🗂️ **`.gitignore` promoted, not lost**: the template ships as `gitignore` (npm never publishes a `.gitignore`), and is renamed on the way out, or merged into an existing one without dropping a single shipped rule.
- 🧾 **Placeholder discipline**: `assertNoLeftoverPlaceholders` walks the finished tree and fails the run naming the offending file, so a missed substitution is an error rather than a `{{something}}` in your source.

### Two ways to run it

- 🤝 **Interactive or fully non-interactive**: the same binary asks, or refuses to guess and tells you exactly what is missing.
- 🪞 **The mirror, both directions**: generation and checking are separate scripts so "create the test I forgot" and "fail the build because I forgot" are different verbs.

## 🚀 Quick Start

### 1. Prerequisites

- **Bun**: required for the generated project. Its `dev`, `start`, `test`, and `test:e2e` scripts run on Bun, and the `gramstax` CLI has a Bun shebang. The scaffolder itself is packaging-only and does not change the generated project's Bun runtime.
- **A package manager** to install with: `bun`, `npm`, `pnpm` or `yarn`. The generated project still runs on Bun.
- **A bot token** from [@BotFather](https://t.me/BotFather): needed to actually run the bot, not to scaffold it.

### 2. Run it

```bash
bunx create-gramstax@latest my-bot
```

Use `bunx` to launch the scaffolder. `my-bot` is a bare name, not a path: it must match `/^[a-z0-9-_]{1,100}$/i`.

### 3. What happens

The CLI prints its ASCII banner with the resolved version, resolves a base directory (`INIT_CWD` when set, which is what makes `bunx` land where you expect, otherwise `process.cwd()`), echoes a summary of the resolved configuration, then runs the generation steps and one install:

```text
[INFO] Project: my-bot
[INFO] Location: /path/to/my-bot
[INFO] Package Manager: bun
[INFO] LMDB Storage: Yes
[INFO] Worker Thread: Yes
[INFO] Biome: Yes
```

It creates no git repository, commits nothing, and pushes nothing.

### 4. First run

```bash
cd my-bot
# edit .env: set BOT_TOKEN
bun run dev
```

The generated `.env` already exists (renamed from `.env.example`) with `BOT_TOKEN`, `BOT_DEPLOY`, `CACHE_SESSION_STORE`, `CACHE_SESSION_TTL` and `CACHE_SESSION_NAMESPACE`, plus `DB_PATH="./data"` when LMDB is kept.

## 📖 Usage

### Options

The complete commander program, from [`src/index.ts`](./src/index.ts):

```ts
program
  .name(`create-gramstax`)
  .description(`CLI to create a new Gramstax Telegram bot project`)
  .version(packageVersion)
  .argument(`[project-directory]`, `Directory to create the project in`)
  .addOption(new Option(`--pm <name>`, `Package manager (bun, npm, pnpm, yarn)`).choices([`bun`, `npm`, `pnpm`, `yarn`]).argParser((value: string) => value.trim().toLowerCase()))
  .addOption(new Option(`--lmdb`, `Include @gramstax/lmdb (prompted when neither flag is given)`))
  .addOption(new Option(`--no-lmdb`, `Skip @gramstax/lmdb`))
  .addOption(new Option(`--worker-thread`, `Include @gramstax/worker-thread (prompted when neither flag is given)`))
  .addOption(new Option(`--no-worker-thread`, `Skip @gramstax/worker-thread`))
  .addOption(new Option(`--biome`, `Include Biome for linting & formatting (prompted when neither flag is given)`))
  .addOption(new Option(`--no-biome`, `Skip Biome for linting & formatting`))
  .option(`--skip-install`, `Skip dependency installation`)
  .exitOverride()
```

| Option                  | Values                | Default                  | Effect                                                                     |
| :---------------------- | :-------------------- | :----------------------- | :------------------------------------------------------------------------- |
| `[project-directory]`   | a project name        | prompted                | Bare name, not a path; validated against `/^[a-z0-9-_]{1,100}$/i`           |
| `--pm <name>`           | `bun` `npm` `pnpm` `yarn` | detected, else `bun`  | Package manager used to install; also drives the README's printed commands |
| `--lmdb`                | _none_                | `true`                  | Keep `@gramstax/lmdb`, `src/db/`, `DB_PATH` and the `data/` ignore rule   |
| `--worker-thread`       | _none_                | `true`                  | Keep `@gramstax/worker-thread` and `src/workers/`                          |
| `--biome`               | _none_                | `true`                  | Keep `biome.json`, add `@biomejs/biome`, keep the `lint*`/`format*` scripts |
| `--skip-install`        | _none_                | install runs            | Generate the files without running the package manager                     |
| `-h, --help`            | _none_                | _none_                  | Commander's help text                                                      |
| `-V, --version`         | _none_                | package version         | Falls back to `0.0.0` if `package.json` cannot be read or parsed            |

`--pm` is **case-insensitive and trimmed**: `--pm NPM` and `--pm "  pnpm  "` both work, because `.argParser` lowercases and trims before the action handler re-normalises. An unrecognised value fails in `validateCliOptions` with the value echoed back and the legal list: `Unsupported package manager "bogus". Supported: bun, npm, pnpm, yarn`.

### The prompts, in order

Two prompts live in [`src/create.ts`](./src/create.ts). Ctrl-C (or any enquirer rejection) becomes a `SetupCancelledError`, never a crash.

| # | Prompt                                                                                            | Type    | Initial       | Shown when                                    |
| :-- | :------------------------------------------------------------------------------------------------- | :------ | :------------ | :-------------------------------------------- |
| 1 | `What is your project named?`                                                                      | input   | empty         | no positional **and** stdin is a TTY         |
| 2 | `Which package manager would you like to use?`: `Bun (recommended)` / `npm` / `pnpm` / `Yarn`      | select  | `bun`         | not already supplied                         |
| 3 | `Would you like to include @gramstax/lmdb for persistent storage? (recommended)`                    | confirm | `true`        | not already supplied                         |
| 4 | `Would you like to include @gramstax/worker-thread for background jobs? (recommended)`              | confirm | `true`        | not already supplied                         |
| 5 | `Would you like to use Biome for linting & formatting? (recommended)`                               | confirm | `true`        | not already supplied                         |

Prompts 2–5 are submitted as a single enquirer array, so they appear in exactly that order. Answering prompt 1 with an empty string scaffolds **into the current directory** instead: the name is slugified from the directory basename via `sanitizeProjectName`, and the directory must be effectively empty (`.git`, `.gitignore`, `.gitkeep`, `.DS_Store` and `Thumbs.db` do not count as content).

### Turning a feature on and off

The three feature flags are **two-sided**: `--lmdb` / `--no-lmdb`, `--worker-thread` / `--no-worker-thread`, `--biome` / `--no-biome`. Each pair is enforced by [`test/cli-contract.test.ts`](./test/cli-contract.test.ts), which asserts both spellings are present in `src/index.ts`.

They also carry **no default**, and that is the second half of the contract. A `true` default would make `opts.lmdb` always defined, and `cli?.lmdb ?? prompted.lmdb` would then always resolve to the flag: the prompt would ask a question whose answer could not reach the outcome. Undefined means "not stated on the command line", which is the signal to ask.

So there are three ways to set a feature, and they compose:

| You pass | Result |
| :-------- | :----- |
| nothing | the prompt asks, and the answer decides |
| `--lmdb` | LMDB is in, no question asked |
| `--no-lmdb` | LMDB is out, no question asked |

```bash
# fully non-interactive: every choice stated, nothing installed
bunx create-gramstax@latest my-bot --pm bun --no-lmdb --no-worker-thread --no-biome --skip-install
```

A flag that is neither given nor negated is reported by name in a non-TTY rather than guessed:

```
Missing required CLI options: lmdb, workerThread, biome. Provide lmdb, workerThread, biome flags or run interactively.
```

### `--skip-install`

`--skip-install` sets `config.skipInstall`, which the install step tests before doing anything. When it is set the output reads `Skipping dependencies installation..`, the package manager is never spawned, and the "Next steps" line omits the install command it would otherwise tell you to run, which it used to print even when it had already installed.

### Non-interactive usage

In a non-TTY (CI, a pipe, `npm init`-style scripting) nothing is guessed and nothing hangs:

```bash
# every choice stated up front, nothing installed
bunx create-gramstax@latest my-bot --skip-install --no-lmdb --no-worker-thread --no-biome
```

- No positional **and** no TTY → `Missing project name` (prefixed with `Project name is required when using CLI flags` when a flag was seen). Exit 2.
- A feature flag missing **and** no TTY → `Missing required CLI options: lmdb, workerThread, biome. Provide lmdb, workerThread, biome flags or run interactively.` Exit 2.

`--pm` is the one value that does not need stating: `detectPackageManager` resolves it from the explicit flag, else `npm_config_user_agent` (`pnpm` is matched before `npm`, because the yarn/pnpm agent strings contain `npm`), else a lockfile in the base directory (`bun.lockb`, `bun.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), else `bun`.

### Project naming and destination

- A name must match `PROJECT_NAME_PATTERN`: letters, numbers, hyphens, underscores, up to 100 characters. Anything else fails before a single file is written.
- If the target directory already exists, the run stops with `Directory "my-bot" already exists` (exit 2). The CLI never merges into a populated directory.
- With no positional and an empty answer, `FsUt.isDirectoryEffectivelyEmpty` inspects the top level plus one level of nesting, so a directory holding only `logs/.gitkeep` still counts as empty.

### Runtime

Generated projects are Bun-only. Every app, test, and build script runs through
Bun, and the emitted `package.json` has no runtime switch. Bun must be installed
for `gramstax start` / `gramstax build` and for the generated test scripts.

### Exit behaviour

`Create` only ever throws: it contains no `process.exit`, which the contract test asserts. [`src/index.ts`](./src/index.ts) is the single place that maps an outcome to an exit code, via `process.exitCode`:

| Situation                                                                                | Code | Output                                              |
| :----------------------------------------------------------------------------------------- | :--- | :--------------------------------------------------- |
| Project created                                                                           | `0`  | `Project created successfully!` and the next steps   |
| Ctrl-C at a prompt (`SetupCancelledError`)                                                 | `0`  | `Setup cancelled`                                    |
| Message contains `Unsupported`, `Missing`, `required`, `Invalid`, `already exists`, `not empty` | `2`  | the message verbatim via `log.error`                 |
| Anything else: including `Dependencies installation failed` and an unreplaced placeholder    | `1`  | `Failed to create project: <message>`                |
| `--help`, `--version`, unknown option, `--pm` outside the choices                          | `2`  | commander's own text, re-emitted through `log.error` |

A cancellation is a deliberate no-op, not a failure: exit `0` with `Setup cancelled`, so a Ctrl-C in an interactive shell does not look like a crash to a wrapper script.

One wart worth knowing, since it will show up the first time you pipe the CLI: `--help` and `--version` also exit `2`. `.exitOverride()` stops commander from exiting itself, and the catch in `isMainModule` only treats a message containing `helpDisplayed` or `version` as success: commander's actual messages are `(outputHelp)` and the bare version string, so both fall through to `log.error` with code `2`. Verified from source and from `dist/`.

## 🔍 How it works

Two methods on `Create`, called from `createProject()`: [`gatherProjectConfig()`](./src/create.ts) decides everything, then [`executeProjectGeneration()`](./src/create.ts) writes it.

### Gathering

1. `printBanner()` writes the ASCII banner plus `v<version>`, where the version comes from walking up to ten directories for a `package.json` and falling back to `0.0.0` on any failure.
2. `FsUt.resolveInitialWorkingDirectory()` prefers `INIT_CWD` over `process.cwd()`.
3. The positional name is validated against `PROJECT_NAME_PATTERN` before anything else happens.
4. `hasAnyCliFlag()` inspects `packageManager`, `lmdb`, `workerThread` and `biome`. `skipInstall` alone does not count, so `--skip-install` on its own still leaves the config prompts reachable.
5. `validateCliOptions` runs, then `missing` is computed as the fields that are still `undefined`. Non-empty `missing` in a TTY triggers `promptForConfiguration()` and the merge `cli.X ?? prompted.X`; non-empty `missing` without a TTY throws.
6. Destination checks: `Directory "x" already exists`, or `Current directory is not empty` for the in-place case.
7. The six-line summary is printed: deliberately after validation, so you never see a cheerful summary for a run that is about to fail.

### Generating

| Step | Action | Where |
| :--- | :----- | :---- |
| 1 | `mkdir -p` the project path | _not applicable_      |
| 2 | `copyDirectorySync(join(__dirname, "templates"), projectPath, variables)` | [`create.ts`](./src/create.ts) |
| 3 | `logs/` + `logs/.gitkeep` created | `executeProjectGeneration` |
| 4 | `.env.example` → `.env`, or deleted if a `.env` already exists | `executeProjectGeneration` |
| 4b | `gitignore` → `.gitignore`, or merged into an existing one | [`FsUt.normalizeGitignoreFile`](./src/utils/fs.ts) |
| 5 | `workspace:*` → `^<version>` in every dep section | `resolveWorkspaceDeps` |
| 6 | LMDB keep-or-prune | `executeProjectGeneration` |
| 7 | worker-thread keep-or-prune | `executeProjectGeneration` |
| _conditional_| `src/core/services.ts` regenerated for the surviving feature set | `buildServicesSource` |
| 8 | Biome keep-or-prune (runs before the install) | `stripBiomeScripts`, `removeDependency` |
| 9 | the single install | [`installDependencies`](./src/create.ts) |

**Copying.** `copyDirectorySync` recurses, warns-and-skips symlinks, byte-copies anything that is not valid UTF-8 (a NUL byte or a fatal decode failure marks a file binary), preserves the source mode with `chmodSync`, and substitutes placeholders only in text files. Substitution goes through `replaceTemplateVariables`, which uses a replacer *function* so a `$&` or `$1` in a value is never reinterpreted as a replacement pattern.

**Placeholders.** Exactly five are substituted: `{{projectName}}`, `{{packageName}}` (the lowercased name, so `package.json` stays npm-valid), `{{installCmd}}`, `{{runDevCmd}}` and `{{runStartCmd}}`. Three runtime placeholders are deliberately preserved because they belong to the generated bot's own template engine, not to the generator: `{{userName}}`, `{{result}}` and `{{res}}` (`RUNTIME_PLACEHOLDERS`). Anything else left in the tree fails the run with `Unreplaced template placeholder {{x}} in file <path>`.

**Filtering the tree.** LMDB off removes `src/db/` recursively and drops `@gramstax/lmdb` from all four dependency sections; worker threads off removes `src/workers/` and drops `@gramstax/worker-thread`; Biome off deletes `biome.json`, deletes every script whose name starts with `lint` or `format`, and drops `@biomejs/biome`. The two keep-branches add their own wiring instead: LMDB on appends `DB_PATH="./data"` to `.env` (never twice) and `data/` to `.gitignore`; Biome on adds `@biomejs/biome@^2.5.5` to `devDependencies`. Because `src/core/services.ts` is the only file that has to know the feature set, it is rewritten last, after the pruning.

**The service seam.** `buildServicesSource(useLmdb, useWorkerThread)` emits imports, `start()` bodies and `stop()` bodies to match. With neither feature it emits a no-op class that names neither pruned package, so nothing in the generated project can mention a directory that was deleted. The shipped template file is byte-identical to the both-on variant: asserted by [`test/generation.test.ts`](./test/generation.test.ts), so the template you read in this repo is the same code path a scaffold receives.

**Installing.** `installDependencies` spawns `FsUt.resolvePackageManagerCommand(packageManager)` with `["install"]`, `cwd` set to the project, `stdio: "inherit"` so you watch it, and `shell: FsUt.resolveSpawnShell(packageManager)`: `true` for npm/pnpm/yarn on Windows, where `.cmd` shims need a shell (`EINVAL`), and `false` for Bun, which is a real executable. It resolves `true` only on exit code `0`; anything else throws `Dependencies installation failed` rather than reporting success.

## 🗂️ What gets generated

The complete [`src/templates/`](./src/templates) tree, as shipped:

```text
src/templates/
├── .env.example                  # becomes .env; DB_PATH appended when LMDB is kept
├── AGENTS.md                     # the generated project's agent instructions
├── LICENSE                       # MIT notice, matching the template package.json and README badge
├── README.md                     # the generated project's own docs
├── biome.json                    # removed unless Biome is enabled
├── gitignore                     # promoted to .gitignore, or merged into an existing one
├── gramstax.config.ts            # the composition point: there is no src/index.ts
├── package.json                  # scripts + workspace:* deps resolved to ^<version>
├── tsconfig.json                 # ~/* kept; gramstax + @gramstax/* mappings stripped
├── e2e/                          # mirrors src/pages/ exactly
│   ├── setup.ts                  # the ONLY place BotCore is constructed directly
│   ├── COVERAGE.md               # handler/test ledger checked by check-e2e-handlers.ts
│   ├── blank.test.ts             # page registered? + callback answer
│   ├── help.test.ts              # callback + /help, en + id       (message + keyboard)
│   ├── status.test.ts            # unknown callback -> not-found page
│   ├── sum-number.test.ts        # callback, /sum-number, the two-step session flow
│   ├── username-notfound.test.ts # a user with no username is blocked
│   └── start/
│       ├── index.test.ts         # /start + callback, and e2e.calls capture
│       └── random/
│           ├── index.test.ts     # hub navigation + /start/random, editMessageText asserted
│           ├── number.test.ts    # nested leaf, 3 levels deep
│           └── text.test.ts      # nested leaf, language-dependent output
├── scripts/
│   ├── check-e2e-mirror.ts       # bidirectional drift check (test:e2e:check)
│   ├── check-e2e-handlers.ts     # handler + test ledger audit (test:e2e:check)
│   └── generate-e2e-structure.ts # creates the e2e files you did not
├── src/
│   ├── base/
│   │   ├── guard.ts              # GuardBase: moves ctx.data into temp for guards
│   │   ├── page.ts               # PageBase: kbk/kbl keyboard seam
│   │   └── page-admin.ts         # PageAdminBase: the documented admin gate
│   ├── blocks/
│   │   └── g-keyboard.ts         # bilingual home/back/cancel/backHome builders
│   ├── core/
│   │   ├── bot.ts                # BotCore extends Gramstax: the discovered subclass
│   │   ├── ctx.ts                # CtxCore extends Ctx: one line, your seam
│   │   └── services.ts           # REGENERATED per feature set by buildServicesSource
│   ├── db/                       # removed unless LMDB is kept
│   │   ├── index.ts              # Db extends LmdbEnv + open/get/start/stop + nightly job
│   │   ├── repositories/
│   │   │   └── user.ts           # putIfNotExists, a transaction, sync reads
│   │   └── schema/
│   │       └── user.ts           # UserSchema + IKUser/IVUser
│   ├── guards/
│   │   └── user.ts               # UserGuard: rejects a user with no username
│   ├── helpers/
│   │   ├── .gitkeep
│   │   └── log.ts                # LogHe: the only logging path in the scaffold
│   ├── pages/                    # the routing tree; e2e/ mirrors it 1:1
│   │   ├── blank.ts              # empty template, the minimal page shape
│   │   ├── help.ts               # command + callback entry
│   │   ├── status.ts             # error + not-found bases
│   │   ├── sum-number.ts         # two-step session state machine
│   │   ├── username-notfound.ts  # the failure page
│   │   └── start/
│   │       ├── index.ts          # /start hub
│   │       └── random/
│   │           ├── index.ts      # second level
│   │           ├── number.ts     # third level
│   │           └── text.ts       # third level, language-dependent
│   ├── utils/
│   │   └── .gitkeep              # deliberately empty: your generic helpers go here
│   └── workers/                  # removed unless worker threads are kept
│       └── job.ts                # Worker extends WorkerThreadInit + JobWorker export
└── test/
    └── .gitkeep                  # unit-test slot; `bun run test` targets this
```

Two entries are created at generation time rather than shipped: `logs/.gitkeep` (so the log directory survives `git`) and, with LMDB kept, `data/` on first open (already covered by the `.gitignore` entry the generator appends).

## 📖 The generated project

### Scripts

Straight from [`src/templates/package.json`](./src/templates/package.json):

| Script           | Command                        | What it does                                                     |
| :--------------- | :----------------------------- | :--------------------------------------------------------------- |
| `dev`            | `gramstax start --watch`       | Boots the bot and watches for changes: your dev loop         |
| `start`          | `gramstax start`               | Production boot from the same config                             |
| `build:gramstax` | `gramstax build`               | Freezes `src/pages` into `.gramstax/` (`routes.json`, `manifest.js`, AOT `gen/`, `server/`) |
| `typecheck`      | `tsc --noEmit`                 | Type-check only                                                   |
| `lint`           | `biome lint`                   | Biome lint (removed with Biome)                                   |
| `lint:fix`       | `biome lint --write --unsafe`  | Lint with autofix (removed with Biome)                           |
| `format`         | `biome format --write .`       | Format (removed with Biome)                                       |
| `test`           | `bun test test/`               | Unit tests: the slot that ships empty                           |
| `test:e2e`       | `bun test e2e/`                | The generated e2e suite, one file per page                        |
| `test:e2e:check` | `bun run scripts/check-e2e-mirror.ts && bun run scripts/check-e2e-handlers.ts` | Mirror + coverage ledger gate |
| `test:all`       | `bun run test:e2e:check && bun test test/ e2e/` | Checks, then unit + e2e tests |

Bun is required for the boot scripts: the published `gramstax` binary has a Bun shebang, so no `bun --bun` prefix is needed, and Bun resolves the TypeScript paths and the `~` alias. The CLI also loads project-root `.env*` files automatically. Dependencies come out as `gramstax`, `@gramstax/lmdb` and `@gramstax/worker-thread` at `^<create-gramstax version>`, `typescript` as a peer, `@types/bun` as a dev dependency, plus `@biomejs/biome` when Biome is kept.

### `e2e/setup.ts` is the one boot that is different

Every other entrypoint goes through `gramstax start` and `gramstax.config.ts`. E2E constructs the bot directly, because it is the only context that needs values the config cannot express:

```ts
export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  autoRetry: true,
  templateManager: new TemplateManager({
    path: [join(import.meta.dir, `../src/pages`)]
  })
})
export const e2e = bot.e2e!
export const enUser = {user: {id: 4001, username: `testuser`, language_code: `en`}}
export const idUser = {user: {id: 5001, username: `pengguna`, language_code: `id`}}
```

- **`deploy: "test"`** replaces `gramstax.config.ts`: no network, no listener, no token lookup.
- **`token: "test"`** and **`log: false`** keep the run hermetic and quiet.
- **`autoRetry: true`** keeps the production retry plugin mounted; retries never reach the capture layer.
- **An explicit `TemplateManager`** pointed at `../src/pages`, because nothing else has pointed it there yet.
- **Shared fixtures** `enUser` / `idUser`, ids `4001` and `5001`, matching the `example/` workspaces. `username` is present because the template user guard requires it; `chat` is omitted since sessions key off the user id.

Streaming needs no flag: `Gramstax` mounts `@grammyjs/stream` unconditionally, so `replyWithStream` and the draft API methods are available in every mode.

Every e2e file imports `{bot}` or `{e2e, enUser, idUser}` from `./setup` (or `../setup`, `../../setup` at depth) and clears calls in `beforeEach`, so files sharing a user id cannot leak pending-input sessions into each other, which is exactly why `sum-number.test.ts` deliberately recovers with valid input at the end of its re-prompt test.

### Configuration surface

`gramstax.config.ts` is a default export annotated `: GramstaxConfig`, with almost every field present and set to `undefined` so you can see the whole surface and uncomment what you need: `token` from `BOT_TOKEN`, `deploy` from `BOT_DEPLOY` (default `polling`), `cacheSession` from `CACHE_SESSION_STORE`/`_TTL`/`_NAMESPACE`, a `log.override` pointing at `./src/helpers/log.ts` → `LogHe`, `optionsPage.shortCallbackQueryData`, and a full `optionsDeploy` with one branch per mode. Webhook and serverless secrets come only from the runtime binding, never as literals.

## 🔍 The e2e mirror

Three scripts ship in `scripts/`, with the same convention:

```text
src/pages/foo.ts        →  e2e/foo.test.ts
src/pages/foo/bar.ts    →  e2e/foo/bar.test.ts
src/pages/foo/index.ts  →  e2e/foo/index.test.ts
```

### `generate-e2e-structure.ts`: create what you forgot

Walks `src/pages`, and for every page without a matching test writes a minimal one: a `describe` named from the file in PascalCase, one assertion that `bot.pages.all.<key>` is defined, and a `setup` import whose relative prefix is computed from the test's depth.

| Flag          | Effect                                                            |
| :------------ | :---------------------------------------------------------------- |
| `--path <p>`  | Target another project instead of this one                        |
| `--dry-run`   | Print the file that would be created, with the content previewed  |
| `--force`     | Overwrite existing tests instead of skipping them                 |
| `--check`     | Report missing tests, create nothing                              |

Prints a `Summary:` block (`Created` / `Skipped (already exists)` / `Errors`) and exits `1` when `Errors > 0`.

### `check-e2e-mirror.ts`: fail the build when they diverge

Runs the same walk in **both directions**:

- **Pages → e2e.** Every page must have a test; a missing one is `❌ ... MISSING` and fails the check. `--fix` generates it.
- **e2e → pages.** Every test must have a page (`.ts`, `.js`, or `/index.ts`, `/index.js`); a test with none is `⚠️ ... ORPHAN`. Orphans are never auto-deleted: delete it yourself, or list it in `EXTRA_TESTS`, which ships as an empty array.

A missing `src/pages` or `e2e` directory is `⏭️` and treated as OK rather than an error, so the script is safe to point at a half-built tree. Clean run prints `✅ <label>: N pages, all mirrored` then `All OK!` and exits `0`; any mismatch prints a remediation hint and exits `1`.

### `check-e2e-handlers.ts`: fail when behavior is not accounted for

The mirror proves a page is *registered*, not that any handler is tested. This script reads `e2e/COVERAGE.md` and fails when:

- a `handle*` defined under `src/pages` has no ledger row for its page;
- a handler row names no test file;
- a referenced test file does not exist;
- an `e2e/*.test.ts` file is not referenced by any row.

The ledger page cell is the route name (`src/pages/start/index.ts` → `start`), and the test cell is relative to `e2e/`. Run it alone or through the check script:

```bash
bun run scripts/check-e2e-handlers.ts
bun run scripts/check-e2e-handlers.ts --path ./other-app
bun run test:e2e:check                 # mirror + ledger for this project
```

`test:all` now runs `test:e2e:check` before the tests, so a page handler or test file that is missing from the ledger fails the generated project's normal test command.

The repository keeps its own copies at the repo root under `scripts/` for the `example/*` workspaces: the mirror script's default mode iterates every example project and its `EXTRA_TESTS` is populated (`11-cloudflare-worker`). The handler script is identical and takes `--path`; add a ledger only where the project opts into the coverage gate.

## Agent planning

The generated project is designed to be planned with the portable `gramstax-superplan` skill from the Gramstax repository. Copy `skills/gramstax-superplan/` into the generated project's `skills/` directory (or the skill directory your agent uses). The skill reads the project's own `package.json`, `gramstax.config.ts`, source, and e2e suite; it writes plans under `plans/NNN-slug/plan.md`. It can also plan a greenfield app from an empty directory by making `create-gramstax` the first phase. For full coverage, copy `gramstax-best-practices`, `lmdb-best-practices`, and `worker-thread-best-practices` alongside it; the planner routes to them.

## 🏗️ Architecture

```text
packages/create-gramstax/
├── src/
│   ├── index.ts         # shebang, commander program, exit-code mapping, pm detection
│   ├── create.ts        # Create class: prompts, copy, prune, regenerate, install
│   ├── utils/
│   │   ├── fs.ts        # FsUt: gitignore promotion, pm command resolution, empty-dir check
│   │   ├── log.ts       # LoggingPretty singleton (log.info / warn / error)
│   │   └── project.ts   # placeholders, JSONC-safe tsconfig edits, services.ts generator
│   └── templates/       # the tree above, copied verbatim then post-processed
├── test/
│   ├── cli-contract.test.ts    # the CLI contract (see below)
│   ├── create.test.ts          # banner, fs helpers, placeholders, template text
│   ├── fs-utils.test.ts        # gitignore merge, empty-dir semantics, spawn shell
│   ├── generation.test.ts      # end-to-end generation, per feature set
│   └── prompts-config.test.ts  # prompt cancel/validation/partial-rejection semantics
├── tsup.config.ts       # bundles src/index.ts; copies templates into dist/src/templates
└── package.json         # bin -> dist/src/index.js, cjs + esm, dts, minified
```

The build (`tsup`, `format: [cjs, esm]`) bundles `src/index.ts` and, in `onSuccess`, copies `src/templates` to `dist/src/templates`, pre-resolving the dist template's `workspace:*` dependencies to `^<version>` and stripping the `gramstax`/`@gramstax/lmdb` path mappings. Generation then applies the same rewrites again: belt and braces, since a scaffold must not depend on how the CLI happened to be built.

The scaffolded source is held to rules that are checked, not reviewed: [`test/generation.test.ts`](./test/generation.test.ts) fails on any `templates/src` file that exports a module-level function, calls `console.*`, or declares a `private` member without an underscore prefix. That is why every page, guard and service in the generated project is class-based, every log line goes through `LogHe`, and `Db._instance` / `Db._job` / `UserRepository._user` look the way they do.

### Guardrails worth knowing

| Rule                                                       | Why                                                                                             |
| :--------------------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `Create` never calls `process.exit`                        | Only `index.ts` maps outcomes to codes, so the generator is usable as a library and testable       |
| No `--no-lmdb` / `--no-worker-thread` / `--no-biome`       | Asserted by `cli-contract.test.ts`; a feature is turned on by a flag and off by declining          |
| No `--no-` spelling *and* no working flag to disable        | Commander defaults the three booleans to `true`, so a CLI-driven scaffold keeps all three         |
| Nothing is committed or pushed                             | The CLI never shells out to git at all; you decide when the first commit happens                   |
| A missing template placeholder fails the run               | A `{{...}}` left in generated source is a bug in the template, caught at generation time          |
| `.env` is renamed, never overwritten                       | An existing `.env` is kept and `.env.example` deleted                                              |
| `.gitignore` is renamed *or merged*, never dropped          | Scaffolding into a directory that already had one must not silently lose 30+ rules                 |
| Monorepo `paths` are always stripped                       | A `gramstax → ../../../gramstax/src` mapping gives the scaffold two copies and breaks `instanceof` |
| Monorepo path edits are JSONC-safe                         | `stripJsonComments` runs first, so the commented `tsconfig.json` template does not fail to parse   |
| `services.ts` is regenerated, never patched                | It is the only file whose contents depend on the feature set; patching would leave stale imports   |
| A failed install throws                                    | `installDependencies` resolves `false` on non-zero exit, and the run fails instead of claiming done |
| `--help` / `--version` exit `2`                            | A consequence of `.exitOverride()` plus a message-substring check; documented above, not endorsed   |

## ❤️ Donate

If this project saves you time, you can support its development:

**Donate:** [Sociabuzz](https://sociabuzz.com/damarts/donate) · [Damarts](https://damarts.vercel.app/donate)

## 📄 License

Apache-2.0: Copyright (c) 2026 Gramstax. See [LICENSE](./LICENSE).