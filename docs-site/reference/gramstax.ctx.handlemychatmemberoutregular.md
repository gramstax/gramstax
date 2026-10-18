---
title: "Ctx.handleMyChatMemberOutRegular()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [handleMyChatMemberOutRegular](./gramstax.ctx.handlemychatmemberoutregular.md)

## Ctx.handleMyChatMemberOutRegular() method

Bot is added to the chat as a regular member.

**Signature:**

```typescript
/** @virtual */
handleMyChatMemberOutRegular?(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

## Remarks

Triggered when the bot's own membership changes from an "out" status to `member` (non-administrator). Uses `myChatMemberFilter("out", "regular")`.

