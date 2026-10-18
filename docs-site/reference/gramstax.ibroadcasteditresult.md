

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IBroadcastEditResult](./gramstax.ibroadcasteditresult.md)

## IBroadcastEditResult type

Bulk edit/delete result with a re-drive list.

**Signature:**

```typescript
type IBroadcastEditResult = {
    successCount: number;
    failedCount: number;
    totalCount: number;
    skippedCount: number;
    retryable: Array<{
        index: number;
        chatId: number;
        messageId: number;
        error: unknown;
    }>;
};
```

## Remarks

Mirrors the broadcast-send result shape: counts plus `retryable[]` (absolute `index` + `chatId` + `messageId` + `error`, completion order) for a fresh retry pass, and `skippedCount` for resumed indexes.

