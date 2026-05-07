# KEYBOARD AND LABEL RULES

## Reusable Keyboard Blocks (this.kbk)

- **CENTRALIZATION RULE**: Only define a keyboard block in this.kbk if it is used by **at least two** different pages.
- **SINGLE-USE**: For unique keyboards used only on one page, build them locally in the Helper class or directly in the handler.
- **PREMIUM LABELS**: Labels must be short, action-oriented, and lead with a relevant emoji (e.g., ✅ Confirm, ❌ Cancel).

## Keyboard Labels (this.kbl)

- **CONSISTENCY**: Use this.kbl to define labels that are shared across different states (Bases) within the same page or across different pages.
- **COMPOSITES**: Combine basic labels into reusable composite properties (e.g., static cancelHome = `❌ Cancel | 🏠 Home`).

## Maintenance & Duplication

- **NO HARDCODING**: Avoid duplicating literal strings across the project. Reference existing labels to maintain consistency.
- **INITIALIZATION**: Always define base properties _before_ derived properties to ensure the runtime can resolve dependencies correctly.
