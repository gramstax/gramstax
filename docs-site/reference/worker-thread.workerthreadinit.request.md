---
title: "WorkerThreadInit.request()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadInit](./worker-thread.workerthreadinit.md) &gt; [request](./worker-thread.workerthreadinit.request.md)

## WorkerThreadInit.request() method

Make an RPC request to the main thread.

**Signature:**

```typescript
request(method: string, params: unknown[], _wait?: boolean, _others?: Record<string, unknown>, timeoutMs?: number): unknown;
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

method


</td><td>

string


</td><td>

Method name to call. Targets main-thread RPC method.


</td></tr>
<tr><td>

params


</td><td>

unknown\[\]


</td><td>

Method parameters. Sent as positional array.


</td></tr>
<tr><td>

\_wait


</td><td>

boolean


</td><td>

_(Optional)_ Wait for response. If false, fire-and-forget. Defaults to `true`.


</td></tr>
<tr><td>

\_others


</td><td>

Record&lt;string, unknown&gt;


</td><td>

_(Optional)_ Additional RPC data. Merged into RPC payload.


</td></tr>
<tr><td>

timeoutMs


</td><td>

number


</td><td>

_(Optional)_ Optional timeout in milliseconds. Rejects the request when the main thread does not respond in time.


</td></tr>
</tbody></table>

**Returns:**

unknown

Promise resolving with main-thread response.

## Example


```typescript
const result = await this.request("getConfig", ["key"]);
```

