---
title: "WorkerThreadRpc.(constructor)"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadRpc](./worker-thread.workerthreadrpc.md) &gt; [(constructor)](./worker-thread.workerthreadrpc._constructor_.md)

## WorkerThreadRpc.(constructor)

Creates a new WorkerThreadRpc instance.

**Signature:**

```typescript
constructor(send: (data: Record<string, unknown>) => unknown, register: Record<string, (...args: never[]) => unknown>, options?: {
        maxMessageSize?: number;
        defaultTimeoutMs?: number;
    });
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

send


</td><td>

(data: Record&lt;string, unknown&gt;) =&gt; unknown


</td><td>

Function to send data. Called with RPC payload.


</td></tr>
<tr><td>

register


</td><td>

Record&lt;string, (...args: never\[\]) =&gt; unknown&gt;


</td><td>

Object with callable methods. Exposed RPC method map.


</td></tr>
<tr><td>

options


</td><td>

&#123; maxMessageSize?: number; defaultTimeoutMs?: number; &#125;


</td><td>

_(Optional)_ Optional settings (message-size cap, default timeout).


</td></tr>
</tbody></table>

