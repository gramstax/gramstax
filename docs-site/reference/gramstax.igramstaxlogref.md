---
title: "IGramstaxLogRef"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxLogRef](./gramstax.igramstaxlogref.md)

## IGramstaxLogRef type

`log` slot: `true` for the default logger, `false`/omitted for silent, otherwise a path-ref (or logger options) resolving to a `LoggingHelper`.

**Signature:**

```typescript
type IGramstaxLogRef = boolean | IGramstaxPathRef | {
    pathFile?: string | null;
    force?: `console` | `file` | `all`;
    formatTime?: string;
};
```
**References:** [IGramstaxPathRef](./gramstax.igramstaxpathref.md)

## Remarks

Four accepted shapes (enforced by the loader): - a boolean (`true` mounts the default logger, `false` stays silent) - a module path string resolving to a `LoggingHelper` - an `{override: {module, export?, args?}}` ref resolving to a `LoggingHelper` - logger options `{pathFile?, force?, formatTime?}` — `pathFile` is a  string or `null`, `force` is one of `console`, `file`, `all`,  `formatTime` is a string. Unknown fields are rejected.

## Example


```typescript
const silent: IGramstaxLogRef = false
const file: IGramstaxLogRef = {pathFile: `./logs/bot.log`, force: `all`}
```

