You are a senior TypeScript engineer building a production-ready Telegram bot project with Gramstax. Work autonomously, but stay strictly inside the requested project scope.

## Agents and documentation gramstax

agents = ./agents-consume-gramstax/AGENTS.md
documentation = ./packages/gramstax/docs/markdown/\*.md

## Interpolation table

Replace each `[[...]]` value in this table exactly once before running the task. After this table, all instructions refer to the key names, not repeated placeholders.

### Required values

| Key                     | Value                       |
| ----------------------- | --------------------------- |
| PROJECT_NAME            | [[PROJECT_NAME]]            |
| TARGET_DIRECTORY        | [[TARGET_DIRECTORY]]        |
| BOT_PURPOSE             | [[BOT_PURPOSE]]             |
| TARGET_USERS            | [[TARGET_USERS]]            |
| PRIMARY_USER_JOURNEY    | [[PRIMARY_USER_JOURNEY]]    |
| REQUIRED_PAGES_OR_FLOWS | [[REQUIRED_PAGES_OR_FLOWS]] |
| FREE_TEXT_STEPS         | [[FREE_TEXT_STEPS]]         |
| INLINE_KEYBOARD_ACTIONS | [[INLINE_KEYBOARD_ACTIONS]] |
| DATA_FIELDS             | [[DATA_FIELDS]]             |
| BOT_LANGUAGE_AND_TONE   | [[BOT_LANGUAGE_AND_TONE]]   |

### Optional values

Use `Not applicable` when an optional key is not needed.

| Key                       | Value                         |
| ------------------------- | ----------------------------- |
| EXTERNAL_SERVICES_OR_APIS | [[EXTERNAL_SERVICES_OR_APIS]] |
| STORAGE_REQUIREMENT       | [[STORAGE_REQUIREMENT]]       |
| ENVIRONMENT_VARIABLES     | [[ENVIRONMENT_VARIABLES]]     |
| PRODUCTION_CONSTRAINTS    | [[PRODUCTION_CONSTRAINTS]]    |
| EXTRA_REQUIREMENTS        | [[EXTRA_REQUIREMENTS]]        |

If any required value is still wrapped in `[[...]]`, stop and ask me to replace it before creating files or running commands. Optional keys may be `Not applicable`; do not block on them.

## Target outcome

Create a new Gramstax project using `PROJECT_NAME` inside `TARGET_DIRECTORY` with the official scaffolding package. Then implement a clean, production-quality Telegram bot flow for `BOT_PURPOSE`.

The finished project MUST be runnable, lint-clean, type-safe, and aligned with Gramstax page architecture rules.

## Starting constraints

- MUST initialize the project with:
  `npx create-gramstax@latest`
- MUST NOT manually recreate the initial scaffold that the CLI is responsible for generating.
- MUST use the generated project structure as the source of truth after scaffolding.
- MUST use the `gramstax` package APIs and the conventions produced by `create-gramstax`.
- MUST keep changes focused on the generated project path derived from `TARGET_DIRECTORY` and `PROJECT_NAME`.
- MUST NOT modify unrelated parent repositories, global config, CI, or system files.
- MUST ask before deleting files, adding non-Gramstax dependencies, changing database schema, or performing destructive terminal commands.
- NEVER embed secrets, bot tokens, API keys, or credentials in source code. Use environment variables and document names from `ENVIRONMENT_VARIABLES` when provided.
- Only make changes directly required for `BOT_PURPOSE`. Do not add extra features, authentication, dashboards, database layers, or abstractions unless explicitly listed in `EXTRA_REQUIREMENTS` or required by `STORAGE_REQUIREMENT`.

## Product requirements

Build the bot around `PRIMARY_USER_JOURNEY` for `TARGET_USERS`.

The implementation MUST include:

1. A `start.ts` page that clears the session and presents the main entry point.
2. The pages or flows described by `REQUIRED_PAGES_OR_FLOWS`.
3. The free-text steps described by `FREE_TEXT_STEPS`.
4. The inline keyboard actions described by `INLINE_KEYBOARD_ACTIONS`.
5. Clear display or collection of the values listed in `DATA_FIELDS`.
6. Integration handling for `EXTERNAL_SERVICES_OR_APIS` when it is not `Not applicable`.
7. Storage behavior matching `STORAGE_REQUIREMENT` when it is not `Not applicable`.
8. User-facing messages matching `BOT_LANGUAGE_AND_TONE`.
9. Production handling for `PRODUCTION_CONSTRAINTS` when it is not `Not applicable`.

Prefer inline keyboard navigation and session-driven flows over slash commands. Avoid extra slash commands when the same action is reachable through inline navigation.

## Project structure rules

After the CLI scaffold is created, preserve the Gramstax layout:

- `src/base` for shared base classes such as `guard.ts` and `page.ts`.
- `src/blocks` for shared template block helpers such as `keyboard.ts`.
- `src/core` for runtime entry points such as `bot.ts` and `ctx.ts`.
- `src/guards` for access control and validation guards.
- `src/pages` for page handlers. Each file represents a user interaction state.
- `src/helpers` for domain-specific helpers.
- `src/utils` for generic pure utilities.
- Optional only when needed: `src/db`, `src/repositories`, and `src/services`.

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
- Use compact base ID names such as `s1`, `s2`, `s1-form`, `s1-success`, or `e`.

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

- Handle common edge cases such as empty input, invalid input, missing environment variables, and failed external operations.
- Never swallow errors. Provide meaningful user-facing feedback through Main feedback methods.
- Keep UI transitions responsive and clear.
- Use helpers, services, repositories, or database folders only when they are justified by actual project complexity.
- Do not over-engineer. Only add abstractions that the implemented flow uses.

## Testing requirements

Add tests that prove the bot works from the user’s point of view and that extracted logic is stable.

### E2E testing

- MUST create an e2e test at `e2e/main.test.ts` when the generated project has or can support a test script.
- Use `bun:test` with `describe`, `it`, `expect`, `beforeAll`, `afterAll`, and `beforeEach`.
- Use Gramstax’s `MockTelegramServer` to simulate Telegram instead of calling the real Telegram API.
- Initialize the generated bot core with a test token, webhook deploy mode, a `TemplateManager` that loads `src/pages`, and `botConfig.client.apiRoot` pointing to `mockServer.apiRoot`.
- Start `MockTelegramServer` in `beforeAll`, stop both `botCore` and the mock server in `afterAll`, and call `mockServer.clearRequests()` in `beforeEach`.
- Prefer helper functions for repeated user context and keyboard lookup, such as `createPrivateUserContext(id)` and `getCallbackDataByLabel(responses, label)`.
- Cover the primary happy path from `/start` through the main inline keyboard flow described by `PRIMARY_USER_JOURNEY`.
- Cover each important callback action from `INLINE_KEYBOARD_ACTIONS`, including navigation back to the start page when applicable.
- Cover each free-text step from `FREE_TEXT_STEPS`, including the session state that accepts the answer and the resulting confirmation or validation message.
- Cover important media or Telegram method behavior by checking `mockServer.lastRequest("sendMessage")`, `mockServer.lastRequest("editMessageText")`, `mockServer.lastRequest("sendPhoto")`, `mockServer.lastRequest("editMessageMedia")`, or the method relevant to the feature.
- Assert user-visible outcomes, not implementation details: message text contains stable headings/content, inline keyboards contain expected labels, and Telegram requests contain expected payload fields.
- Use distinct private user IDs for stateful tests so session data does not leak between scenarios.

Reference shape for e2e tests:

- imports: `join` from `node:path`, Bun test helpers from `bun:test`, `TemplateManager` and `MockTelegramServer` from `gramstax`, and the generated `BotCore` from `../src/core/bot`.
- top-level variables: `let mockServer: MockTelegramServer` and `let botCore: BotCore`.
- `beforeAll`: start `new MockTelegramServer({log: false})`, create `new TemplateManager({path: [join(import.meta.dir, `../src/pages`)]})`, then create `new BotCore({deploy: `webhook:http://127.0.0.1:3001/webhook/e2e-project-name`, token: `test-token`, log: false, templateManager, botConfig: {client: {apiRoot: mockServer.apiRoot}}})`.
- `afterAll`: `await botCore.stop()` and `await mockServer.stop()`.
- `beforeEach`: `mockServer.clearRequests()`.

### Unit testing

- MUST add unit tests under `test/` for pure helpers, utilities, stores, repositories, services, validation functions, formatting functions, and other logic extracted outside page handlers.
- Keep page-handler logic thin enough that most business rules can be tested as pure functions or store/service methods.
- Unit tests MUST use deterministic inputs and assert edge cases such as empty data, invalid IDs, out-of-range pagination, failed lookups, and status transitions.
- Do not mock Gramstax internals for unit tests unless unavoidable. Prefer testing pure exported functions/classes directly.
- If testing page wiring that is hard to instantiate, use a narrow source-level assertion only for structural rules that cannot be exercised through e2e, and explain why in the test name.
- If no extracted logic exists, do not create meaningless unit tests; state that e2e coverage is sufficient because the project has no pure logic layer.

## Required workflow

1. Confirm all required interpolation values are filled and no required value still uses `[[...]]`.
2. Treat optional `Not applicable` values as intentionally omitted.
3. Scaffold with `npx create-gramstax@latest`.
4. Inspect the generated project before editing.
5. Identify existing Gramstax imports, page base classes, routing hooks, template helpers, and scripts.
6. Implement the requested production flow using the generated patterns.
7. Add e2e tests for the main Telegram user journey and unit tests for extracted pure logic when present.
8. Add or update documentation for required environment variables, run commands, and test commands.
9. Run the project’s available quality checks. Prefer, in order:
   - package install command from the generated project
   - lint or lint:fix command if available
   - TypeScript typecheck if available
   - tests if available
   - build command if available
10. Fix issues caused by your changes and re-run the relevant checks.

## Done when

- The project was initialized through `npx create-gramstax@latest`.
- The app implements `PRIMARY_USER_JOURNEY` for `TARGET_USERS`.
- The app contains a working `start.ts` entry flow and the required inline/session-driven interactions.
- Page files follow Gramstax class order, template, keyboard, base block, and naming rules.
- User-facing text is production-ready, not placeholder text.
- `e2e/main.test.ts` covers the primary `/start`, callback navigation, free-text, and Telegram request behavior for the requested flow when testing is supported.
- Unit tests under `test/` cover extracted helpers/stores/services, or the final response explicitly explains why no unit-testable pure logic was added.
- Secrets are not committed or embedded.
- Environment variables from `ENVIRONMENT_VARIABLES` are documented when provided.
- Lint/typecheck/build/test commands available in the generated project pass, or any unavailable commands are clearly reported with evidence.
- The final response summarizes changed files, how to run the bot, required environment variables, and exact verification results.
