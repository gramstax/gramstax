---
title: "IGatewayServerOptions"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [IGatewayServerOptions](./worker-thread.igatewayserveroptions.md)

## IGatewayServerOptions type

Options for starting a gateway server.

**Signature:**

```typescript
type IGatewayServerOptions = {
    token?: string;
    allowedMethods?: string[];
    maxConnections?: number;
    maxMessageSize?: number;
};
```

## Remarks

Auth and method allow-lists are enforced per connection on the server side.

