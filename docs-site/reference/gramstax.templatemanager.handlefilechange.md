

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [handleFileChange](./gramstax.templatemanager.handlefilechange.md)

## TemplateManager.handleFileChange() method

Handles file change events from the watcher.

**Signature:**

```typescript
handleFileChange(filepath: string): void;
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

filepath


</td><td>

string


</td><td>

Full path to the changed file


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Recompiles the template when a watched file is modified. Only processes files with supported extensions.

## Example


```typescript
this.handleFileChange("/src/pages/welcome.html")
```

