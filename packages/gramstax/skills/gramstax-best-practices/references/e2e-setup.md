# e2e-setup

One `setup.ts` with `deploy: "test"`, mirrored test files, `clearCalls` isolation.

## Why

`deploy: "test"` drives updates through `handleUpdate` in-process — no MockTelegramServer, no ports, no polling, no `beforeAll` server waits. Mirror layout guarantees every page has at least a registration test; `clearCalls` per test prevents call-log leakage between cases.

## Incorrect

```typescript
// spinning up servers and polling for e2e
import {MockTelegramServer} from "gramstax"
const mock = new MockTelegramServer()
await mock.start() // ports, webhook polling, flaky timing
```

## Correct

```typescript
// e2e/setup.ts
import {join} from "node:path"
import {BotCore} from "../src/core/bot"
import {TemplateManager} from "gramstax"

export const bot = new BotCore({
  deploy: `test`,
  token: `test`,
  log: false,
  stream: true,
  autoRetry: true,
  templateManager: new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})
})
export const e2e = bot.e2e!
export const enUser = {user: {id: 4001, language_code: `en`}, chat: {id: 4001}}
export const idUser = {user: {id: 5001, language_code: `id`}, chat: {id: 5001}}
```

```typescript
// e2e/start.test.ts
import {beforeEach, describe, expect, it} from "bun:test"
import {e2e} from "./setup"

beforeEach(() => e2e.clearCalls())
```

## Structure Mirroring — `e2e/` MUST Mirror `src/pages/`

Every page file MUST have a test file at the same relative path — including directory-index pages:

```
src/pages/                   e2e/
├── start.ts      ──────▶    ├── start.test.ts
├── start/                   ├── start/
│   ├── index.ts  ──▶        │   ├── index.test.ts
│   └── counter/             │   └── counter/
│       └── index.ts  ──▶    │       └── index.test.ts
├── help.ts        ──────▶    ├── help.test.ts
└── sum-number.ts  ──────▶    └── sum-number.test.ts
```

Rules:

- `foo.ts` → `foo.test.ts`; `foo/bar.ts` → `foo/bar.test.ts`; `index.ts` → `index.test.ts` in the same folder (never at the parent level).
- `setup.ts` is the harness, not a page test — excluded from mirroring.
- Verify mechanically (ships in generated projects and repo root `scripts/`):

```bash
bun run scripts/check-e2e-mirror.ts          # fail CI on orphans
bun run scripts/check-e2e-mirror.ts --fix    # scaffold missing stubs
bun run scripts/generate-e2e-structure.ts    # bulk-generate stubs
```

Rationale: mirroring guarantees every page — including nested index routes — has at minimum a registration test, so orphaned pages can never go unnoticed.

## Notes

- Mirror: `src/pages/foo/bar.ts` → `e2e/foo/bar.test.ts` (`scripts/check-e2e-mirror.ts`, `--fix` scaffolds stubs).
- `stream: true` captures streaming as `sendMessageDraft`/`sendRichMessageDraft`/`sendRichMessage`; `autoRetry: true` is invisible to call capture.
- Unique `{user, chat}` ids per file when sessions could collide; `hookAfterStart` workers start automatically.
- Project extras live after `e2e`: `resetDb`/`resetEnv`, HTTP `Bun.serve` URLs, page monkey-patches (before bot creation).
