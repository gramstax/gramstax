---
title: "WorkerThreadLaunch.request()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md) &gt; [request](./worker-thread.workerthreadlaunch.request.md)

## WorkerThreadLaunch.request() method

Make an RPC request to the worker thread.

**Signature:**

```typescript
request(method: string, params: unknown[], _wait?: boolean, _others?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
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

Method name to call in worker. Must exist on WorkerThreadInit.


</td></tr>
<tr><td>

params


</td><td>

unknown\[\]


</td><td>

Method parameters. Passed as array to worker method.


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

_(Optional)_ Optional timeout in milliseconds. Rejects the request when the worker does not respond in time.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;unknown&gt;

Promise resolving with worker response.

## Example


```typescript
const result = await worker.request("processData", [[1, 2, 3]]);
console.log("Result:", result);
```

