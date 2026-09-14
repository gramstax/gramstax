# template-filters

Post-process display values with `{{var|filter:arg}}` pipes; chain left to right.

## Why

Pipes compile to chained calls once (zero per-render parsing) on a strict whitelist — formatting stays declarative in markup instead of leaking into handlers or scopes.

## Incorrect

```typescript
// formatting logic inside a scope — re-parsed every render, unquoted
const template = `<g-base><g-message>{~name.toUpperCase() + "!"~}</g-message></g-base>`
```

## Correct

```typescript
const template = `<g-base><g-message>{{name|upper}}! Joined {{createdAt|date:YYYY-MM-DD}} ({{count|plural:item:items}})</g-message></g-base>`
```

## Notes

- Filters: `upper`, `lower`, `number:<decimals>`, `date:<format>` (UTC `YYYY MM DD HH mm ss`), `plural:<one:many>`, chainable with `default:<fallback>`.
- `default` applies only to undefined/null/empty — `0` and `false` pass through.
- Works with dotted paths (`{{user.name|upper}}`) and raw output (`{{{var|filter}}}`); `{{}}` escaping still applies after filters.
