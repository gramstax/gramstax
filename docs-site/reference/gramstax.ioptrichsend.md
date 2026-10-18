

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IOptRichSend](./gramstax.ioptrichsend.md)

## IOptRichSend type

Rich-send options — the options bag of `replyWithRichMessage` alone.

**Signature:**

```typescript
type IOptRichSend = NonNullable<IOptReplyRich[1]>;
```
**References:** [IOptReplyRich](./gramstax.ioptreplyrich.md)

## Remarks

The narrow counterpart of [IOptRich](./gramstax.ioptrich.md), for routes that can only ever make the rich SEND: reply, chunked and broadcast-send. Without it those routes would have no field for the rich call's options at all, and the runtime would have to drop them.

