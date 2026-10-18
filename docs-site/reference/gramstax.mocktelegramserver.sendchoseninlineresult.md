---
title: "MockTelegramServer.sendChosenInlineResult()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [sendChosenInlineResult](./gramstax.mocktelegramserver.sendchoseninlineresult.md)

## MockTelegramServer.sendChosenInlineResult() method

Simulate a chosen inline result.

**Signature:**

```typescript
sendChosenInlineResult(resultId: string, query: string, options?: IMockTelegramUpdateOptions): Promise<IMockTelegramRequestRecord[]>;
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

resultId


</td><td>

string


</td><td>

The selected result identifier.


</td></tr>
<tr><td>

query


</td><td>

string


</td><td>

The query string that produced the result.


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

