# security-output-encoding

`{{var}}` HTML-escapes; `{{{var}}}` is raw by design — never mix them up.

## Why

`{{bio}}` renders `<script>` as `&lt;script&gt;`, safe for Telegram clients. `{{{bio}}}` passes markup through untouched for trusted content (proven by `security-poc/8-xss-escaping.ts`). Reaching for raw output "to fix formatting" turns every user field into stored HTML injection.

## Incorrect

```typescript
// raw output over untrusted data — stored markup injection
const template = `<g-base><g-message>Hi {{{username}}}</g-message></g-base>`
```

## Correct

```typescript
// escaped by default; raw only for developer-authored markup
const template = `<g-base><g-message>Hi {{username}}!</g-message><g-message>Board: {{{rulesHtml}}}</g-message></g-base>`
```

## Notes

- Escaped chars: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;` (`_escapeData`).
- `{{var|filter}}` pipes run after resolution on a strict whitelist — unknown filters render empty with a compile-time warning, never arbitrary code.
- `default` applies only to undefined/null/empty (`0` and `false` pass through); `number` renders empty for non-numeric input (never `NaN`).
