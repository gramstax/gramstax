

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_compileToFunction](./gramstax.templateengine._compiletofunction.md)

## TemplateEngine.\_compileToFunction() method

Compiles a processed template body into a callable renderer.

**Signature:**

```typescript
static _compileToFunction<T extends boolean>(template: T extends true ? string[] : string, isArray: T): ITemplateRenderer<T>;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

template


</td><td>

T extends true ? string\[\] : string


</td><td>

Processed template source, or one source per language when `isArray` is `true`.


</td></tr>
<tr><td>

isArray


</td><td>

T


</td><td>

When `true`, compile to a renderer returning `string[]`.


</td></tr>
</tbody></table>

**Returns:**

ITemplateRenderer&lt;T&gt;

A renderer taking `data` and returning the compiled output.

## Exceptions

Error when `__linkHook` and `__emitHook` are both set, which would confuse the AOT collect and link phases.

## Remarks

Three mutually exclusive paths, in priority order: `__linkHook` resolves a pre-registered body (the AOT link phase, used by edge output with no `Function` constructor), `__emitHook` records the body and returns a stub (the AOT collect phase), otherwise the body is compiled through `new Function` — the exact JIT path taken when neither hook is set.

The compiled renderer closes over `_escapeData` and `DEFAULT_FILTERS`, so callers pass only `data`. `isArray` selects the return shape: `string[]` for media-group style templates, `string` otherwise.

