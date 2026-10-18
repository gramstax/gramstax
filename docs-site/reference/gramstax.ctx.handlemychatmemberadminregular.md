---
title: "Ctx.handleMyChatMemberAdminRegular()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleMyChatMemberAdminRegular](./gramstax.ctx.handlemychatmemberadminregular.md)

## Ctx.handleMyChatMemberAdminRegular() method

Bot is demoted from administrator.

**Signature:**

```typescript
/** @virtual */
handleMyChatMemberAdminRegular?(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

## Remarks

Triggered when the bot's own membership changes from `administrator`/`creator` back to `member`. Uses `myChatMemberFilter("admin", "regular")`.

