

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Ctx](./gramstax.ctx.md) &gt; [onSendError](./gramstax.ctx.onsenderror.md)

## Ctx.onSendError property

Best-effort send-error hook (Q9 option b).

**Signature:**

```typescript
onSendError?: ISendErrorHook | null;
```

## Remarks

Set from `ICtxParams.onSendError` (mirrors the `log` channel). Invoked with `{page, kind, chatId}` at every classified send error; a throwing hook is swallowed. Validation throws stay hook-free.

