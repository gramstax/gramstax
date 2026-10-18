

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [getWebhookQueueStats](./gramstax.gramstax.getwebhookqueuestats.md)

## Gramstax.getWebhookQueueStats() method

Get current webhook queue statistics.

**Signature:**

```typescript
getWebhookQueueStats(): {
        activeKeys: number;
        waiting: number;
        length: number;
        maxSize: number;
        waitingEnqueue: number;
        waitingDequeue: number;
        enabled: boolean;
        maxQueueSize: number;
        workerCount: number;
        perChatConcurrency: number;
        blockWhenFull: boolean;
        drainTimeoutMs: number;
    } | null;
```
**Returns:**

\{ activeKeys: number; waiting: number; length: number; maxSize: number; waitingEnqueue: number; waitingDequeue: number; enabled: boolean; maxQueueSize: number; workerCount: number; perChatConcurrency: number; blockWhenFull: boolean; drainTimeoutMs: number; } \| null

Stats object when queue is enabled, otherwise `null`.

## Remarks

Superset of the queue-only shape: every previously returned key is still present, plus the dispatcher's per-key gate (`activeKeys`/`waiting`) and its `drainTimeoutMs` budget. Gate values are `0` before `_runWebhook` builds the dispatcher.

