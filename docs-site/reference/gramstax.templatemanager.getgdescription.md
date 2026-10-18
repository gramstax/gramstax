

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getGDescription](./gramstax.templatemanager.getgdescription.md)

## TemplateManager.getGDescription() method

Gets a command description for Telegram menu.

**Signature:**

```typescript
getGDescription(key: string, AGBaseId?: string, ALang?: string, AScope?: string, data?: Record<string, unknown>): GDescriptionResult;
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

ALang


</td><td>

string


</td><td>

_(Optional)_ Target language code (falls back to `default`)


</td></tr>
<tr><td>

AScope


</td><td>

string


</td><td>

_(Optional)_ Telegram bot command scope (e.g., `default`, `admin`)


</td></tr>
<tr><td>

data


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_ Template variables for interpolation


</td></tr>
</tbody></table>

**Returns:**

[GDescriptionResult](./gramstax.gdescriptionresult.md)

[GDescriptionResult](./gramstax.gdescriptionresult.md) — rendered text, or `{text: ""}` when not found

## Remarks

Retrieves the compiled description function for the specified template, scope, and language, then executes it with the provided data. Failures are swallowed to the empty-text result, preserving the historical fallback contract.

## Example


```typescript
const desc = tm.getGDescription("start", "default", "en")
// => {kind: "description", text: "Start the bot"}
```

