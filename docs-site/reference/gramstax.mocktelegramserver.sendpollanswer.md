---
title: "MockTelegramServer.sendPollAnswer()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendPollAnswer](./gramstax.mocktelegramserver.sendpollanswer.md)

## MockTelegramServer.sendPollAnswer() method

Simulate a user answering a poll.

**Signature:**

```typescript
sendPollAnswer(pollId: string, optionIds: number[], options?: IMockTelegramUpdateOptions): Promise<IMockTelegramRequestRecord[]>;
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

pollId


</td><td>

string


</td><td>

The poll identifier.


</td></tr>
<tr><td>

optionIds


</td><td>

number\[\]


</td><td>

Selected option indexes.


</td></tr>
<tr><td>

options


</td><td>

[IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md)


</td><td>

_(Optional)_ User and timeout options.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)\[\]&gt;

Array of captured Bot API responses.

