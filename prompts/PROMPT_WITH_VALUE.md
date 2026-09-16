# Preview Content Bot — Gramstax Project Prompt

You are a senior TypeScript engineer building a production-ready Telegram bot project with Gramstax. Work autonomously, but stay strictly inside the requested project scope.

## Rules and documentation gramstax

index = ./packages/gramstax/skills/gramstax-best-practices/SKILL.md
documentation = ./packages/gramstax/docs/markdown/\*.md

## Real project values

| Key                       | Value                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROJECT_NAME              | `vip-content-bot`                                                                                                                                                                                                                                                                                                           |
| TARGET_DIRECTORY          | `./real`                                                                                                                                                                                                                                                                                                                    |
| BOT_PURPOSE               | A private preview-content VIP delivery bot. Users open content through `/start <unique_code>`, receive the mapped preview content, and that delivered message is automatically deleted after a configurable TTL. Admins can manage content codes, broadcast to all known users, and inspect operational stats.              |
| TARGET_USERS              | End users who receive short-lived preview content links, plus trusted admins who manage content and broadcasts.                                                                                                                                                                                                             |
| PRIMARY_USER_JOURNEY      | A user opens a Telegram deep link or sends `/start <unique_code>`. The bot stores the user/chat ID for future broadcast, validates the code, sends the mapped preview content, shows its expiry time, schedules deletion after the content TTL, and gives safe fallback/help text if the code is invalid or expired.        |
| REQUIRED_PAGES_OR_FLOWS   | `start.ts` for `/start` and `/start <unique_code>`; `admin.ts` for `/admin` dashboard; admin flows for content create/edit/list/disable/delete, default TTL setting, stats, and broadcast; status/help/error pages as needed.                                                                                               |
| FREE_TEXT_STEPS           | Admin content creation and editing: unique code, title, message body/caption, optional media file ID or media URL, TTL in seconds/minutes, enable/disable status, broadcast draft text/media, and broadcast confirmation. End users do not enter free text except normal invalid input fallback.                            |
| INLINE_KEYBOARD_ACTIONS   | User: Help, Open another code instruction. Admin: Add content, List content, View content detail, Edit content, Disable/Enable content, Delete content, Set default TTL, Broadcast, Confirm broadcast, Cancel, Stats, Back/Home.                                                                                            |
| DATA_FIELDS               | User IDs/chat IDs/language/username/full name/first seen/last seen; content unique code/title/body/media type/media source/default or custom TTL/status/view count/createdAt/updatedAt; delivery records with user ID/chat ID/code/message ID/deleteAt/deleted status; broadcast draft/result counters; admin IDs from env. |
| BOT_LANGUAGE_AND_TONE     | English, concise, trustworthy, operationally clear. Use intentional emojis for headings and buttons, but avoid emoji spam.                                                                                                                                                                                                  |
| EXTERNAL_SERVICES_OR_APIS | Telegram Bot API through Gramstax only. No other external API.                                                                                                                                                                                                                                                              |
| STORAGE_REQUIREMENT       | Use LMDB only. Store users, content records, delivery records, settings, and broadcast metadata in `src/db`. Do not add SQL, Prisma, Redis, cloud databases, or unrelated persistence layers.                                                                                                                               |
| ENVIRONMENT_VARIABLES     | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_DEPLOY`, `TELEGRAM_ADMIN_IDS`, `DB_PATH`, `DEFAULT_CONTENT_TTL_SECONDS`, `BROADCAST_BATCH_SIZE`, `BROADCAST_BATCH_DELAY_MS`                                                                                                                                                             |
| PRODUCTION_CONSTRAINTS    | No secrets in source. Admin routes must be guarded. Broadcast must handle blocked/deleted chats gracefully. Auto-delete must not crash the bot if Telegram deletion fails. Content codes must be unique and normalized. TTL must be configurable per content with a safe default.                                           |
| EXTRA_REQUIREMENTS        | Reference local Gramstax examples before implementing: `example/8-newsletter` for LMDB, admin guard, broadcast flow; `example/1-complex/e2e/start/` and `example/8-newsletter/e2e/broadcast.test.ts` for e2e style; `example/9-substore-bot/test/store.test.ts` for unit-test style.                                       |

## Target outcome

Create a new Gramstax project named `vip-content-bot` inside `./real` with the official scaffolding package. Then implement a clean, production-quality Telegram bot that delivers short-lived preview content by unique start code and provides an admin manager for content, broadcast, and stats.

The finished project MUST be runnable, lint-clean, type-safe, tested, and aligned with Gramstax page architecture rules.

## Starting constraints

- MUST initialize the project with `npx create-gramstax@latest`.
- MUST NOT manually recreate the initial scaffold that the CLI is responsible for generating.
- MUST use the generated project structure as the source of truth after scaffolding.
- MUST use the `gramstax` package APIs and conventions produced by `create-gramstax`.
- MUST keep changes focused inside `./real/vip-content-bot` after scaffolding.
- MUST NOT modify unrelated parent repositories, global config, CI, or system files.
- MUST ask before deleting files, adding non-Gramstax dependencies other than the required `lmdb` package, changing database schema after it has data migration implications, or performing destructive terminal commands.
- NEVER embed bot tokens, admin IDs, API keys, or credentials in source code. Use environment variables.
- Only make changes directly required for this project. Do not add dashboards, web UIs, auth systems, payment systems, queues, or cloud services unless explicitly required by this prompt.

## Product requirements

Build the bot around this user journey:

1. User sends `/start <unique_code>` or opens a Telegram deep link containing a content code.
2. Bot saves or updates the user record in LMDB for future broadcast.
3. Bot normalizes and validates the unique code.
4. If the code exists, is enabled, and is not expired, bot sends the mapped preview content.
5. Bot records the delivered Telegram message ID, scheduled deletion timestamp, and content code.
6. Bot schedules automatic deletion after the content TTL.
7. If deletion succeeds, record the delivery as deleted. If deletion fails, log/store the failure without crashing.
8. If the code is missing, unknown, disabled, or expired, bot returns a clear helpful message.
9. Admins use `/admin` to manage content, settings, stats, and broadcast.

The implementation MUST include:

1. A `start.ts` page that handles both plain `/start` and `/start <unique_code>`.
2. A durable LMDB user registry for all users/chats that interact with the bot.
3. A content repository keyed by unique code.
4. Per-content TTL with fallback to `DEFAULT_CONTENT_TTL_SECONDS`.
5. Automatic deletion of delivered preview messages after TTL.
6. Delivery records for audit/debugging: code, user ID, chat ID, message ID, deleteAt, deletedAt, deletion status, failure message when present.
7. An admin manager opened by `/admin`, guarded by `TELEGRAM_ADMIN_IDS`.
8. Broadcast message to all stored users, with confirmation before sending.
9. Broadcast result summary: total, sent, failed, removed/blocked count if cleanup is implemented.
10. E2E tests and unit tests for core repositories/helpers.

## Admin manager requirements

`/admin` MUST be useful and safe. It MUST include:

- Admin-only access guard using `TELEGRAM_ADMIN_IDS` parsed from environment.
- Dashboard showing at least: total known users, enabled content count, disabled content count, total deliveries, pending auto-delete count, and default TTL.
- Content management:
  - Add content by guided session flow.
  - List content codes with status and TTL.
  - View content detail.
  - Edit title/body/media/TTL/status.
  - Disable/enable a code without deleting it.
  - Delete a content record only after confirmation.
- Broadcast management:
  - Draft text broadcast.
  - Optional support for media broadcast if Gramstax helpers make it straightforward; otherwise text broadcast is required and media broadcast can be documented as unsupported.
  - Preview/confirm/cancel before sending.
  - Broadcast to every stored user/chat ID in LMDB.
  - Continue after individual send failures.
  - Remove or mark users as unreachable when Telegram reports they blocked the bot or chat is unavailable.
- Settings:
  - View current default TTL.
  - Set default TTL through a validated admin free-text step.
  - Reject TTL values below 10 seconds or above 7 days unless a clear constant is changed intentionally.

## Content model requirements

Implement precise TypeScript types. Suggested shape:

- `ContentRecord`
  - `code: string`
  - `title: string`
  - `body: string`
  - `mediaType?: "photo" | "video" | "animation" | "document"`
  - `mediaSource?: string`
  - `ttlSeconds?: number`
  - `isEnabled: boolean`
  - `viewCount: number`
  - `createdAt: number`
  - `updatedAt: number`
- `KnownUser`
  - `id: number`
  - `chatId: number`
  - `userName?: string`
  - `fullName?: string`
  - `language?: string`
  - `firstSeenAt: number`
  - `lastSeenAt: number`
  - `isReachable: boolean`
- `DeliveryRecord`
  - `id: string`
  - `code: string`
  - `userId: number`
  - `chatId: number`
  - `messageId: number`
  - `deleteAt: number`
  - `deletedAt?: number`
  - `status: "pending" | "deleted" | "failed"`
  - `failureReason?: string`

Use helper functions for code normalization, TTL parsing, delivery ID creation, and human-readable TTL formatting.

## LMDB requirements

- Use `@gramstax/lmdb` (schema-declared repositories), never the raw `lmdb` driver and never prefix-encoded keys.
- Each entity is a `LmdbSchema` subclass (`static db` names the isolated sub-database, `static key` the primary key, `static value` the columns); register via `env.register(Schema)` and operate through the returned handle — e.g. `users.put(...)`, `users.get(...)` (sync reads).
- Create `src/db/db.ts` (`Db extends LmdbEnv`, registers schemas in the constructor) plus `src/db/schema/*.ts` declarations; domain methods live in service classes receiving the `Db`, never on the schema.
- Secondary indexes via `.unique()` / `.index()` on value columns; query with `findByIndex({...})`; pass `{limit}` for fan-out reads.
- TTL via `static ttl` (ms) or per-put `{ttlMs}`; purge with `purgeExpired()`.
- Keep the established layout: `src/db/db.ts`, `src/db/schema/<entity>.ts`, `src/db/repositories/<entity>.ts` (plain service classes taking `LmdbEnv`).
- Range iteration for list methods, following the style in `example/8-newsletter/src/db/` — keyset (`start`/`limit`), never deep `offset`.
- Keep LMDB access behind repository/service classes. Do not scatter raw key strings across page files.
- Provide repository/service methods for: upsert/list/count known users; mark user unreachable; create/update/get/list/delete content; increment content view count; get/set settings; create/update/list delivery records; list pending deletions due before a timestamp.

## Auto-delete requirements

- When preview content is delivered, schedule deletion with `setTimeout` or a small scheduler service.
- On bot startup, scan LMDB for pending deliveries whose `deleteAt` is in the past or future and schedule/process them.
- Do not rely only on in-memory timers; delivery records MUST persist so restart recovery can happen.
- Deletion must call Telegram `deleteMessage` through the available Gramstax/grammY context or bot API surface discovered in the generated project.
- If a message is already deleted, too old, or cannot be deleted, update the delivery status to `failed` with a safe reason and continue.
- Timer delay must be clamped to safe JavaScript timeout bounds.
- Tests MUST use short TTL values and avoid slow real waits where possible by testing scheduler helper logic separately.

## Broadcast requirements

- Store every user who sends `/start`, `/start <code>`, or any other message the bot handles.
- Admin broadcast MUST send to all reachable known users.
- Use batching controlled by `BROADCAST_BATCH_SIZE` and `BROADCAST_BATCH_DELAY_MS`.
- Do not stop the whole broadcast on one failed chat.
- Track result counts and show a clear admin summary.
- Prefer Gramstax `renderBroadcast`/`renderBroadcastMedia` when fanning out (per-user langs, counts, throttling); otherwise use the generated bot/context API to send messages directly.
- For blocked/unreachable users, mark them unreachable or remove them from the active broadcast list.

## Project structure rules

After the CLI scaffold is created, preserve the Gramstax layout:

- `src/base` for shared base classes such as `guard.ts` and `page.ts`.
- `src/blocks` for shared template block helpers such as `keyboard.ts`.
- `src/core` for runtime entry points such as `bot.ts` and `ctx.ts`.
- `src/guards` for admin access control.
- `src/pages` for page handlers. Each file represents a user interaction state.
- `src/db` for LMDB setup and repositories.
- `src/services` for scheduler/broadcast/content delivery services when justified.
- `src/helpers` for domain-specific helpers.
- `src/utils` for generic pure utilities.

## Gramstax page rules

For every page file in `src/pages`:

- Keep view content in `static template`, not in handler functions.
- Do not write UI tags such as `<b>` or content-heavy message strings inside page logic methods.
- Use `this.buildData` only when data must be prepared before rendering, and place that logic at the top of the handler.
- Do not call `getSession()` manually. Assume the framework injects session data before routing.
- Structure each view as a `g<name>` object with `show` and `process` methods (`gdefault` for single-base pages, `gs1`/`gamount`/… matching each `<g-base id>`). Handlers (`handleCallbackQueryData`, `handleCommandText`, `handleSessionFreeText`) MUST be thin wrappers delegating to `g<*>.show()`/`g<*>.process()`.
- Every `g*` object MUST define both `show` and `process` — use `process: () => {}` when the step expects no input. Uniform shape keeps generated code consistent.
- Every page that defines `g*` objects MUST also define an instance `helper = {}` field with that page's small closures (keyboard builders, param readers); `g*` methods delegate to `this.helper.*`.
- Prefer `renderAuto` family for rendering (auto send-vs-edit); never branch on `this.callbackQuery` manually.
- Clear the session on the start page so every visit begins clean.

Use this internal class order when classes are needed:

1. `Base` (g-base id constants)
2. Uppercase consts (reusable literals, top-level `const`, never class-wrapped)
3. Exported page class extending the generated page base (`static data` first, handlers, `helper = {}`, `g*` objects, `static template` last)

Feedback views (`gsuccess`, `gfailed`, `gerror`, `gwarn`, `ginfo`) follow the same `g*` pattern, positioned **after** all step objects.

Only define an internal class if it contains real logic or data. Do not create empty class blocks.

## Template rules

- All conditional rendering MUST live inside template strings.
- Use Gramstax template constructs such as `{~ .. ~}`, `<g-switch>`, or `<g-script>` for view logic.
- Do not use the `+` operator inside `{~ .. ~}` or `<g-script>` blocks. Use template literals or non-`+` composition.
- Escape nested backticks and `${}` when writing template literals inside template logic.
- Use `\\n` when declaring multiline strings inside template contexts.
- Every message should have at least a heading and useful content.
- Keep message language authoritative, contextual, and user-friendly.
- Use intentional emojis in headings and keyboard labels without emoji spam.
- Prefer template conditionals over separate base blocks when only small message parts differ.
- Avoid inline error strings in handlers; render validation and error feedback through template variants or template conditionals.

## Base block rules

- If a page has only one `<g-base>` block, do not give it an `id`.
- Use base IDs only for distinct layouts or fundamentally different views.
- Merge base blocks that share keyboard structure by using template conditionals where practical.
- Define base IDs as static properties in an internal `Base` class.
- Use compact base ID names such as `s1`, `s2`, `s1-form`, `s1-success`, `e`, `confirm`, or `stats`.

## Keyboard rules

- Only define reusable keyboard blocks in `this.kbk` when used by at least two pages.
- Do not create a shared `this.kbk` block for a keyboard used by only one page.
- Use `this.kbl` for labels shared across states or pages.
- Avoid duplicated literal keyboard labels; derive composite labels from existing label properties.
- Define base label properties before derived label properties.
- Keyboard labels MUST be short, action-oriented, and use consistent leading emojis, for example `✅ Confirm` or `❌ Cancel`.
- Pass template data into `inlineKeyboardT`, `inlineKeyboard`, `bottomKeyboardT`, or `bottomKeyboard` when keyboard labels depend on dynamic data.

## Naming and code style

Use the Gramstax shorthand variables consistently in page handlers:

- `bi` for base ID.
- `kb` for keyboard markup.
- `da` for template data.

Do not replace these with expanded names such as `AGBaseId`, `keyboardMarkup`, or `templateData` inside page methods.

Code style MUST follow:

- TypeScript ESM imports.
- Backticks for all strings.
- No semicolons.
- 2-space indentation.
- No spaces inside object braces, for example `{amount}` not `{ amount }`.
- Arrow function parameters always wrapped in parentheses.
- Remove unused imports and variables immediately.
- Do not use lint suppression comments. Fix root causes instead.
- Avoid `any`; use precise types or `unknown` when possible.

## Production quality requirements

- Handle empty content code, invalid content code, disabled content, expired content, invalid TTL, missing admin env, no known users, broadcast failures, and Telegram delete failures.
- Never swallow errors. Provide meaningful user-facing feedback through `g*` feedback objects (`gsuccess`, `gerror`, …) and store operational failure status where useful.
- Keep UI transitions responsive and clear.
- Use helpers, services, repositories, or database folders only when justified by actual project complexity.
- Do not over-engineer. Only add abstractions that the implemented flow uses.
- Admin actions that mutate content or broadcast MUST require confirmation.

## Testing requirements

Add tests that prove the bot works from the user’s point of view and that extracted logic is stable.

### E2E testing

- Mirror the pages tree: `src/pages/<name>.ts` → `e2e/<name>.test.ts` (verify with `bun run scripts/check-e2e-mirror.ts`).
- Use `bun:test` with `describe`, `it`, `expect`, and `beforeEach`.
- Drive the bot in-process with `deploy: "test"` via `e2e/setup.ts` (`bot.e2e!`) — no `MockTelegramServer`, no ports, no polling, no `beforeAll` server waits; `beforeEach(() => e2e.clearCalls())`.
- Validate every Telegram call, not just the last: methods order, message text via `e2e.gmsg()`, labels via `e2e.gkb()`, media via `e2e.gmedia()`; edits via `e2e.lastCall("editMessageText")`.
- Cover `/start` without code: helpful instruction message and user saved.
- Cover `/start valid-code`: content delivered, expiry text shown, delivery record created.
- Cover `/start invalid-code`: helpful not-found message.
- Cover disabled content code.
- Cover admin `/admin`: denied for non-admin and dashboard shown for admin.
- Cover admin content list/detail and broadcast confirmation flow.
- Cover broadcast sends to stored users and summarizes success/failure counts.
- Cover auto-delete behavior by asserting delivery scheduling/service logic and, where practical, Telegram `deleteMessage` request capture.

### Unit testing

- MUST add unit tests under `test/` for pure helpers and repositories/services.
- Unit tests MUST cover:
  - content code normalization and validation
  - TTL parsing and bounds
  - human-readable TTL formatting
  - LMDB repository create/update/list/delete behavior using a temporary test DB path
  - user upsert/list/reachability behavior
  - pending delivery selection
  - broadcast batching helper logic
  - scheduler delay clamping
- Do not mock Gramstax internals for unit tests unless unavoidable. Prefer testing pure exported functions/classes directly.

## README requirements

The finished project MUST ship a `README.md` at the project root that documents the bot accurately enough for a non-technical reader. Follow this section structure exactly — every section is REQUIRED:

1. Centered header: logo image with a correct `alt` (the project name, never another project's name), `<h1>` project name, one-paragraph description, technology badges as plain `<img>` shields (no broken `<a/>` wrappers), and a license badge matching the actual `LICENSE` file. No commented-out blocks from other projects, no stray markup.
2. `## Features` in three groups — For users / For admins (admin-ID-gated actions only) / Platform. Every bullet MUST describe behavior verified in the code. Never list aspirational features. State failure behavior precisely (explicit error reply vs silently ignored).
3. `## Quick Start`: prerequisites (runtime, token source, admin ID source), `bun install`, a `.env` example with unquoted values (quote only JSON arrays), dev (`bun run dev`) and production (`bun run start`) commands, and the first Telegram step (`/start`).
4. `## Usage`: each user flow with LITERAL message texts copied from the templates — verify against `static template` sources, never paraphrase inside code fences (include follow-up lines such as retry hints when the template has them). An admin panel table (`Section` | `What you can do`) matching the actual pages. State the EXACT command that opens each entry point — verify routing in code (`/start` vs `/admin`), never assume the panel lives on `/start`.
5. `## How it works`: the product user journey as a mermaid `flowchart` where every node traces to a real handler, plus prose naming exact files/functions for ban checks, registration, gate/membership checks (including cache TTLs), code validation, media delivery (spoiler, view counting, cleanup bookkeeping), and upload-to-code flow. Document edge behavior found in code: empty-gate-config pass-through, duplicate-event suppression, per-user cleanup on pass.
6. `## Scripts`: a table of EVERY `package.json` script with descriptions verified against what each script actually runs.
7. `## Project Structure`: an ASCII tree matching the real tree, with a one-line note per directory/file. Include `e2e/`, `test/`, runtime dirs, and helper scripts. Add the `New page?` convention line used by the scaffold.
8. `## Configuration`: a table (`Variable` | `Required` | `Default` | `Description`) of EVERY environment variable the code reads — cross-check against the env module so none are missing, and copy each default exactly. Call out JSON-array shapes and single-writer/single-file semantics where they exist.
9. `## Architecture`: the request-flow line (`Update` → guard → `Page (show/process)` → repository → API), background worker jobs (what each owns, RPC patterns with timeout notes), the exact shutdown order from the shutdown owner, and a data-model table (`Schema` | `Key` | `Value` | `Notes`) matching every registered schema (key types, unique/index markers, counters, retention/prune rules, list caps). State the enforced code rules (keyset pagination, sync transaction callbacks, `{limit}` on fan-out reads, `count()` over manual totals) only if the code actually enforces them.
10. `## Testing`: `bun run test` / `test:e2e` / `test:all` with REAL counts from actual test runs (re-run to confirm before writing), one-file examples pointing at real files (`test/` paths for unit, `e2e/` paths for e2e), and one paragraph on what the e2e harness asserts.
11. `## Deployment`: development (polling), production (webhook behind a process manager), serverless (only per the framework's documented pattern — never claim the entrypoint exports a handler when it boots directly), backup/restore matching ACTUAL library capabilities (live snapshot vs stop-the-world, multi-process read support vs single-writer rule), DB inspection script usage verified against its behavior, and log behavior verified in code (stdout by default; file output only when the logger's file option is configured — never claim logs land in `logs/` unless something writes there).
12. `## Troubleshooting`: a symptom table (`Symptom` | `Likely cause` | `Fix`) where every cause/fix is verified against code or observed errors — never generic guesses.
13. `## Tech Stack`: each dependency with the MAJOR version from `package.json`, plus runtime/test/lint toolchain as configured. Never claim configs that do not exist (e.g. `.vscode/settings.json`).
14. `## License`: MUST match the `LICENSE` file text and the `package.json` license field — never write `MIT` when the file says otherwise.

Accuracy rules (BLOCKING — the README is not done until all hold):

- Every literal (message text, command, default value, test count, TTL) MUST be copied from code or tool output, never written from memory.
- After drafting, do a mandatory second pass: re-read the README against the code and fix every mismatch (wrong entry command, missing env var, stale count, leftover name/URL, invalid HTML).
- No leftover content from other projects (names, avatars, GIFs, links, comments).
- Every file, path, command, and script mentioned MUST exist in the generated project.

## Required workflow

1. Confirm this prompt uses concrete real project values and contains no placeholder tokens.
2. Scaffold with `npx create-gramstax@latest` into `./real/vip-content-bot`.
3. Inspect the generated project before editing.
4. Inspect local references before implementing:
   - `example/8-newsletter/src/db/` (index, schema, repositories)
   - `example/8-newsletter/src/guards/admin.ts`
   - `example/8-newsletter/src/pages/broadcast.ts`
   - `example/1-complex/e2e/start/` and `example/8-newsletter/e2e/broadcast.test.ts` for e2e style
   - `example/9-substore-bot/test/store.test.ts` for unit-test style
5. Identify generated Gramstax imports, page base classes, routing hooks, template helpers, context methods, and scripts.
6. Implement LMDB repositories first with unit tests.
7. Implement content delivery and auto-delete services with unit tests.
8. Implement user `/start <unique_code>` flow.
9. Implement `/admin` manager and guarded broadcast/content/settings flows.
10. Add e2e tests for user and admin journeys.
11. Write or update `README.md` per `README requirements` (all 14 sections: header, features, quick start, usage with literal texts, mermaid journey, scripts, structure, full env table, architecture, tested counts, deployment, troubleshooting, tech stack, license), then perform the mandatory second accuracy pass against the code.
12. Run the project’s available quality checks. Prefer, in order:
    - package install command from the generated project
    - lint or lint:fix command if available
    - TypeScript typecheck if available
    - tests if available
    - build command if available
13. Fix issues caused by your changes and re-run the relevant checks.

## Done when

- The project was initialized through `npx create-gramstax@latest` at `./real/vip-content-bot`.
- `/start <unique_code>` loads the correct preview content and stores user/chat ID in LMDB.
- Delivered preview content is automatically deleted after its configured TTL, with persisted delivery status.
- `/start` without code gives a clear instruction message and stores the user.
- Invalid/disabled/expired content codes produce clear user-facing messages.
- LMDB stores users, content, deliveries, settings, and broadcast records through repository methods.
- `/admin` is guarded and includes stats, content management, TTL settings, and broadcast management.
- Broadcast sends to all reachable stored users and reports result counts.
- Page files follow Gramstax class order, template, keyboard, base block, and naming rules.
- User-facing text is production-ready, not placeholder text.
- E2E tests cover user start-code delivery, admin access, admin broadcast, and key error paths.
- Unit tests cover repository/helper/service logic.
- Secrets are not committed or embedded.
- Environment variables are documented.
- `README.md` covers all 14 required sections with literals verified against code (entry commands, message texts, env defaults, test counts, license) and passed the second accuracy pass.
- Lint/typecheck/build/test commands available in the generated project pass, or any unavailable commands are clearly reported with evidence.
- The final response summarizes changed files, how to run the bot, required environment variables, and exact verification results.
