---
title: "Ctx.sendChatId()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [sendChatId](./gramstax.ctx.sendchatid.md)

## Ctx.sendChatId() method

Best-effort current chat id for send-error context only.

**Signature:**

```typescript
sendChatId(): number | undefined;
```
**Returns:**

number \| undefined

The current chat id, or `undefined` when the update carries no chat.

## Remarks

Routing never uses this helper: single-sends go through context-aware `this.replyWith*` and broadcasts carry explicit recipient ids. It remains solely for `notifySendError`/log payloads.

