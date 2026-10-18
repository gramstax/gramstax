

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IRouteAuto](./gramstax.irouteauto.md)

## IRouteAuto type

Route atom: runtime-decided single message.

**Signature:**

```typescript
type IRouteAuto = {
    mode?: `auto`;
    keyboard?: IInBoKb | null;
    rich?: IOptReplyRich[0] | null;
    richOptions?: IOptRich | null;
    options?: IOptReply | null;
    editOptions?: IOptEdit | null;
    fallbackOptions?: IOptReply | null;
    fallback?: IOptFallbackEdit;
    broadcast?: null | undefined;
    chunkSize?: null | undefined;
};
```
**References:** [IInBoKb](./gramstax.iinbokb.md), [IOptReplyRich](./gramstax.ioptreplyrich.md), [IOptRich](./gramstax.ioptrich.md), [IOptReply](./gramstax.ioptreply.md), [IOptEdit](./gramstax.ioptedit.md), [IOptFallbackEdit](./gramstax.ioptfallbackedit.md)

## Remarks

`auto` edits when the update carries a `callbackQuery`, otherwise replies — so `keyboard` may be inline OR bottom (the runtime picks the call). It is the only atom that reads every one of the ten universal route keys: `options` feeds the reply, `editOptions` the edit, `fallbackOptions` the resend after a failed edit, and `rich`/`richOptions` the rich payload and its edit-legal options.

