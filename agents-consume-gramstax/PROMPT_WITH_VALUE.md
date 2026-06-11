# Preview Content Bot — Gramstax Project Prompt

You are a senior TypeScript engineer building a production-ready Telegram bot project with Gramstax. Work autonomously, but stay strictly inside the requested project scope.

## Agents and documentation gramstax

agents = ./agents-consume-gramstax/AGENTS.md
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
| EXTRA_REQUIREMENTS        | Reference local Gramstax examples before implementing: `example/8-newsletter` for LMDB, admin guard, broadcast flow; `example/1-complex/e2e/main.test.ts` and `example/8-newsletter/e2e/main.test.ts` for e2e style; `example/9-substore-bot/test/store.test.ts` for unit-test style.                                       |

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

- Use the `lmdb` npm package with `open` or the package’s current recommended open function.
- Create `src/db/main.ts` or a small `src/db` module set.
- Store data under stable prefixes, for example:
  - `user:${id}`
  - `content:${code}`
  - `delivery:${deliveryId}`
  - `setting:${key}`
  - `broadcast:${id}`
- Provide repository methods for:
  - upsert/list/count known users
  - mark user unreachable
  - create/update/get/list/delete content
  - increment content view count
  - get/set settings
  - create/update/list delivery records
  - list pending deletions due before a timestamp
- Use range iteration for list methods, following the style in `example/8-newsletter/src/db/main.ts`.
- Keep LMDB access behind repository classes/functions. Do not scatter raw key strings across page files.

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
- Prefer Gramstax helpers such as `ctx.broadcast`/`ctx.broadcastMedia` if available in the generated context; otherwise use the generated bot/context API to send messages directly.
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
- If a form method exists as `showStep{N}Form`, the paired `processStep{N}Answer` MUST also exist.
- If the paired answer method is intentionally unused, its body MUST be exactly `throw ctx`.
- Prefer static methods in the internal `Main` class for page transitions and business logic.

Use this internal class order when classes are needed:

1. `Base`
2. `Constant`
3. `Helper`
4. `Main`
5. Exported page class extending the generated page base

Feedback methods (success, warning, error, info) are static methods inside `Main`, positioned **after** all `showStep{N}Form` and `processStep{N}Answer` methods.

Only define an internal class if it contains real logic or data. Do not create empty class blocks.

## Template rules

- All conditional rendering MUST live inside template strings.
- Use Gramstax template constructs such as `{~ .. ~}`, `<switch>`, or `<script>` for view logic.
- Do not use the `+` operator inside `{~ .. ~}` or `<script>` blocks. Use template literals or non-`+` composition.
- Escape nested backticks and `${}` when writing template literals inside template logic.
- Use `\\n` when declaring multiline strings inside template contexts.
- Every message should have at least a heading and useful content.
- Keep message language authoritative, contextual, and user-friendly.
- Use intentional emojis in headings and keyboard labels without emoji spam.
- Prefer template conditionals over separate base blocks when only small message parts differ.
- Avoid inline error strings in handlers; render validation and error feedback through template variants or template conditionals.

## Base block rules

- If a page has only one `<base>` block, do not give it an `id`.
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

Do not replace these with expanded names such as `baseId`, `keyboardMarkup`, or `templateData` inside page methods.

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
- Never swallow errors. Provide meaningful user-facing feedback through Main feedback methods and store operational failure status where useful.
- Keep UI transitions responsive and clear.
- Use helpers, services, repositories, or database folders only when justified by actual project complexity.
- Do not over-engineer. Only add abstractions that the implemented flow uses.
- Admin actions that mutate content or broadcast MUST require confirmation.

## Testing requirements

Add tests that prove the bot works from the user’s point of view and that extracted logic is stable.

### E2E testing

- MUST create `e2e/main.test.ts`.
- Use `bun:test` with `describe`, `it`, `expect`, `beforeAll`, `afterAll`, and `beforeEach`.
- Use Gramstax `MockTelegramServer` to simulate Telegram instead of calling the real Telegram API.
- Initialize the generated bot core with a test token, webhook deploy mode, a `TemplateManager` that loads `src/pages`, and `botConfig.client.apiRoot` pointing to `mockServer.apiRoot`.
- Start `MockTelegramServer` in `beforeAll`, stop both `botCore` and the mock server in `afterAll`, and call `mockServer.clearRequests()` in `beforeEach`.
- Prefer helper functions for repeated user context and keyboard lookup, such as `createPrivateUserContext(id)` and `getCallbackDataByLabel(responses, label)`.
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

## Required workflow

1. Confirm this prompt uses concrete real project values and contains no placeholder tokens.
2. Scaffold with `npx create-gramstax@latest` into `./real/vip-content-bot`.
3. Inspect the generated project before editing.
4. Inspect local references before implementing:
   - `example/8-newsletter/src/db/main.ts`
   - `example/8-newsletter/src/guards/admin.ts`
   - `example/8-newsletter/src/pages/broadcast.ts`
   - `example/1-complex/e2e/main.test.ts`
   - `example/8-newsletter/e2e/main.test.ts`
   - `example/9-substore-bot/test/store.test.ts`
5. Identify generated Gramstax imports, page base classes, routing hooks, template helpers, context methods, and scripts.
6. Implement LMDB repositories first with unit tests.
7. Implement content delivery and auto-delete services with unit tests.
8. Implement user `/start <unique_code>` flow.
9. Implement `/admin` manager and guarded broadcast/content/settings flows.
10. Add e2e tests for user and admin journeys.
11. Add or update README/documentation for environment variables, run commands, test commands, LMDB path, and admin setup.
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
- Lint/typecheck/build/test commands available in the generated project pass, or any unavailable commands are clearly reported with evidence.
- The final response summarizes changed files, how to run the bot, required environment variables, and exact verification results.
