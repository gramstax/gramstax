---
title: "WorkerThreadInit.gatewayClients"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadInit](./worker-thread.workerthreadinit.md) &gt; [gatewayClients](./worker-thread.workerthreadinit.gatewayclients.md)

## WorkerThreadInit.gatewayClients property

Map of gateway clients for inter-worker communication.

**Signature:**

```typescript
gatewayClients: Map<string, WorkerThreadGatewayClient>;
```

## Remarks

Values are [WorkerThreadGatewayClient](./worker-thread.workerthreadgatewayclient.md) instances keyed by server path.

