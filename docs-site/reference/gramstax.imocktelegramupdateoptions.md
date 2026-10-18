

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IMockTelegramUpdateOptions](./gramstax.imocktelegramupdateoptions.md)

## IMockTelegramUpdateOptions type

Shared options for generated mock updates.

**Signature:**

```typescript
type IMockTelegramUpdateOptions = {
    user?: IMockTelegramUser;
    chat?: IMockTelegramChat;
    date?: number;
    message_id?: number;
    responseTimeoutMs?: number;
};
```
**References:** [IMockTelegramUser](./gramstax.imocktelegramuser.md), [IMockTelegramChat](./gramstax.imocktelegramchat.md)

## Remarks

Base options object passed to all `send*` helper methods on `MockTelegramServer`. Controls the simulated user, chat context, and response wait behavior.

