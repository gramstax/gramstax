---
title: "TemplateEngine.compileBlockGPoll()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [compileBlockGPoll](./gramstax.templateengine.compileblockgpoll.md)

## TemplateEngine.compileBlockGPoll() method

Compiles poll blocks from a template into executable functions.

**Signature:**

```typescript
static compileBlockGPoll(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>): {
        [AGBaseId: string]: {
            [ALang: string]: (data?: ITemplateData) => IPollBlock;
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

Raw template string containing `<g-base>` and `<g-poll>` blocks


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

&#123; \[AGBaseId: string\]: &#123; \[ALang: string\]: (data?: ITemplateData) =&gt; [IPollBlock](./gramstax.ipollblock.md); &#125;; &#125;

Compiled poll functions organized by base ID and language

## Remarks

Parses `<g-poll>` blocks per base and compiles `question`, each `option`, and `explanation` through the same pipeline as media captions (script → map → switch → exec → variables), so `{{var|filter}}` works in all three. Static fields (`type`, `correct`, `anonymous`, `multiple`) pass through untouched.

## Example


```typescript
const polls = TemplateEngine.compileBlockGPoll(`<g-base><g-poll><g-question>Hi {{name}}?</g-question><g-option>Yes</g-option><g-option>No</g-option></g-poll></g-base>`);
const result = polls.default?.default?.({ name: 'Jo' });
// Result: { type: 'regular', question: 'Hi Jo?', options: ['Yes', 'No'], anonymous: true }
```

