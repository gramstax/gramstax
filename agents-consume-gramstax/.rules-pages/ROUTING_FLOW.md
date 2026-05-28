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
- **FREE TEXT HANDLING**: Use this.isSessionFreeText() to verify if the incoming text is a response to a specific form step.
- **NO MANUAL FETCH**: Do not call getSession() manually. The framework injects the session into the context before the handler is executed.

### Method Placement

- **DATA PRECEDENCE**: If you need to manipulate data before rendering, use this.buildData. This logic **MUST** appear at the very beginning of your handler.
- **STATIC METHODS**: Prefer static methods in the Main class to handle transitions between steps.
