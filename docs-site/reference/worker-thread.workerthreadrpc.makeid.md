---
title: "WorkerThreadRpc.makeId()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadRpc](./worker-thread.workerthreadrpc.md) &gt; [makeId](./worker-thread.workerthreadrpc.makeid.md)

## WorkerThreadRpc.makeId() method

Generate a unique request ID.

**Signature:**

```typescript
makeId(): number;
```
**Returns:**

number

A monotonically increasing number unique within this instance.

## Example


```typescript
const id = rpc.makeId();
```

