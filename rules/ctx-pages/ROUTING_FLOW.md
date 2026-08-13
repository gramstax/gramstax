# ROUTING AND LOGIC FLOW RULES

## Design Strategy: "Inline First"

Gramstax is built for high-conversion, interactive bot experiences.

- **PRIORITIZE**: Inline keyboard navigation and session-driven state machines.
- **MINIMIZE**: Avoid slash commands (e.g., /settings) if the user can reach the same goal through an intuitive inline flow.

## Architectural Constraints

### Logic vs. View Separation

- **STRICT RULE**: Never write UI tags (e.g., <b>, <i>) or content-heavy strings directly in page logic functions.
- **EXCEPTION**: Small labels or identifiers are allowed, but the bulk of the content **MUST** live in the static template.

### Session Management

- **MANDATORY**: Clear the user session on the start.ts page to ensure every new interaction starts from a clean slate.
- **FREE TEXT HANDLING**: Use handleSessionFreeText() to verify if the incoming text is a response to a specific form step.
- **NO MANUAL FETCH**: Do not call getSession() manually. The framework injects the session into the context before the handler is executed.

### Callback Query Response Pattern

- **PREFER `renderAuto`**: For any page render, use the `renderAuto*` family — `renderAuto()`, `renderAutoRich()`, `renderAutoMedia()`, `renderAutoMediaGroup()` — unless an explicit forced send or forced edit is required. `renderAuto*` auto-detects the correct behavior from `!!this.callbackQuery`: it edits the existing message in place when triggered by an inline keyboard callback, and sends a new message otherwise.
- **MANUAL METHODS ARE THE EXCEPTION**: Use `render`/`renderEdit` (and their `renderMedia*`/`renderEditMedia*` variants) only when you explicitly need to force one behavior regardless of update type — e.g. always send a fresh message, or always edit even without a callback query.
- **FALLBACK EDIT**: `renderAuto*` and `renderEdit*` accept a `fallbackEdit` parameter that controls what happens when the edit fails: `delete-reply` (default — deletes the original message and sends a new one, so it looks like an in-place edit), `reply` (sends a new message without deleting), or `disable` (rethrows the error).
- **NO MANUAL BRANCHING**: Do not write `if (this.callbackQuery) { renderEdit() } else { render() }` yourself — that is exactly what `renderAuto*` already does. Manual branching duplicates framework logic and drifts when the framework evolves.
- **REPLY IS FOR FREE TEXT**: Reserve `ctx.reply()` and similar low-level `reply*` methods for handlers triggered by user text input (e.g., `handleSessionFreeText`, `process{NameBase}`), where sending a new message is appropriate. Note that `process{NameBase}` is optional and only defined when the paired `show{NameBase}` expects an answer.
- **RATIONALE**: Editing the existing message keeps the conversation contextual and avoids message sprawl. Replying to a callback query with a new message creates duplicate or orphaned messages that confuse users. `renderAuto*` gives you this behavior for free without forcing you to reason about update types.

### Method Placement

- **DATA PRECEDENCE**: If you need to manipulate data before rendering, use this.buildData. This logic **MUST** appear at the very beginning of your handler.
- **b\* OBJECTS**: Encapsulate step transitions and rendering logic inside `b<name>` objects (`bdefault.show()`, `bstep.process()`). Handler methods on the Page class MUST be thin wrappers that delegate to the appropriate `b<*>` method and contain no core business logic.
