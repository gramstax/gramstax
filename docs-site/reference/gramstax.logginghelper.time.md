---
title: "LoggingHelper.time()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [LoggingHelper](./gramstax.logginghelper.md) &gt; [time](./gramstax.logginghelper.time.md)

## LoggingHelper.time() method

Start a timer with a custom label.

**Signature:**

```typescript
time(label: string): void;
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

label


</td><td>

string


</td><td>

Unique identifier for this timer. Used with `timeEnd()` to calculate duration.


</td></tr>
</tbody></table>

**Returns:**

void

## Example


```typescript
const logger = new LoggingHelper();

logger.time("db-query");
logger.time("api-call");
```

