---
title: "TemplateEngine._validateAnswerTextContent()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateEngine](./gramstax.templateengine.md) &gt; [\_validateAnswerTextContent](./gramstax.templateengine._validateanswertextcontent.md)

## TemplateEngine.\_validateAnswerTextContent() method

Validates plain-text content of answer blocks.

**Signature:**

```typescript
static _validateAnswerTextContent(template: string, tag: string, maxLength?: number | null): Array<{
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

The raw template source to inspect.


</td></tr>
<tr><td>

tag


</td><td>

string


</td><td>

The block tag name without brackets (e.g. `g-callback-answer`).


</td></tr>
<tr><td>

maxLength


</td><td>

number \| null


</td><td>

_(Optional)_ Optional static-length cap (or null to skip).


</td></tr>
</tbody></table>

**Returns:**

Array&lt;\{ line: number; message: string; }&gt;

Validation errors (empty when valid).

## Remarks

Answer payloads (`<g-callback-answer>`, `<g-precheckout-error>`, `<g-shipping-error>`) reach Telegram fields that accept no HTML (toast text, `error_message`), so any static markup tag inside the block body is rejected. `{{}}` / `{~ ~}` spans are stripped before checking (runtime data is the caller's responsibility, mirroring the `_validateDiceItems` static/dynamic split). When `maxLength` is set, the stripped static length is capped (toast text at most 200 chars per the Bot API `answerCallbackQuery` limits). Errors carry 1-based line numbers.

