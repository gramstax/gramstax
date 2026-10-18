---
title: "TemplateManager.(constructor)"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [(constructor)](./gramstax.templatemanager._constructor_.md)

## TemplateManager.(constructor)

Creates a new TemplateManager instance.

**Signature:**

```typescript
constructor(options: ITemplateOptions);
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

options


</td><td>

[ITemplateOptions](./gramstax.itemplateoptions.md)


</td><td>

Configuration options for the template manager


</td></tr>
</tbody></table>

## Exceptions

Error if path is not a valid string array

Error if any path does not exist or is not a directory

## Remarks

The constructor validates paths, initializes watchers (if enabled), and loads all template files from the specified paths.

## Example


```typescript
const tm = new TemplateManager({
  path: [join(process.cwd(), "src", "pages")],
  enableWatch: true,
  watchOptions: {
    ignored: /node_modules/,
    persistent: true
  }
})
```

