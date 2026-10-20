---
title: "IRpcMiddleware"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [IRpcMiddleware](./worker-thread.irpcmiddleware.md)

## IRpcMiddleware type

Middleware function for intercepting incoming RPC requests.

**Signature:**

```typescript
type IRpcMiddleware = (ctx: IRpcContext, next: () => Promise<void>) => Promise<void>;
```
**References:** [IRpcContext](./worker-thread.irpccontext.md)

