

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IMockTelegramRequestRecord](./gramstax.imocktelegramrequestrecord.md)

## IMockTelegramRequestRecord type

Recorded outbound Bot API request captured by the mock server.

**Signature:**

```typescript
type IMockTelegramRequestRecord = {
    method: string;
    body: unknown;
    url: string;
    requestMethod: string;
    headers: Record<string, string>;
};
```

## Remarks

Each entry represents one HTTP request made by the bot under test to the mock server. Access via `mockServer.requests` or `mockServer.lastRequest(method)`.

