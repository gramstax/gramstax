

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [clearRequests](./gramstax.mocktelegramserver.clearrequests.md)

## MockTelegramServer.clearRequests() method

Clear the captured outbound Bot API request log.

**Signature:**

```typescript
clearRequests(): void;
```
**Returns:**

void

## Remarks

Useful between test cases to isolate request assertions. Does not affect the `updates` log.

