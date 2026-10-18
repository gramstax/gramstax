---
title: "Ctx.methodSessionFreeMessageAutoDeleteTimerChanged()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [methodSessionFreeMessageAutoDeleteTimerChanged](./gramstax.ctx.methodsessionfreemessageautodeletetimerchanged.md)

## Ctx.methodSessionFreeMessageAutoDeleteTimerChanged() method

Session method key builder for `handleSessionFreeMessageAutoDeleteTimerChanged`.

**Signature:**

```typescript
methodSessionFreeMessageAutoDeleteTimerChanged(name?: string): string;
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

name


</td><td>

string


</td><td>

_(Optional)_ Optional page name override (defaults to the page data name).


</td></tr>
</tbody></table>

**Returns:**

string

The prefixed session method key (e.g. `1-PageName`).

## Remarks

Low-level: prefer the typed [Ctx.setSessionFreeMessageAutoDeleteTimerChanged()](./gramstax.ctx.setsessionfreemessageautodeletetimerchanged.md) helper. Used by session routing (id=1) to look up the active page for `handleSessionFreeMessageAutoDeleteTimerChanged`.

