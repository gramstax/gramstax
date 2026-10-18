

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [UpdateDispatcher](./gramstax.updatedispatcher.md) &gt; [stop](./gramstax.updatedispatcher.stop.md)

## UpdateDispatcher.stop() method

Stop fetching, wake parked waiters, and join in-flight handlers.

**Signature:**

```typescript
stop(): Promise<IUpdateDispatchStopResult>;
```
**Returns:**

Promise&lt;[IUpdateDispatchStopResult](./gramstax.iupdatedispatchstopresult.md)&gt;

## Remarks

Idempotent. Never rejects — a drain timeout is reported, not thrown.

