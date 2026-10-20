---
title: "DENIED_RPC_METHODS"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [DENIED\_RPC\_METHODS](./worker-thread.denied_rpc_methods.md)

## DENIED\_RPC\_METHODS variable

Method names that are never remotely callable, even when they resolve to a function on the register object. Covers prototype gadgets (`constructor` would expose the class) and the duplex plumbing (`send`/`request`/`kill`/gateway factories are outgoing-only APIs — `shutdown` and `readyResolve` stay allowed: they are the legitimate inbound lifecycle methods).

**Signature:**

```typescript
DENIED_RPC_METHODS: ReadonlySet<string>
```
