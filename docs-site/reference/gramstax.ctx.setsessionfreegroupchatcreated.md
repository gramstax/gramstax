

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [setSessionFreeGroupChatCreated](./gramstax.ctx.setsessionfreegroupchatcreated.md)

## Ctx.setSessionFreeGroupChatCreated() method

Set the session method for `handleSessionFreeGroupChatCreated` routing.

**Signature:**

```typescript
setSessionFreeGroupChatCreated(this: Ctx & {
        handleSessionFreeGroupChatCreated: (...args: unknown[]) => unknown;
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

[Ctx](./gramstax.ctx.md) &amp; &#123; handleSessionFreeGroupChatCreated: (...args: unknown\[\]) =&gt; unknown; &#125;


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

Stores the key from [Ctx.methodSessionFreeGroupChatCreated()](./gramstax.ctx.methodsessionfreegroupchatcreated.md) via [Ctx.setSession()](./gramstax.ctx.setsession.md). Subsequent updates of the matching listener type dispatch to the page's `handleSessionFreeGroupChatCreated` handler (routing id=1) until the session is cleared.

