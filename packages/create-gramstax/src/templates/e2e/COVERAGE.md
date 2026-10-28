# E2E Coverage Ledger

One row per page handler, handler state, or hook-driven page. `bun run scripts/check-e2e-handlers.ts`
reads this table and fails when a handler under `src/pages` has no row, a row names a
missing test file, or a test file is not referenced here.

Keep the `Page` cell equal to the route name (`src/pages/start/index.ts` -> `start`).
The `Test` cell is relative to `e2e/`; the text after `›` is the exact test case name.

| Page | Handler / state | Trigger | Test | Asserts |
| --- | --- | --- | --- | --- |
| blank | handleCallbackQueryData | callback `blank` | blank.test.ts › answers a blank callback | `answerCallbackQuery` |
| help | handleCallbackQueryData | callback `help` | help.test.ts › show help text when navigating from /start -> Help | `editMessageText` + `gmsg` + `gkb` (en/id) |
| help | handleCommandText | `/help` | help.test.ts › answers the /help command | `sendRichMessage` + `gmsg` + `gkb` |
| start | handleCallbackQueryData | callback `start` | start/index.test.ts › edits the welcome page from a callback | `editMessageText` + text + `gkb` |
| start | handleCommandText | `/start` | start/index.test.ts › respond to /start command with welcome message and full keyboard | `sendRichMessage` + text + `gkb` (en/id), `e2e.calls` |
| start/random | handleCallbackQueryData | callback `start/random` | start/random/index.test.ts › show hub menu when navigating from /start | `editMessageText` + `gkb` |
| start/random | handleCommandText | `/start/random` | start/random/index.test.ts › answers the /start/random command | `sendMessage` + text + `gkb` |
| start/random/number | handleCallbackQueryData | callback `start/random/number` | start/random/number.test.ts › show generated random number when navigating from hub | `editMessageText` + text + `gkb` |
| start/random/text | handleCallbackQueryData | callback `start/random/text` | start/random/text.test.ts › show random text when navigating from hub | `editMessageText` + text + `gkb` |
| sum-number | handleCallbackQueryData | callback `sum-number` | sum-number.test.ts › complete two-step sum flow and show result | `editMessageText` + `gmsg` step left |
| sum-number | handleCommandText | `/sum-number` | sum-number.test.ts › answers the /sum-number command | `sendMessage` + `gmsg` step left |
| sum-number | handleSessionFreeText | free text after step left/right | sum-number.test.ts › complete two-step sum flow and show result | `sendMessage` + `gmsg` right + result |
| sum-number | handleSessionFreeText (invalid left) | non-numeric text after step left | sum-number.test.ts › re-prompt step 1 on invalid (non-numeric) input | `sendMessage` + re-prompt `gmsg` left |
| sum-number | handleSessionFreeText (invalid right) | non-numeric text after step right | sum-number.test.ts › re-prompt step 2 on invalid (non-numeric) input | `sendMessage` + re-prompt `gmsg` right |
| sum-number | lang=id | `/sum-number` as idUser | sum-number.test.ts › renders the whole flow in Indonesian | `sendMessage` + `gmsg`/`gkb` l, r, s in `id` |
| start/random/text | handleCallbackQueryData (fallback lang) | callback as fr user | start/random/text.test.ts › falls back to English text for an unsupported language | `editMessageText` + default `gmsg`/`gkb` |
| status | — (`hookNotFoundPage`) | unknown callback | status.test.ts › show 'Route not found' for unrecognized callback query | `editMessageText` + `gmsg('status', 'nf')` (en/id) |
| status | — (`hookNotFoundPage`) | unknown command | status.test.ts › show 'Route not found' for an unknown command | `sendMessage` + `gmsg('status', 'nf')` |
| status | — (`hookNotFoundPage`) | unknown free text | status.test.ts › show 'Route not found' for unknown free text | `sendMessage` + `gmsg('status', 'nf')` |
| username-notfound | — (`UserGuard`) deny | `/start` without username | username-notfound.test.ts › blocks user without username and shows username required page | `sendMessage` + en + id username-required page |
| username-notfound | — (`UserGuard`) allow | `/start` with username | username-notfound.test.ts › allows a user with a username through the guard | `sendRichMessage` + start welcome page |
