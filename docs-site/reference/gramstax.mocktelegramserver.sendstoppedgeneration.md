---
title: "MockTelegramServer.sendStoppedGeneration()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendStoppedGeneration](./gramstax.mocktelegramserver.sendstoppedgeneration.md)

## MockTelegramServer.sendStoppedGeneration() method

Simulate a user stopping message generation (Bot API 10.3 `stopped_message_generation`).

**Signature:**

```typescript
sendStoppedGeneration(options?: IMockTelegramUpdateOptions & {
        chat?: IMockTelegramChat;
        draft_id?: number;
        message_thread_id?: number;
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

[IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md) &amp; &#123; chat?: [IMockTelegramChat](./gramstax.imocktelegramchat.md); draft\_id?: number; message\_thread\_id?: number; &#125;


</td><td>

_(Optional)_ Chat, draft and thread options


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)\[\]&gt;

Array of captured Bot API responses

