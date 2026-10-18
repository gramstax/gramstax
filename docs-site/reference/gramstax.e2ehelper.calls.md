---
title: "E2eHelper.calls"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [E2eHelper](./gramstax.e2ehelper.md) &gt; [calls](./gramstax.e2ehelper.calls.md)

## E2eHelper.calls property

All captured outbound Bot API calls (sendMessage, answerCallbackQuery, etc.).

**Signature:**

```typescript
calls: IE2eApiCall[];
```

## Remarks

Cleared automatically between tests. Each entry includes the API method, the parameters object, and a timestamp.

