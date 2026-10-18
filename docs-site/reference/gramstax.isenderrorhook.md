---
title: "ISendErrorHook"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [ISendErrorHook](./gramstax.isenderrorhook.md)

## ISendErrorHook type

Best-effort send-error hook.

**Signature:**

```typescript
type ISendErrorHook = (err: unknown, info: ISendErrorInfo) => void;
```
**References:** [ISendErrorInfo](./gramstax.isenderrorinfo.md)

## Remarks

Invoked at every site where a send error is classified via `Ctx.classifySendError` — both `fallback-text` and `retryable` outcomes. Pre-upload validation throws are programmer errors and stay hook-free. A throwing hook is swallowed and never breaks the send flow.

