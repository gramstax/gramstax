# template-scope

`{~ ~}` scopes compute a value with JavaScript, and that makes them **JIT-only** — every scope emits `with(`, which fails `gramstax build`. For anything that must survive the edge, compute in the page class and interpolate with `{{}}`, or branch with `<g-ifelse>`.

## Why

`_processScopeExec` wraps every scope body in a `with(data || {})` retry so bare identifiers resolve against `data`. That retry is emitted unconditionally, so **every** `{~~ ... ~~}` puts `with(` in the compiled body — conditional or not:

```text
AOT blocked for template "<key>" (fn0): body contains `with(` — `with` is forbidden in ESM strict mode
```

Verified for `{~ i + 1 ~}`, `{~ (rss / 1048576).toFixed(1)~}`, and `{~ deletedAt ? "Yes" : "No"~}` — all three fail the build identically.

This is the worst failure split: the scope renders fine under `gramstax start`, so the template works in dev and kills the deploy.

## Incorrect

```typescript
// any scope — hard AOT build failure, see template-aot.md
const template = `<g-base><g-message><p>Deleted: <b>{~deletedAt ? "Yes" : "No"~}</b></p></g-message></g-base>`
```

```typescript
// static markup duplicated per branch, backtick escaping noise
const template = `<g-base><g-message><p>{~deletedAt ? \`Deleted: <b>Yes</b>\` : \`Deleted: <b>No</b>\`~}</p></g-message></g-base>`
```

## Correct

```html
<!-- AOT-safe conditional: optional `data` reads, no `with` -->
<g-message><p>Deleted: <b><g-ifelse>deletedAt ? "Yes" : "No"</g-ifelse></b></p></g-message>
```

```typescript
// AOT-safe value computation: page class returns plain data, template emits it
export class StatusPage extends PageBase {
  helper_rss() {
    const rss = process.memoryUsage().rss
    return (rss / 1048576).toFixed(1)
  }
}
```

```html
<g-message><p>RSS: {{rss}} MB</p></g-message>
```

## Choosing between them

| Need | Use | AOT-safe |
| --- | --- | --- |
| pick between values | `<g-ifelse>test ? a : b</g-ifelse>` | yes |
| fallback for a missing value | `<g-ifelse>name \|\| "Unknown"</g-ifelse>` | yes |
| format a value for display | `{{var\|filter:arg}}` — see `template-filters.md` | yes |
| arithmetic, indexing, `Number()`/`String()`/method calls | page-class helper, then `{{value}}` | yes |
| branch over markup or block children | `<g-switch>` at block level | yes |
| one-off JS during local dev only | `{~ expr ~}` | **no** |

## Notes

- Inside `<g-ifelse>` compose with `+`; `${}` in a template literal is rejected.
- Scopes emit raw output — not `{{}}`-escaped.
- Multi-line strings inside template contexts use double backslashes (`\\n`).
- See `template-logic.md` for the four `<g-ifelse>` body rules.