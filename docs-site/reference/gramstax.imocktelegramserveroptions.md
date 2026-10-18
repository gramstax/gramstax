

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IMockTelegramServerOptions](./gramstax.imocktelegramserveroptions.md)

## IMockTelegramServerOptions type

Options for configuring the mock Telegram server.

**Signature:**

```typescript
type IMockTelegramServerOptions = {
    hostname?: string;
    port?: number;
    log?: IMockTelegramLog | boolean | null;
    handlers?: Record<string, IMockTelegramHandler>;
    defaultHandler?: IMockTelegramHandler;
};
```
**References:** [IMockTelegramHandler](./gramstax.imocktelegramhandler.md)

## Remarks

Use `handlers` to override specific methods, and `defaultHandler` as a fallback for any unmatched method.

## Example


```typescript
const options: IMockTelegramServerOptions = {
  port: 0,
  handlers: {
    getMe: () => ({ok: true, result: {is_bot: true}})
  }
}
```

