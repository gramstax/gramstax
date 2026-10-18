

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [sendMyChatMemberUpdate](./gramstax.e2ehelper.sendmychatmemberupdate.md)

## E2eHelper.sendMyChatMemberUpdate() method

Simulate the bot's own chat member status transition (`my_chat_member` update).

**Signature:**

```typescript
sendMyChatMemberUpdate(options?: IE2eChatMemberOptions): Promise<IE2eApiCall[]>;
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

[IE2eChatMemberOptions](./gramstax.ie2echatmemberoptions.md)


</td><td>

_(Optional)_ Old/new statuses and chat configuration.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IE2eApiCall](./gramstax.ie2eapicall.md)\[\]&gt;

API calls made while processing this update.

## Remarks

Fires `myChatMemberFilter` handlers on pages that define corresponding `handleMyChatMember*` methods. Use this to test bot promotion/demotion scenarios.

## Example


```typescript
// Simulate bot being promoted to admin
await e2e.sendMyChatMemberUpdate({oldStatus: "member", newStatus: "administrator"})
```

