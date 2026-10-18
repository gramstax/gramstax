

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [handleFileDelete](./gramstax.templatemanager.handlefiledelete.md)

## TemplateManager.handleFileDelete() method

Handles file delete events from the watcher.

**Signature:**

```typescript
handleFileDelete(filepath: string): void;
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

Full path to the deleted file


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Removes the compiled template from cache when its source file is deleted.

## Example


```typescript
this.handleFileDelete("/src/pages/old-page.html")
```

