---
title: "MockTelegramServer.stop()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [stop](./gramstax.mocktelegramserver.stop.md)

## MockTelegramServer.stop() method

Stop the mock server.

**Signature:**

```typescript
stop(options?: {
        clear?: boolean;
    }): Promise<void>;
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

&#123; clear?: boolean; &#125;


</td><td>

_(Optional)_


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;void&gt;

## Remarks

After calling this, the server is no longer reachable and must be started again with `start()`.

