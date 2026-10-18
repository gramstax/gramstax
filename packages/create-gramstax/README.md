<div align="center">
  <p><img src="https://avatars.githubusercontent.com/u/187108398?s=200&v=4" alt="create-gramstax logo" width="120" height="120" /></p>
  <h1>create-gramstax</h1>

  <p>Scaffolds a <a href="https://github.com/gramstax/gramstax">Gramstax</a> Telegram bot: config, page base classes, an e2e harness, and the linting setup already wired.</p>
  <p>
    <img alt="Bun" src="https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white"/>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=typescript&logoColor=white"/>
    <img alt="Telegram" src="https://img.shields.io/badge/Telegram-26A5E4.svg?style=flat&logo=telegram&logoColor=white"/>
    <img alt="npm" src="https://img.shields.io/badge/npm-5.0.0-CB3837.svg?style=flat&logo=npm&logoColor=white"/>
    <img alt="License" src="https://img.shields.io/badge/License-Proprietary-lightgrey.svg"/>
  </p>
</div>

---

`create-gramstax` writes a project that already passes its own test suite. The point of the scaffold is not a hello-world — it is that **every page you add has a matching e2e test enforced by a check**, so the testing structure never drifts from the routing structure.

## Usage

```bash
bunx create-gramstax@latest my-bot
```

| Flag | Values | Effect |
| --- | --- | --- |
| `--pm <name>` | `bun`, `npm`, `pnpm`, `yarn` | Package manager to install with; auto-detected when omitted |
| `--runtime <name>` | `bun`, `node` | Target runtime; defaults to `bun` |
| `--lmdb` | on by default | Wire in `@gramstax/lmdb` — schemas, repositories, the `src/db/` tree |
| `--worker-thread` | on by default | Wire in `@gramstax/worker-thread` and a `src/workers/job.ts` scaffold |
| `--biome` | on by default | Ship a `biome.json` for linting and formatting |
| `--skip-install` | off | Generate the files without running the package manager |

`[project-directory]` is the only positional argument. Anything not supplied on the command line is **asked interactively** — package manager, runtime, and each of LMDB, worker threads and Biome are confirm prompts defaulting to yes. Ctrl-C exits cleanly with `Setup cancelled`. Passing any flag above skips the prompt it covers.

**These three flags are single-sided by design.** There is no `--no-lmdb`: a flag can only turn a feature *on*, so omitting LMDB or worker threads is done by declining the prompt. That is a deliberate contract, enforced in `packages/create-gramstax/test/cli-contract.test.ts` — a `--no-` spelling would fail the suite.

```bash
# answers at the prompt, install skipped
bunx create-gramstax@latest my-bot --skip-install
```

```bash
# fully non-interactive: every choice stated up front
bunx create-gramstax@latest my-bot --pm bun --runtime bun --skip-install
```

## What you get

```
my-bot/
├── gramstax.config.ts        # the single composition point — token, deploy, caches
├── biome.json                # when Biome is enabled
├── tsconfig.json
├── package.json
├── e2e/                      # mirrors src/pages/ exactly, plus setup.ts
├── scripts/
│   ├── generate-e2e-structure.ts
│   └── check-e2e-mirror.ts
└── src/
    ├── base/
    │   ├── page.ts           # PageBase — the class every page extends
    │   ├── page-admin.ts
    │   └── guard.ts
    ├── blocks/g-keyboard.ts
    ├── core/
    │   ├── bot.ts            # the Gramstax subclass the CLI discovers
    │   ├── ctx.ts
    │   └── services.ts
    ├── db/                   # when LMDB is enabled
    │   ├── index.ts
    │   ├── schema/user.ts
    │   └── repositories/user.ts
    ├── guards/user.ts
    ├── helpers/log.ts
    ├── pages/                # start, help, status, blank, sum-number, …
    ├── workers/job.ts        # when worker threads are enabled
    └── utils/
```

Sample pages ship on purpose: `sum-number` for arithmetic, `username-notfound` for a failure path, `start/random` for a nested route.

## The e2e mirror

The scaffold includes two scripts that keep tests and pages in step:

- `generate-e2e-structure.ts` creates the missing `e2e/` file for a page you just added.
- `check-e2e-mirror.ts` fails when `e2e/` and `src/pages/` have diverged. It is generated but not attached to an npm script, so wire it into CI yourself — that is what turns "add a test for the page you added" into a build failure instead of a review comment.

`e2e/setup.ts` is the one place that constructs the bot directly, because e2e is the only context that needs `deploy: 'test'`.

## After scaffolding

```bash
bun run typecheck   # tsc --noEmit
bun run test:e2e    # the generated e2e suite
bun run test:all    # unit + e2e
bun run dev         # gramstax start --watch
```

Set `BOT_TOKEN` first — `gramstax.config.ts` reads it from the environment.

## License

Proprietary. All rights reserved.