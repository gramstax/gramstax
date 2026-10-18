

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendGiftInfo](./gramstax.mocktelegramserver.sendgiftinfo.md)

## MockTelegramServer.sendGiftInfo() method

Simulate a message containing `UniqueGiftInfo` fields (Bot API 10.3 `text/entities/is_private`).

**Signature:**

```typescript
sendGiftInfo(giftInfo: Record<string, unknown>, options?: IMockTelegramUpdateOptions): Promise<IMockTelegramRequestRecord[]>;
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

giftInfo


</td><td>

Record&lt;string, unknown&gt;


</td><td>

Gift info payload


</td></tr>
<tr><td>

options


</td><td>

[IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md)


</td><td>

_(Optional)_ User, chat and response options


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)\[\]&gt;

Array of captured Bot API responses

