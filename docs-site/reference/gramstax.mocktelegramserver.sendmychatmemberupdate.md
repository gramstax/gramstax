---
title: "MockTelegramServer.sendMyChatMemberUpdate()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendMyChatMemberUpdate](./gramstax.mocktelegramserver.sendmychatmemberupdate.md)

## MockTelegramServer.sendMyChatMemberUpdate() method

Simulate a bot membership status transition (my\_chat\_member).

**Signature:**

```typescript
sendMyChatMemberUpdate(options?: IMockTelegramUpdateOptions & {
        oldStatus?: string;
        newStatus?: string;
    }): Promise<IMockTelegramRequestRecord[]>;
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

[IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md) &amp; &#123; oldStatus?: string; newStatus?: string; &#125;


</td><td>

_(Optional)_ Old/new status plus user, chat, and timeout options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)\[\]&gt;

Array of captured Bot API responses.

