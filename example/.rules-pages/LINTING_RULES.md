# LINTING AND FORMATTING RULES

## Strict Compliance

All Gramstax code MUST pass linting (bun run lint:fix) before it is committed.

## Key Standards

- **BACKTICKS**: Use backticks (`) for all strings. Never use single (') or double (") quotes.
- **NO SEMICOLONS**: Semicolons at the end of statements are strictly prohibited.
- **SPACING**: No spaces are allowed inside object braces (e.g., {data}, NOT { data }).
- **INDENTATION**: Use exactly 2 spaces for all levels of indentation.
- **ARROW FUNCTIONS**: Always wrap arrow function parameters in parentheses (arrowParens: always).
- **UNUSED CODE**: Unused variables or imports must be removed immediately.

## Ethical Rule

> [!CAUTION]
> Using eslint-disable or any other method to suppress linting warnings is an illegal act within this codebase. If the linter reports an issue, you MUST fix the underlying code.
