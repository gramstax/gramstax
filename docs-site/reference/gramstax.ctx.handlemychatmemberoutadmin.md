

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleMyChatMemberOutAdmin](./gramstax.ctx.handlemychatmemberoutadmin.md)

## Ctx.handleMyChatMemberOutAdmin() method

Bot is added to the chat as an administrator.

**Signature:**

```typescript
/** @virtual */
handleMyChatMemberOutAdmin?(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

## Remarks

Triggered when the bot's own membership changes from an "out" status to `administrator`/`creator`. Uses `myChatMemberFilter("out", "admin")`.

