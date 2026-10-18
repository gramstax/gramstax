---
title: "Ctx.setSessionCallbackQueryData()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [setSessionCallbackQueryData](./gramstax.ctx.setsessioncallbackquerydata.md)

## Ctx.setSessionCallbackQueryData() method

Session set helper methods.

**Signature:**

```typescript
setSessionCallbackQueryData(this: Ctx & {
        handleSessionCallbackQueryData: (...args: unknown[]) => unknown;
    }, params?: Record<string, unknown>): Promise<boolean | null>;
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

this


</td><td>

[Ctx](./gramstax.ctx.md) &amp; &#123; handleSessionCallbackQueryData: (...args: unknown\[\]) =&gt; unknown; &#125;


</td><td>


</td></tr>
<tr><td>

params


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;boolean \| null&gt;

## Remarks

These methods are shortcuts for [Ctx.setSession()](./gramstax.ctx.setsession.md) with pre-built method names. Each `session*` method sets the session for the corresponding route handler.

## Example


```typescript
async handleCallbackQueryData() {
  // Set session input for `handleFreeText`
  await this.setSessionFreeText({data: "12345"})
  await this.renderText()
}
```

