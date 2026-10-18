

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [setSessionFreeChannelChatCreated](./gramstax.ctx.setsessionfreechannelchatcreated.md)

## Ctx.setSessionFreeChannelChatCreated() method

Set the session method for `handleSessionFreeChannelChatCreated` routing.

**Signature:**

```typescript
setSessionFreeChannelChatCreated(this: Ctx & {
        handleSessionFreeChannelChatCreated: (...args: unknown[]) => unknown;
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

[Ctx](./gramstax.ctx.md) &amp; &#123; handleSessionFreeChannelChatCreated: (...args: unknown\[\]) =&gt; unknown; &#125;


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

Stores the key from [Ctx.methodSessionFreeChannelChatCreated()](./gramstax.ctx.methodsessionfreechannelchatcreated.md) via [Ctx.setSession()](./gramstax.ctx.setsession.md). Subsequent updates of the matching listener type dispatch to the page's `handleSessionFreeChannelChatCreated` handler (routing id=1) until the session is cleared.

