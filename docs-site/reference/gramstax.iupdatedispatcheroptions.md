

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IUpdateDispatcherOptions](./gramstax.iupdatedispatcheroptions.md)

## IUpdateDispatcherOptions type

Options for [UpdateDispatcher](./gramstax.updatedispatcher.md).

**Signature:**

```typescript
type IUpdateDispatcherOptions = {
    queue: UpdateQueue<Update>;
    workerCount: number;
    perChatConcurrency: number;
    waiterTimeoutMs: number;
    drainTimeoutMs: number;
    handle: (update: Update) => Promise<void>;
    onError: (error: unknown, update: Update) => void;
    onWaiterTimeout?: (key: string) => void;
};
```
**References:** [UpdateQueue](./gramstax.updatequeue.md)

