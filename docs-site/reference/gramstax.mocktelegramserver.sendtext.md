---
title: "MockTelegramServer.sendText()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendText](./gramstax.mocktelegramserver.sendtext.md)

## MockTelegramServer.sendText() method

Simulate a user sending a text message to the bot.

**Signature:**

```typescript
sendText(text: string, options?: IMockTelegramUpdateOptions): Promise<IMockTelegramRequestRecord[]>;
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

text


</td><td>

string


</td><td>

The message text to send.


</td></tr>
<tr><td>

options


</td><td>

[IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md)


</td><td>

_(Optional)_ User, chat, and timeout options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)\[\]&gt;

Array of captured Bot API responses from the bot under test.

## Remarks

Automatically adds `bot_command` entity if the text starts with `/`. Posts the update to the webhook and waits for outbound Bot API responses.

