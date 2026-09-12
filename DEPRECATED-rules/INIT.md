# Project Initialization with create-gramstax

## Interactive Mode (Default)

Run without arguments to start the guided prompt:

```bash
bun create gramstax@latest
npx create-gramstax@latest
```

The CLI will prompt for:

- **Project name** — leave empty to use current directory
- **Package manager** — bun (recommended), npm, pnpm, yarn
- **Runtime** — bun (recommended), node
- **@gramstax/lmdb** — persistent storage (recommended, default: Yes)
- **@gramstax/worker-thread** — background jobs (recommended, default: Yes)
- **biome** — code linting (default: Yes)

## Non-Interactive Mode (CLI Flags)

Pass a project name and flags to skip all prompts:

```bash
bun create gramstax@latest my-bot --pm bun --runtime bun --lmdb --no-worker-thread
npx create-gramstax@latest my-bot --pm npm --runtime node --no-lmdb
```

### Available Flags

| Flag                                     | Type    | Default | Description                                   |
| ---------------------------------------- | ------- | ------- | --------------------------------------------- |
| `--pm`                                   | string  | `bun`   | Package manager: `bun`, `npm`, `pnpm`, `yarn` |
| `--runtime`                              | string  | `bun`   | Runtime: `bun`, `node`                        |
| `--lmdb` / `--no-lmdb`                   | boolean | `true`  | Include `@gramstax/lmdb`                      |
| `--worker-thread` / `--no-worker-thread` | boolean | `true`  | Include `@gramstax/worker-thread`             |

### Hydrat dari CLI Flags

```bash
# Quick start — fully non-interactive, all defaults
create-gramstax@latest my-bot --yes

# Custom setup
create-gramstax@latest my-bot --pm pnpm --runtime node --no-lmdb --no-worker-thread
```

## Generated Project Structure

```
my-bot/
├── src/
│   ├── base/              # Base classes (PageBase, GuardBase)
│   ├── blocks/            # Keyboard block builders
│   ├── core/              # BotCore, CtxCore
│   ├── db/                # Database (if --lmdb)
│   │   ├── db.ts          # Db extends LmdbEnv
│   │   └── repositories/  # Repository classes
│   ├── guards/            # Route guards
│   ├── helpers/           # Utility helpers
│   ├── pages/             # Bot pages/screens
│   ├── utils/             # Array, time utilities
│   ├── workers/           # Worker threads (if --worker-thread)
│   └── env.ts             # Environment config
├── e2e/                   # E2E tests
├── test/                  # Unit tests
├── data/                  # LMDB data (if --lmdb)
├── logs/                  # Application logs
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Environment Variables

| Variable                 | Required    | Description          |
| ------------------------ | ----------- | -------------------- |
| `TELEGRAM_BOT_TOKEN`     | Yes         | Telegram bot token   |
| `TELEGRAM_BOT_DEPLOY`    | Yes         | Deployment mode      |
| `TELEGRAM_CACHE_SESSION` | No          | Session cache config |
| `DB_PATH`                | If `--lmdb` | LMDB storage path    |

## After Generation

```bash
cd my-bot
bun install    # or npm/pnpm/yarn install
echo "TELEGRAM_BOT_TOKEN=your_token" >> .env
bun dev        # start with watch mode
```
