# TEMPLATE RENDERING RULES

## Rendering Method Selection

- **DEFAULT TO `renderAuto*`**: Use the `renderAuto` family — `renderAuto()`, `renderAutoRich()`, `renderAutoMedia()`, `renderAutoMediaGroup()` — as the default way to render a page. It auto-detects from `!!this.callbackQuery`: edits the existing message in place when the handler is triggered by an inline keyboard callback, and sends a new message otherwise.
- **FORCED BEHAVIOR**: Use `render`/`renderEdit` (and `renderMedia*`/`renderEditMedia*`) only when the behavior must be forced regardless of update type — e.g. always send a fresh message, or always edit even without a callback query.
- **NO MANUAL BRANCHING**: Do not branch on `this.callbackQuery` yourself; `renderAuto*` already implements the edit-vs-reply decision.
- **FALLBACK EDIT**: The `fallbackEdit` parameter on `renderAuto*`/`renderEdit*` controls edit-failure behavior: `delete-reply` (default — delete the original message, then send a new one so it looks like an in-place edit), `reply` (send a new message without deleting), or `disable` (rethrow the error).

## View Logic

- **STRICT RULE**: All conditional rendering logic (if/else, switch) **MUST** reside within the template string.
- **SYNTAX**: Use Gramstax-specific blocks: {~ .. ~}, <g-switch>, or <g-script>.
- **DEDUPLICATION**: Instead of creating multiple Base IDs for small changes, use template conditionals to toggle content visibility within a single base.

## Syntax & Escaping

- **NO CONCATENATION**: Using the + operator inside {~ .. ~} is prohibited. Use template literals (backticks) for all string composition.
- **ESCAPING**: Backticks (`) and template interpolation (${}) must be escaped when nested inside template logic blocks in the TS source code.
- **NEWLINES**: When declaring multi-line strings within a template context, use double backslashes (\\n).

## Scope Efficiency — Values Only

- **STRICT RULE**: `{~ .. ~}` scopes MUST emit **only dynamic values**. All static text, labels, and formatting markup must remain OUTSIDE the scope as plain template HTML. Never render static markup inside a scope.

- **EXAMPLE**:

  ❌ **WRONG** — static markup duplicated inside the scope:

  ```html
  <p>{~deletedAt ? \`Deleted: <b>Yes</b>\` : \`Deleted: <b>No</b>\`~}</p>
  ```

  ✅ **RIGHT** — only the value varies:

  ```html
  <p>Deleted: <b>{~deletedAt ? "Yes" : "No"~}</b></p>
  ```

- **QUOTES**: Inside `{~ .. ~}`, prefer plain double quotes (`"Yes"`, `"no"`) for string literals — they are lint-safe within a template string and eliminate backtick/`${}` escaping noise.
- **WHY**: The scope compiles into one render function per block; keeping static markup outside produces smaller generated code (faster compile + render), keeps static text as a single visible source of truth in the markup (more maintainable), and avoids duplicated HTML across branches.
- **WHEN TO USE FULL BLOCKS INSTEAD**: When the alternatives differ in *structure* (different tags, multiple lines, whole paragraphs), do NOT stuff markup into a scope — use `<g-switch>`/`<g-case>`/`<g-default>` or `<g-script>` at the block level. Scopes are the tool for *inline values* only.

## Content Quality & UX

- **HIERARCHY**: Every message should follow a clear structure:
  1. **Heading**: (e.g., 💰 Wallet Balance)
  2. **Content**: (e.g., Your current balance is: {{balance}})
- **DYNAMIC KEYBOARDS**: Always pass template data to keyboard builders if labels or counts are dynamic.
- **EMOJI STANDARDS**: Use emojis consistently to lead headings or highlight actions. Avoid "emoji spam" that distracts the user.
- **AUTHORITATIVE CONTENT**: Use clear, contextual, and professional language. Avoid ambiguous placeholders.
