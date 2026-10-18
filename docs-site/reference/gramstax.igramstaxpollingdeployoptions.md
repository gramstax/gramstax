

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IGramstaxPollingDeployOptions](./gramstax.igramstaxpollingdeployoptions.md)

## IGramstaxPollingDeployOptions type

Polling deploy branch of `optionsDeploy`.

**Signature:**

```typescript
type IGramstaxPollingDeployOptions = {
    maxRetries?: number;
    dropPendingUpdates?: boolean;
    queue?: IUpdateQueueConfig;
};
```
**References:** [IUpdateQueueConfig](./gramstax.iupdatequeueconfig.md)

## Remarks

Only meaningful when `deploy` is `polling`. Carries the retry budget that used to live at the root `pollingMaxRetries` field, plus the optional `queue` sink that turns the sequential `getUpdates` loop into a bounded worker pool. Omitting `queue` leaves polling exactly as it was: sequential processing, one update at a time.

## Example


```typescript
const polling: IGramstaxPollingDeployOptions = {maxRetries: 5}
const concurrent: IGramstaxPollingDeployOptions = {maxRetries: 5, queue: {enabled: true, workerCount: 8, perChatConcurrency: 1}}
```

