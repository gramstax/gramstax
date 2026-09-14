# template-scope

`{~ ~}` scopes emit values only — static markup stays outside, literals use double quotes.

## Why

The scope compiles into the render function; markup duplicated inside branches bloats generated code and splits the visible source of truth. Plain double-quoted literals avoid backtick/`${}` escaping noise inside TS template strings.

## Incorrect

```typescript
// static markup duplicated per branch, backtick escaping noise
const template = `<g-base><g-message><p>{~deletedAt ? \`Deleted: <b>Yes</b>\` : \`Deleted: <b>No</b>\`~}</p></g-message></g-base>`
```

## Correct

```typescript
// only the value varies; markup stays visible in the template
const template = `<g-base><g-message><p>Deleted: <b>{~deletedAt ? "Yes" : "No"~}</b></p></g-message></g-base>`
```

## Notes

- No `+` concatenation inside scopes — compose with template literals when needed.
- Multi-line strings inside template contexts use double backslashes (`\\n`).
- When alternatives differ in structure (not just values), use `<g-switch>` at block level instead.
