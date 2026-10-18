

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getGAnswerNote](./gramstax.templatemanager.getganswernote.md)

## TemplateManager.getGAnswerNote() method

Gets compiled text from block \<g-answer-note>.

**Signature:**

```typescript
getGAnswerNote(key: string, AGBaseId?: string, ALang?: string, data?: Record<string, unknown>): GAnswerNoteResult;
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

[GAnswerNoteResult](./gramstax.ganswernoteresult.md)

## Remarks

Strict lookup (mirrors `getGDice`): a missing block throws instead of returning an empty string, because guest and web app answers require the validation marker block.

