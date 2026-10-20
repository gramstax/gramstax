---
title: "WorkerThreadGatewayClient.close()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadGatewayClient](./worker-thread.workerthreadgatewayclient.md) &gt; [close](./worker-thread.workerthreadgatewayclient.close.md)

## WorkerThreadGatewayClient.close() method

Close the connection permanently.

**Signature:**

```typescript
close(): Promise<void>;
```
**Returns:**

Promise&lt;void&gt;

## Remarks

Disables auto-reconnect so the client will not attempt to reconnect. Pending requests are rejected so callers never hang. Tries a graceful close first, but force-destroys the socket if the graceful handshake does not finish within 500ms (e.g. the peer died mid-connect) — `close()` never hangs.

