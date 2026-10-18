

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_PAGE\_REQUIRED\_ATTRS](./gramstax.templateengine._page_required_attrs.md)

## TemplateEngine.\_PAGE\_REQUIRED\_ATTRS property

Required-attribute specification for `<g-*>` PAGE blocks.

**Signature:**

```typescript
static _PAGE_REQUIRED_ATTRS: Record<string, string[] | {
        oneOf: string[][];
    }>;
```

## Remarks

Most PAGE block attributes are optional — there are no strictly required attributes. This spec is reserved for future use (e.g. context-dependent requirements). The shape mirrors [TemplateEngine.\_TELEGRAM\_REQUIRED\_ATTRS](./gramstax.templateengine._telegram_required_attrs.md): - `string[]` — every entry must be present - `{ oneOf: string[][] }` — at least one of the listed sets must be fully present

## Example


```typescript
TemplateEngine._PAGE_REQUIRED_ATTRS  // => {} (no strictly required attrs yet)
```

