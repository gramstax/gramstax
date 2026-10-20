---
title: "TemplateManager.getGWebAppAnswer()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getGWebAppAnswer](./gramstax.templatemanager.getgwebappanswer.md)

## TemplateManager.getGWebAppAnswer() method

Gets compiled text from block \<g-web-app-answer>.

**Signature:**

```typescript
getGWebAppAnswer(key: string, AGBaseId?: string, ALang?: string, data?: Record<string, unknown>): GWebAppAnswerResult;
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

key


</td><td>

string


</td><td>


</td></tr>
<tr><td>

AGBaseId


</td><td>

string


</td><td>

_(Optional)_


</td></tr>
<tr><td>

ALang


</td><td>

string


</td><td>

_(Optional)_


</td></tr>
<tr><td>

data


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_


</td></tr>
</tbody></table>

**Returns:**

[GWebAppAnswerResult](./gramstax.gwebappanswerresult.md)

## Remarks

Strict lookup with a legacy fallback, resolved per base: for the requested `AGBaseId`, `<g-web-app-answer>` wins over `<g-answer-note>`; if that base has neither, the same two-step lookup repeats on the `default` base. A template that has neither block in either base throws.

