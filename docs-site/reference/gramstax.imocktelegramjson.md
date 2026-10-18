

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IMockTelegramJson](./gramstax.imocktelegramjson.md)

## IMockTelegramJson type

Telegram JSON response shape for mock server responses.

**Signature:**

```typescript
type IMockTelegramJson = {
    ok: boolean;
    result?: unknown;
    description?: string;
};
```

## Remarks

This is the minimal Bot API response contract used by the mock server: `ok` indicates success and `result` contains the payload.

## Example


```typescript
const response: IMockTelegramJson = {ok: true, result: {foo: `bar`}}
```

