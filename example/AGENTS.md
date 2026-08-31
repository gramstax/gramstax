# EXAMPLE — Sample Bot Projects

## OVERVIEW
10 runnable Telegram bots, ordinally named `1-complex` … `10-http-request`, all members of the root npm workspace. Each is a complete bot built on the `gramstax` package.

## PROGRESSION
| # | Project | Demonstrates | Unique deps |
|---|---|---|---|
| 1 | `1-complex` | Kitchen-sink reference (not a teaching step): multi-page, guards, i18n (`lang="id"` variants), media replies, block templates (`<g-import>`, map, switch), worker-thread job (`src/jobs/increment.ts`), error-handling demo, `CacheExternal` (memory), `hookAfterStart`/`hookBeforeRoute`, `optionsPage.shortCallbackQueryData: true` | `gramstax` + `@gramstax/worker-thread` (`workspace:*`) |
| 2 | `2-helloworld` | Minimal TS template bot (pages: start/status/blank); adds `src/bench/webhook-server.ts` + `update.json` (`bench:webhook` script); `guards/__nocode.ts` placeholder | `gramstax` only |
| 3 | `3-helloworld-js` | Pure-JS port of #2: runs on `node`, `"type": "module"`, `.js` import extensions, no `tsconfig.json`, JS e2e tests. Proves Gramstax works without TypeScript | `gramstax` only |
| 4 | `4-echo` | Beginner multi-page echo bot (pages: start/help/echo/status/blank) | `gramstax` only |
| 5 | `5-interactive-menu` | Inline keyboards + pagination (`inline/with-range` + `inline/without-range`), reply keyboards, stateful navigation; static catalog at `src/data/catalog.ts`; `optionsPage.shortCallbackQueryData: true` | `gramstax` only |
| 6 | `6-bank-system` | Stateful in-memory store at `core/store.ts`; bigint math (`DECIMALS = 6n`, hex storage); pages for balance/deposit/withdraw/transfer/history; `guards/bank.ts` | `gramstax` only |
| 7 | `7-crud` | Persistence via LMDB: `src/db/db.ts` extends `LmdbEnv`, registers `ItemSchema`/`SequenceSchema` via `register()`, `db/repositories/{item,sequence}.ts` are plain service classes taking `LmdbEnv` and calling `env.method(Schema, ...)`; CRUD pages; `guards/crud.ts`; `utils/time.ts`; env `STORE_PATH` | `gramstax` + `@gramstax/lmdb` |
| 8 | `8-newsletter` | LMDB subscriber repo, `guards/admin.ts` (static `isAdmin`), broadcast + stats pages; env `DB_PATH`, `TELEGRAM_ADMIN_IDS` | `gramstax` + `@gramstax/lmdb` |
| 9 | `9-substore-bot` | Full e-commerce (catalog/cart/checkout/history) on in-memory static data (`src/data/store.ts`) + `CacheExternal` for cart state, no LMDB; env `BOT_TOKEN`, `STORE_ADMIN_USERNAME`; only example with a real unit test (`test/store.test.ts`) and a `PROMPT.md`; `optionsPage.shortCallbackQueryData: true` | `gramstax` only |
| 10 | `10-http-request` | External HTTP integration: `services/http.ts` (`HttpService` using `fetch`, `AbortSignal.timeout`, JSON formatting); pages: http-request/help/start/status/blank; `guards/__nocode.ts` | `gramstax` only |

## SHARED SKELETON
All TS examples share the same `src/` layout:
- `base/{guard,page}.ts`, `blocks/g-keyboard.ts`, `core/{bot,ctx}.ts`, `guards/`, `helpers/log.ts`, `pages/`, `utils/array.ts`, `env.ts`, `index.ts`
- Class chain: `PageBase extends CtxCore extends Ctx`; `BotCore extends Gramstax` overriding `hookErrorPage` + `hookNotFoundPage` (via `StatusPage.berror/bnotFound`)
- Entry convention: `index.ts` does `new BotCore({deploy, token, log})` then `Index.run()`
- `env.ts` = static class with `TELEGRAM_BOT_DEPLOY` (default `polling`) and a hardcoded (revoked) test token
- Every TS example has its own `tsconfig.json` extending `../../tsconfig.json` (composite, `noEmit: false`, includes `src/test/e2e`) with `~/*` → `./src/*` path alias

## RUNTIME WIRING
- Examples declare `gramstax: "workspace:*"` (plus `@gramstax/lmdb` in 7/8, `@gramstax/worker-thread` in 1)
- Bun resolves via workspace symlink → package `main`/`exports` → `./dist/src/index.js`, so at RUNTIME examples execute the BUILT dist output — packages must be built (`bun run build` at root) BEFORE running an example
- For TYPECHECKING, root `tsconfig.json` `paths` remaps `gramstax`/`@gramstax/*` to `packages/*/src/index.ts`, so TS resolves to source
- Runtime = dist; typecheck = src

## E2E HARNESS
- `e2e/setup.ts`: module-level `new BotCore({deploy: "test", token: "test", log: false, templateManager: new TemplateManager({path: [../src/pages]})})`, exports `bot` + `e2e = bot.e2e!`
- Test files (`*.test.ts`) sit flat in `e2e/` or nested dirs mirroring page routes
- API: `e2e.clearCalls()` in `beforeEach`, `e2e.sendText(...)`, `e2e.sendCallbackQuery(...)`, `e2e.lastCall('sendMediaGroup')`, `e2e.gmsg(intent, lang, params)`, `e2e.gmedia(...)`
- Multi-lang tested via `{user: {language_code: 'id'}}`
- Scripts per example: `test` (`bun test test/`), `test:e2e` (`bun test e2e/`), `test:all`

## PER-EXAMPLE DELTAS
- `1-complex`: largest e2e suite (~30 files, incl. `e2e/start/test/media-group.test.ts`, `e2e/start/keyboard/inline.test.ts`, `e2e/start/counter/thread.test.ts`)
- `2-helloworld`: adds `bench:webhook` script
- `3-helloworld-js`: node runtime, no tsconfig, no test scripts beyond start
- `5-interactive-menu`, `9-substore-bot`: `optionsPage.shortCallbackQueryData: true`
- `7-crud`: env `STORE_PATH`; `8-newsletter`: env `DB_PATH` + `TELEGRAM_ADMIN_IDS`; `9-substore-bot`: env `BOT_TOKEN` + `STORE_ADMIN_USERNAME`
- `9-substore-bot`: only example with a real unit test (`test/store.test.ts`; all others just `test/.gitkeep`) and a `PROMPT.md` (the create-gramstax generation prompt that produced it)
- Per-example `README.md` files exist for 1,2,4,5,6,7,8,9,10 (not 3) — reference them, do not duplicate

## ANTI-PATTERNS / GOTCHAS
- `example/1-complex/src/pages/start/test/*.ts` are demo `PageBase` classes (media demo pages), NOT test files — the `test/` folder name inside `src/pages` is coincidental and confuses agents
- `guards/__nocode.ts` is a deliberate empty placeholder to keep the folder non-empty
- `optionsPage.shortCallbackQueryData: true` on menu-heavy bots (1, 5, 9)
- `3-helloworld-js` is the odd one out: node runtime, no tsconfig, no test scripts beyond start