---
title: "TemplateManager.getGWidgetAnswer()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getGWidgetAnswer](./gramstax.templatemanager.getgwidgetanswer.md)

## TemplateManager.getGWidgetAnswer() method

Gets compiled text from block \<g-widget-answer>.

**Signature:**

```typescript
getGWidgetAnswer(key: string, AGBaseId?: string, ALang?: string, data?: Record<string, unknown>): GWidgetAnswerResult;
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

[GWidgetAnswerResult](./gramstax.gwidgetanswerresult.md)

## Remarks

Strict lookup (mirrors `getGCallbackAnswer`): a missing block throws instead of returning an empty string, because widget answers always need data.

