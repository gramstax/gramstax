

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [SessionLock](./gramstax.sessionlock.md) &gt; [(constructor)](./gramstax.sessionlock._constructor_.md)

## SessionLock.(constructor)

Creates a lock bound to one Redis client and contention policy.

**Signature:**

```typescript
constructor(redis: IRedisLockClient, options: {
        leaseMs: number;
        onContended: ISessionLockOnContended;
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

redis


</td><td>

[IRedisLockClient](./gramstax.iredislockclient.md)


</td><td>

Redis client exposing the atomic `set` used for the lease.


</td></tr>
<tr><td>

options


</td><td>

&#123; leaseMs: number; onContended: [ISessionLockOnContended](./gramstax.isessionlockoncontended.md); &#125;


</td><td>

Lease duration and what to do when a key is already held.


</td></tr>
</tbody></table>

## Remarks

The client and policy are constructor state rather than per-call arguments because both are fixed for the process lifetime; the per-instance `_queues` map then serializes same-key contenders locally before Redis is consulted.

