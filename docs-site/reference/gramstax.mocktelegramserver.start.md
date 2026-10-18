

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [MockTelegramServer](./gramstax.mocktelegramserver.md) &gt; [start](./gramstax.mocktelegramserver.start.md)

## MockTelegramServer.start() method

Start the mock server.

**Signature:**

```typescript
start(): Promise<string>;
```
**Returns:**

Promise&lt;string&gt;

The base API URL.

## Remarks

If already started, returns the existing `apiRoot` without restarting.

