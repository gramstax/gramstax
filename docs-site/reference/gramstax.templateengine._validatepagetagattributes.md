

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validatePageTagAttributes](./gramstax.templateengine._validatepagetagattributes.md)

## TemplateEngine.\_validatePageTagAttributes() method

Scans a template for `<g-*>` PAGE blocks that are missing required attributes.

**Signature:**

```typescript
static _validatePageTagAttributes(template: string): Array<{
        line: number;
        message: string;
    }>;
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

string


</td><td>

The raw template string to scan


</td></tr>
</tbody></table>

**Returns:**

Array&lt;&#123; line: number; message: string; &#125;&gt;

Array of `{line, message}` errors (empty if all required attrs are present)

## Remarks

Iterates every opening tag in the template and, for any tag listed in [TemplateEngine.\_PAGE\_REQUIRED\_ATTRS](./gramstax.templateengine._page_required_attrs.md), checks that the required attribute set is fully present. Both value attributes (`href="..."`) and boolean attributes (`checked`, `reversed`, `open`) are recognized.

For tags with `oneOf` spec, at least one of the listed sets must be fully present. Returns one error per offending tag with the 1-based line number.

## Example


```typescript
const errors = TemplateEngine._validatePageTagAttributes(`<g-base id=""></g-base>`);
// => [{line: 1, message: "<g-base> is missing required attribute(s): id"}]  (if id is in spec)
```

