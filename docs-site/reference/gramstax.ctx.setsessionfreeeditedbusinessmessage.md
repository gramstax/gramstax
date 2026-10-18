---
title: "Ctx.setSessionFreeEditedBusinessMessage()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [setSessionFreeEditedBusinessMessage](./gramstax.ctx.setsessionfreeeditedbusinessmessage.md)

## Ctx.setSessionFreeEditedBusinessMessage() method

Set the session method for `handleSessionFreeEditedBusinessMessage` routing.

**Signature:**

```typescript
setSessionFreeEditedBusinessMessage(this: Ctx & {
        handleSessionFreeEditedBusinessMessage: (...args: unknown[]) => unknown;
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

[Ctx](./gramstax.ctx.md) &amp; &#123; handleSessionFreeEditedBusinessMessage: (...args: unknown\[\]) =&gt; unknown; &#125;


</td><td>


</td></tr>
<tr><td>

params


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_ Optional session parameters stored alongside the method.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;boolean \| null&gt;

The `setSession` result, or null when no user/chat id is available.

## Remarks

Stores the key from [Ctx.methodSessionFreeEditedBusinessMessage()](./gramstax.ctx.methodsessionfreeeditedbusinessmessage.md) via [Ctx.setSession()](./gramstax.ctx.setsession.md). Subsequent updates of the matching listener type dispatch to the page's `handleSessionFreeEditedBusinessMessage` handler (routing id=1) until the session is cleared.

