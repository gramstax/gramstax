---
title: "TemplateManager.validateTemplate()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [validateTemplate](./gramstax.templatemanager.validatetemplate.md)

## TemplateManager.validateTemplate() method

Validates template syntax and throws a descriptive error on failure.

The error message includes the enclosing `<g-base id="...">` based on the error line. If the `<g-base>` has no `id` or no `<g-base>` tag is found, the `on base` prefix is omitted.

**Signature:**

```typescript
validateTemplate(AGBaseId: string, template: string, filename?: string): void;
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

AGBaseId


</td><td>

string


</td><td>

Cache key (filename without extension), used as default filename


</td></tr>
<tr><td>

template


</td><td>

string


</td><td>

Template content to validate


</td></tr>
<tr><td>

filename


</td><td>

string


</td><td>

_(Optional)_ Source filename with extension, shown in error location


</td></tr>
</tbody></table>

**Returns:**

void

## Exceptions

Error with format: `Template on base "${id}" (file, line X): msg` or `Template (file, line X): msg`

## Example


```typescript
// base with id:
this.validateTemplate("start", '<g-base id="kb"><kop/></g-base>', "start.html")
// => throws: Template on base "kb" (start.html, line 1): Unsupported template block: <kop>

// base without id:
this.validateTemplate("start", '<g-base><kop/></g-base>', "start.html")
// => throws: Template (start.html, line 1): Unsupported template block: <kop>
```

