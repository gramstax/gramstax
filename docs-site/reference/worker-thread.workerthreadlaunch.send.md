---
title: "WorkerThreadLaunch.send()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md) &gt; [send](./worker-thread.workerthreadlaunch.send.md)

## WorkerThreadLaunch.send() method

Send a message to the worker thread.

**Signature:**

```typescript
send(payload: Record<string, unknown>): void;
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

payload


</td><td>

Record&lt;string, unknown&gt;


</td><td>

Data to send. Sent to worker thread.


</td></tr>
</tbody></table>

**Returns:**

void

## Example


```typescript
worker.send({ action: "process", data: [1, 2, 3] });
```

