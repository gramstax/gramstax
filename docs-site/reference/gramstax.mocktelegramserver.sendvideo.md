

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendVideo](./gramstax.mocktelegramserver.sendvideo.md)

## MockTelegramServer.sendVideo() method

Simulate a user sending a video message.

**Signature:**

```typescript
sendVideo(options?: IMockTelegramMediaOptions): Promise<IMockTelegramRequestRecord[]>;
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

[IMockTelegramMediaOptions](./gramstax.imocktelegrammediaoptions.md)


</td><td>

_(Optional)_ Caption, user, chat, and timeout options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)\[\]&gt;

Array of captured Bot API responses.

