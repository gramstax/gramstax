---
title: "WorkerThreadRpc.rejectAllPending()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadRpc](./worker-thread.workerthreadrpc.md) &gt; [rejectAllPending](./worker-thread.workerthreadrpc.rejectallpending.md)

## WorkerThreadRpc.rejectAllPending() method

Reject every pending request.

**Signature:**

```typescript
rejectAllPending(error: unknown): void;
```

## Parameters

<table><thead><tr><th>

Parameter


</th><th>

Type


</th><th>

Description


</th></tr></thead>
<tbody><tr><td>

error


</td><td>

unknown


</td><td>

Error to reject pending requests with.


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Used when the transport dies (e.g. worker thread exits) so callers do not hang forever. All pending entries are rejected and removed from the map.

## Example


```typescript
rpc.rejectAllPending(new Error("worker exited"));
```

