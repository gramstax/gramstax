

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [clearUpdates](./gramstax.mocktelegramserver.clearupdates.md)

## MockTelegramServer.clearUpdates() method

Clear the captured inbound update log.

**Signature:**

```typescript
clearUpdates(): void;
```
**Returns:**

void

## Remarks

Useful between test cases to isolate update assertions. Does not affect the `requests` log.

