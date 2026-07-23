# BASE BLOCK RULES

## Identification Strategy

- **OMISSION**: If a page has only one <g-base> block, do not provide an id.
- **EXPLICIT IDS**: Use base IDs only when the page switches between fundamentally different layouts or views.
- **CONSOLIDATION**: Merge base blocks that share the same keyboard structure by using template conditionals for the message content.

## Naming Conventions

- **BASE ID**: Follow the pattern s + stepNumber (e.g., s1, s2).
- **EXTENSIONS**: You may add context for clarity (e.g., s1-form, s1-success).
- **STATIC CONSTANTS**: Always define Base IDs as static properties in an internal `Base` class for type-safe referencing.

## b\* Object Convention

Each `<g-base>` block must have a corresponding `b<name>` object on the Page class:

- **No `id`** → `bdefault` (single-base page)
- **`id="s1"`** → `bs1`
- **`id="amount"`** → `bamount`

## Usage Example

```typescript
class Base {
  static step1 = `s1`
  static error = `e`
}

// In Template:
// <g-base id="${Base.step1}">...</g-base>
// <g-base id="${Base.error}">...</g-base>
```
