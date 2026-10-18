---
title: "TemplateManager.write()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [write](./gramstax.templatemanager.write.md)

## TemplateManager.write() method

Writes a template to file and updates the cache.

**Signature:**

```typescript
write(filename: string, template: string): Promise<boolean | null>;
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

filename


</td><td>

string


</td><td>

Target filename with `.html` extension


</td></tr>
<tr><td>

template


</td><td>

string


</td><td>

Template string content to write


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;boolean \| null&gt;

`true` if file was written, `null` if file not found or invalid extension

## Remarks

Only `.html` files are supported for writing. The method searches all configured paths for an existing file and updates it in place. After writing, the template is recompiled and cached.

## Example


```typescript
const success = await tm.write("welcome.html", newTemplateContent)
if (success) {
  console.log("Template updated")
}
```

