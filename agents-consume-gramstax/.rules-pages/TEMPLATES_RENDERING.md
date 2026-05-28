# TEMPLATE RENDERING RULES

## View Logic

- **STRICT RULE**: All conditional rendering logic (if/else, switch) **MUST** reside within the template string.
- **SYNTAX**: Use Gramstax-specific blocks: {~ .. ~}, <switch>, or <script>.
- **DEDUPLICATION**: Instead of creating multiple Base IDs for small changes, use template conditionals to toggle content visibility within a single base.

## Syntax & Escaping

- **NO CONCATENATION**: Using the + operator inside {~ .. ~} is prohibited. Use template literals (backticks) for all string composition.
- **ESCAPING**: Backticks (`) and template interpolation (${}) must be escaped when nested inside template logic blocks in the TS source code.
- **NEWLINES**: When declaring multi-line strings within a template context, use double backslashes (\\n).

## Content Quality & UX

- **HIERARCHY**: Every message should follow a clear structure:
  1. **Heading**: (e.g., 💰 Wallet Balance)
  2. **Content**: (e.g., Your current balance is: {{balance}})
- **DYNAMIC KEYBOARDS**: Always pass template data to keyboard builders if labels or counts are dynamic.
- **EMOJI STANDARDS**: Use emojis consistently to lead headings or highlight actions. Avoid "emoji spam" that distracts the user.
- **AUTHORITATIVE CONTENT**: Use clear, contextual, and professional language. Avoid ambiguous placeholders.
