

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [getAGDescriptionScopes](./gramstax.templatemanager.getagdescriptionscopes.md)

## TemplateManager.getAGDescriptionScopes() method

Gets available attribute scopes from block \<g-description>.

**Signature:**

```typescript
getAGDescriptionScopes(key: string, AGBaseId?: string): string[];
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
</tbody></table>

**Returns:**

string\[\]

Array of scope keys for the description

## Remarks

Useful for determining which scopes are defined for a command.

## Example


```typescript
const scopes = tm.getAGDescriptionScopes("start", "default")
// => ["default", "admin"]
```

