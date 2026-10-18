

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGKeyboards](./gramstax.templateengine.compileblockgkeyboards.md)

## TemplateEngine.compileBlockGKeyboards() method

Compiles keyboard labels from a processed template, executing blocks and scope variables to produce final label arrays for inline/bottom keyboards.

**Signature:**

```typescript
static compileBlockGKeyboards(template: string, gBaseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: {
                inline?: (data?: ITemplateData) => string[];
                bottom?: (data?: ITemplateData) => string[];
            };
        };
    };
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

The processed template string containing `<g-keyboard>` blocks


</td></tr>
<tr><td>

gBaseBlocks


</td><td>

ReturnType&lt;typeof TemplateEngine.\_processGBaseBlocks&gt;


</td><td>

_(Optional)_ Optional pre-parsed base blocks (avoids re-parsing)


</td></tr>
</tbody></table>

**Returns:**

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: &#123; inline?: (data?: ITemplateData) =&gt; string\[\]; bottom?: (data?: ITemplateData) =&gt; string\[\]; &#125;; &#125;; &#125;

A nested record of compiled label functions keyed by base, lang, and mode

