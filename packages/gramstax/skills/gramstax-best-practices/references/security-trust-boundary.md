# security-trust-boundary

Templates are code; only `data` values are untrusted input. Never build template source from user input.

## Why

The engine compiles templates to executable functions (`<g-script>`, `<g-ifelse>`, `{~ ~}`, and generated interpolations all run). User input placed in `data` is inert by construction (proven by `security-poc/3-safe-data-binding.ts`); the same string concatenated into the template source becomes a `<g-script>` RCE (proven by `security-poc/4-untrusted-template-rce.ts`).

## Incorrect

```typescript
// DANGEROUS: user text becomes template source — <g-script> executes
const template = `<g-base><g-message>${userCustomMessage}</g-message></g-base>`
```

## Correct

```typescript
// user text travels as data — rendered literally, never executed
const template = `<g-base><g-message>{{customMessage}}</g-message></g-base>`
render({customMessage: userCustomMessage})
```

## Notes

- Static backticks, backslashes, and `${}` in template text cannot break out (concat codegen + static escaping — see `security-poc/1-`, `2-`, `5-`, `6-`, `7-`).
- Attribute values are embedded via `JSON.stringify` (`security-poc/9-`).
- Known parser limitation (robustness only): a raw `>` inside an attribute value can end tag matching early — fragments stay inert strings, never code.
