---
title: "WorkerThreadLaunch.shutdown()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadLaunch](./worker-thread.workerthreadlaunch.md) &gt; [shutdown](./worker-thread.workerthreadlaunch.shutdown.md)

## WorkerThreadLaunch.shutdown() method

Shut the worker down gracefully.

**Signature:**

```typescript
shutdown(timeoutMs?: number): Promise<void>;
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

timeoutMs


</td><td>

number


</td><td>

_(Optional)_ How long to wait for the worker's shutdown confirmation. Defaults to `5000`.


</td></tr>
</tbody></table>

**Returns:**

Promise&lt;void&gt;

Promise resolving when the worker has terminated.

## Remarks

Sends an RPC `shutdown` request to the worker — the worker runs its `onBeforeExit` hook (flush state, close connections) before replying. The worker is then terminated. If the worker does not confirm within `timeoutMs`, it is force-terminated.

## Example


```typescript
await worker.shutdown(10_000);
```

