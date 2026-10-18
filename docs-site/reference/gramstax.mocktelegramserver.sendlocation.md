

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendLocation](./gramstax.mocktelegramserver.sendlocation.md)

## MockTelegramServer.sendLocation() method

Simulate a user sending a location message.

**Signature:**

```typescript
sendLocation(options?: IMockTelegramLocationOptions): Promise<IMockTelegramRequestRecord[]>;
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

[IMockTelegramLocationOptions](./gramstax.imocktelegramlocationoptions.md)


</td><td>

_(Optional)_ Latitude, longitude, user, chat, and timeout options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)\[\]&gt;

Array of captured Bot API responses.

