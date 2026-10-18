---
title: "Ctx.sessionKey()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [sessionKey](./gramstax.ctx.sessionkey.md)

## Ctx.sessionKey() method

Builds the cache key that scopes this session.

**Signature:**

```typescript
sessionKey(): string;
```
**Returns:**

string

The `userId:chatId` session cache key.

## Remarks

Keyed by user id \*\*and\*\* chat id so the same user in two chats keeps two independent sessions — a private chat and a group must not share pending state. The userless case (channel posts, anonymous admins) degrades to `:chatId`, which still scopes by chat instead of collapsing every userless update into one shared bucket.

A missing chat id yields an empty second segment rather than throwing, so private chats still key on the user alone.

