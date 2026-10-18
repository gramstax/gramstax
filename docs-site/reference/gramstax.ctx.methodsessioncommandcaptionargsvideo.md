---
title: "Ctx.methodSessionCommandCaptionArgsVideo()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [methodSessionCommandCaptionArgsVideo](./gramstax.ctx.methodsessioncommandcaptionargsvideo.md)

## Ctx.methodSessionCommandCaptionArgsVideo() method

Session method key builder for `handleSessionCommandCaptionArgsVideo`.

**Signature:**

```typescript
methodSessionCommandCaptionArgsVideo(name?: string): string;
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

Low-level: prefer the typed [Ctx.setSessionCommandCaptionArgsVideo()](./gramstax.ctx.setsessioncommandcaptionargsvideo.md) helper. Used by session routing (id=1) to look up the active page for `handleSessionCommandCaptionArgsVideo`.

