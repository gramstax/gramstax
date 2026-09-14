# template-logic

Conditionals live in templates (`<g-switch>`, `{~~}`, `<g-script>`); one base with toggles beats many near-identical bases.

## Why

Splitting small content variations across base ids multiplies keyboards, `g*` objects, and e2e cases for the same view. A conditional keeps one source of truth; separate bases are for fundamentally different layouts.

## Incorrect

```typescript
// three bases differing by one line — triple the keyboards, objects, tests
const template = `
  <g-base id="ok"><g-message>Paid</g-message></g-base>
  <g-base id="fail"><g-message>Failed</g-message></g-base>
`
```

## Correct

```typescript
const template = `
  <g-base><g-message><g-switch value="status"><g-case is="paid">Paid</g-case><g-default>Failed</g-default></g-switch></g-message></g-base>
`
```

## Notes

- Attribute values accept double-quoted, single-quoted, or bare syntax.
- `<g-switch value>` / `<g-case is>` mismatches render the `<g-default>` branch (or empty) — always provide one.
- Structural alternatives (different tags, whole paragraphs) belong in blocks; inline value swaps belong in scopes (see `template-scope.md`).
