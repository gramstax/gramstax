---
title: "IRpcContext"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [IRpcContext](./worker-thread.irpccontext.md)

## IRpcContext type

Context object passed through the RPC middleware chain for incoming requests.

**Signature:**

```typescript
type IRpcContext = {
    method: string;
    params: unknown[];
    result?: unknown;
};
```

## Remarks

Middleware can mutate `params` before dispatch, short-circuit by setting `result` without calling `next`, or throw to reject the request.

