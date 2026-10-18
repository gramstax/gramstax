---
title: "TemplateManager.handleWatchError()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [TemplateManager](./gramstax.templatemanager.md) &gt; [handleWatchError](./gramstax.templatemanager.handlewatcherror.md)

## TemplateManager.handleWatchError() method

Handles watcher errors.

**Signature:**

```typescript
/** @virtual */
handleWatchError(error: unknown): void;
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

error


</td><td>

unknown


</td><td>

The error object from the watcher


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Override this method in a subclass to implement custom error handling.

## Example


```typescript
this.handleWatchError(new Error("ENOENT"))
```

