---
title: "TemplateEngine.compileBlockGAnswerNote()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGAnswerNote](./gramstax.templateengine.compileblockganswernote.md)

## TemplateEngine.compileBlockGAnswerNote() method

Compiles answer-note blocks from a template into executable functions.

**Signature:**

```typescript
static compileBlockGAnswerNote(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: (data?: ITemplateData) => string;
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

Raw template string containing `<g-base>` and `<g-answer-note>` blocks


</td></tr>
<tr><td>

baseBlocks


</td><td>

ReturnType&lt;typeof TemplateEngine.\_processGBaseBlocks&gt;


</td><td>

_(Optional)_ Optional pre-parsed base blocks for reuse


</td></tr>
</tbody></table>

**Returns:**

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: (data?: ITemplateData) =&gt; string; &#125;; &#125;

Compiled answer-note functions organized by base ID and language

## Remarks

This method parses `<g-answer-note>` blocks from the template and compiles them into functions that generate rendered note text. Same organization and pipeline as `compileBlockGCallbackAnswer`. The note is a validation marker for answers whose content comes from the caller.

## Example


```typescript
const compiled = TemplateEngine.compileBlockGAnswerNote(`<g-base><g-answer-note>Note {{kind}}</g-answer-note></g-base>`);
const text = compiled.default?.default?.({kind: `vip`});
// Result: 'Note vip'
```

