---
title: "WorkerThreadRpc.use()"
---

[Home](./index.md) &gt; [@gramstax/worker-thread](./worker-thread.md) &gt; [WorkerThreadRpc](./worker-thread.workerthreadrpc.md) &gt; [use](./worker-thread.workerthreadrpc.use.md)

## WorkerThreadRpc.use() method

Register middleware for incoming requests.

**Signature:**

```typescript
use(...middlewares: IRpcMiddleware[]): this;
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

middlewares


</td><td>

[IRpcMiddleware](./worker-thread.irpcmiddleware.md)\[\]


</td><td>

Middleware functions to append to the chain.


</td></tr>
</tbody></table>

**Returns:**

this

`this` for chaining.

## Remarks

Middleware runs in registration order before the target method is dispatched. Each middleware receives a mutable [IRpcContext](./worker-thread.irpccontext.md) and a `next` function; short-circuit by setting `ctx.result` and skipping `next`, or reject by throwing.

## Example


```typescript
rpc.use(async (ctx, next) => {
  console.log(`calling ${ctx.method}`);
  await next();
});
```

