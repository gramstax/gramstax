---
title: "Ctx.methodSession()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [methodSession](./gramstax.ctx.methodsession.md)

## Ctx.methodSession() method

\[LOW-LEVEL\] Session method name builders.

**Signature:**

```typescript
methodSession(prefix: string, name: string | undefined): string;
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

prefix


</td><td>

string


</td><td>


</td></tr>
<tr><td>

name


</td><td>

string \| undefined


</td><td>


</td></tr>
</tbody></table>

**Returns:**

string

## Remarks

Low-level API. You rarely need to call these directly — the [Ctx.setSessionFreeText()](./gramstax.ctx.setsessionfreetext.md) (and siblings) already wire them internally.

These methods generate unique session method identifiers used by [Ctx.setSession()](./gramstax.ctx.setsession.md) and validation methods. Each `methodSession*` returns a prefixed string like `"1-PageName"`.

When you DO need to call them (multi-session with `setSession(array, ...)`), always use the typed helpers — never hardcode the prefix:

## Example


```typescript
// ✅ Correct
await this.setSession([this.methodSessionFreeText(), this.methodSessionFreeVideo()], {})

// ❌ Fragile — prefix `7` depends on the listener order
await this.setSession(["7-PageName", "8-PageName"], {})
```

