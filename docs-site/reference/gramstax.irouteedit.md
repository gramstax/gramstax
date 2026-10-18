---
title: "IRouteEdit"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRouteEdit](./gramstax.irouteedit.md)

## IRouteEdit type

Route atom: forced edit of the message tied to the update.

**Signature:**

```typescript
type IRouteEdit = INeverFields<`options`> & {
    mode: `edit`;
    keyboard?: IInlineKb | null;
    rich?: IOptReplyRich[0] | null;
    richOptions?: IOptRich | null;
    editOptions?: IOptEdit | null;
    fallbackOptions?: IOptReply | null;
    fallback?: IOptFallbackEdit;
    broadcast?: null | undefined;
    chunkSize?: null | undefined;
};
```
**References:** [INeverFields](./gramstax.ineverfields.md), [IInlineKb](./gramstax.iinlinekb.md), [IOptReplyRich](./gramstax.ioptreplyrich.md), [IOptRich](./gramstax.ioptrich.md), [IOptEdit](./gramstax.ioptedit.md), [IOptReply](./gramstax.ioptreply.md), [IOptFallbackEdit](./gramstax.ioptfallbackedit.md)

## Remarks

The call always reaches `editMessageText`, so there is no send slot at all: `options` is never read, and the fallback resend draws its reply options from `fallbackOptions`.

