

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxTemplateManagerRef](./gramstax.igramstaxtemplatemanagerref.md)

## IGramstaxTemplateManagerRef type

`templateManager` slot: a path-ref to a `TemplateManager` subclass, or builtin `ITemplateOptions` passed to `new TemplateManager(params)`.

**Signature:**

```typescript
type IGramstaxTemplateManagerRef = IGramstaxPathRef | ITemplateOptions;
```
**References:** [IGramstaxPathRef](./gramstax.igramstaxpathref.md), [ITemplateOptions](./gramstax.itemplateoptions.md)

## Remarks

Three accepted shapes (enforced by the loader): - a module path string resolving to a `TemplateManager` subclass - an `{override: {module, export?, args?}}` ref resolving to a `TemplateManager` subclass - builtin template options (`path`, `enableWatch?`, `watchOptions?`, `onReload?`)  passed to `new TemplateManager(params)` — `path` must be a non-empty  array of non-empty strings, `enableWatch` a boolean, `watchOptions` an  object, `onReload` a function. Unknown fields are rejected.

## Example


```typescript
const fromPath: IGramstaxTemplateManagerRef = `./src/templates.ts`
const builtin: IGramstaxTemplateManagerRef = {path: [`./src/pages`], enableWatch: true}
```

