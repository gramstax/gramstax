# Changelog

## 2026-10-28

- Added an AI execution protocol and a failure-recovery table to `references/e2e-coverage.md`. Corrected the seven-layer split (2–6 per page, 1 and 7 project-wide), the handler-dispatch matrix cells with broken backtick escapes, and the render-route matrix: rich `sendRichMessage` sends, delete-then-resend media, answer-only routes, and the `renderEditCaption`/`renderEditKeyboard` message-context fallbacks.
- Corrected `references/e2e-validation.md` and `references/e2e-flows.md` to assert rich-template text through `extractText`, document `gmsg`'s empty-string fallback, and distinguish `sendMessage` from `sendRichMessage` in route assertions.
- Shipped the e2e coverage gate: `scripts/check-e2e-handlers.ts` now checks `e2e/COVERAGE.md` against every `handle*` in `src/pages` and every `e2e/*.test.ts` in generated projects and at the repo root. `test:e2e:check` runs mirror + ledger; generated `test:all` runs it before the suites.
- Rebuilt the e2e guidance as a completeness gate. Added `references/e2e-coverage.md`: seven coverage layers, a full handler-dispatch matrix (static, args, caption, session, free, chat-member, custom routes), state/guard/locale/fallback obligations, a committed coverage ledger, a handler-audit script, and a definition of done.
- Rewrote `references/e2e-setup.md`: exact `BotCore` harness contract, `bot.ready`/`_ensureInit`/`reset` lifecycle, fixture-id and three-layer isolation rules, mirror-checker behavior, and anti-patterns.
- Rewrote `references/e2e-validation.md`: method-level route assertions, template-derived text/keyboard/media checks, stream/broadcast/multi-call validation, and assertion anti-patterns.
- Rewrote `references/e2e-flows.md`: session start/step/invalid/cancel/isolation, gate allow + deny with both deny contracts, fallback recovery, locale fallback, args/media/worker/LMDB/HTTP flows, and error paths.
- Updated the router (`SKILL.md`, `references/_sections.md`) so e2e work starts at `e2e-coverage.md` and is treated as a completion gate.

## 2026-10-27

- Reset to a date-based changelog. Current rules live in `SKILL.md` and `references/`.
