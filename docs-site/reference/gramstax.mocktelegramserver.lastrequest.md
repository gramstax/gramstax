---
title: "MockTelegramServer.lastRequest()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [lastRequest](./gramstax.mocktelegramserver.lastrequest.md)

## MockTelegramServer.lastRequest() method

Get the most recent captured Bot API request.

**Signature:**

```typescript
lastRequest(method?: string): IMockTelegramRequestRecord | undefined;
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

method


</td><td>

string


</td><td>

_(Optional)_ Optional Telegram Bot API method name to filter by (e.g. `sendMessage`).


</td></tr>
</tbody></table>

**Returns:**

[IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md) \| undefined

The last matching request record, or `undefined` if none found.

## Remarks

When `method` is provided, searches backwards for the last request matching that method name. Without `method`, returns the absolute last request regardless of method.

