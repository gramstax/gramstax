---
name: gramstax-best-practice
description: Best practices for Gramstax real project structure.
---

# Gramstax Best Practices

## Project Structure (official create-gramstax)

- Always bootstrap new projects with the `npx create-gramstax@latest` CLI; do not create project files manually.
- `src/base` for shared base classes (`guard.ts`, `page.ts`).
- `src/blocks` for template block helpers (`keyboard.ts`).
- `src/core` for runtime entry points (`bot.ts`, `ctx.ts`).
- `src/guards` for guard checks (`__example.ts` removable once real guards exist).
- `src/pages` for page handlers (`start.ts`, `general-status.ts`).
- `src/utils` for logging and helpers (`log.ts`).
- Optional: `src/db`, `src/repositories`, `src/services`.

## Routing and Flow

- Dont write template block (e.g., <b>) in function classes.
- Dont write content data (e.g., "Your Balance: ...") in function classes (except for a few things).
- If use `this.buildData` the code must be at top number 1.
- Prefer inline keyboard navigation and session flows.
- Avoid slash commands when the flow can be fully inline + session driven.
- Include a `start.ts` page in each example.
- Use the `textCommand` route function for the start page.
- Always clear the session on the start page.
- Do not call `sessionGet()` inside page handlers; the system fetches session before routing.
- Prefer class or static methods for project logic.

## Production Quality (Gramstax + App Code)

- All Gramstax implementations and app code must be production quality.
- Apply best production to SQL databases (e.g., PostgreSQL) and NoSQL databases (e.g., LMDB).

## Templates and Conditional Rendering

- Use `{~ ... ~}`, `<switch>`, or `<script>` for conditional content inside templates.
- Keep conditional view logic in templates rather than handler functions.
- Do not write multi-language content in page functions; keep it in templates.
- Avoid separate base blocks when only small parts differ; merge and use template conditionals.
- Avoid inline error strings in handlers; render via template conditional or a base variant.
- Do not use `+` inside `{~ ... ~}` and `<script></script>`; use template literals or other non-`+` composition.
- When using template literals inside `{~ ... ~}`, escape backticks and `${}`.
- IMPORTANT!: Always use `\\n` (double slash) in template string when used.
- Use at least a heading + content format for message blocks.
- Pass template data into `inlineKeyboardT`, `inlineKeyboard`, `bottomKeyboardT` and `bottomKeyboard` when keyboard labels depend on template data.
- Write production-level message content by default (clear, contextual, user-friendly), not short placeholders.
- Use production-level emojis in messages (intentional, consistent, and aligned with the content).
- Adjust emoji placement to lead headings or highlight key actions without overusing them.

## Keyboard Blocks (this.kbk)

- Only define `this.kbk` blocks when the keyboard block is reused by more than one page.
- Do not define a `this.kbk` block for a single page.
- Keyboard labels should be production-ready and short.
- Use production-level emojis in keyboard labels; place them consistently (e.g., leading the label).

## Keyboard Labels (this.kbl)

- Use `this.kbl` when keyboard labels are required by more than one page.
- Use `this.kbl` when the same labels are used across multiple base blocks in a page.
- You can combine multiple labels into one `this.kbl` variable (e.g., `cancelHome`).

## Base Blocks

- Do not use base IDs if a page has only one base block.
- If two base blocks can be combined without IDs, combine them.
- Use base IDs only when multiple distinct base blocks are required.

## Label Reuse and Duplication

- Avoid duplicate values inside `KeyboardBlock.label`.
- When a label combines other labels, derive it using `this.<key>` instead of literal duplication.
- Define derived labels after their dependencies to avoid "used before initialization" errors.
