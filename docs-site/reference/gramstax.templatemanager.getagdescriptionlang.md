---
title: "TemplateManager.getAGDescriptionLang()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getAGDescriptionLang](./gramstax.templatemanager.getagdescriptionlang.md)

## TemplateManager.getAGDescriptionLang() method

Gets available attribute lang from block \<g-description>.

**Signature:**

```typescript
getAGDescriptionLang(key: string, AGBaseId?: string, AScope?: string): string[];
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

Template identifier (filename without extension)


</td></tr>
<tr><td>

AGBaseId


</td><td>

string


</td><td>

_(Optional)_ Base block ID matching `<g-base id="...">`


</td></tr>
<tr><td>

AScope


</td><td>

string


</td><td>

_(Optional)_ Telegram bot command scope


</td></tr>
</tbody></table>

**Returns:**

string\[\]

Array of language codes present for the scope

## Remarks

Useful for determining which languages are defined for a command description.

## Example


```typescript
const languages = tm.getAGDescriptionLang("start", "default", "default")
// => ["default", "en", "id"]
```

