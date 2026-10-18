---
title: "Gramstax.hookSendError()"
---

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [Gramstax](./gramstax.gramstax.md) &gt; [hookSendError](./gramstax.gramstax.hooksenderror.md)

## Gramstax.hookSendError() method

Best-effort send-error hook.

**Signature:**

```typescript
/** @virtual */
hookSendError?(...args: Parameters<ISendErrorHook>): void;
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

args


</td><td>

Parameters&lt;[ISendErrorHook](./gramstax.isenderrorhook.md)&gt;


</td><td>


</td></tr>
</tbody></table>

**Returns:**

void

## Remarks

Sibling hooks: `hookUpdateError` (dead updates — terminal) and `hookTrace` (every routed update). This one is the recoverable layer: a `fallback-text` send still serves the user, a `retryable` send still throws to your caller. Routing rule: retry-queue ← `hookSendError`, Sentry ← `hookUpdateError`, dashboard ← `hookTrace`.

## Example 1


```typescript
class MyBot extends Gramstax {
  override hookSendError(err: unknown, info: ISendErrorInfo): void {
    // info: {page: `admin/logs`, kind: `fallback-text` | `retryable`, chatId?: number}
    if (info.kind === `retryable`) queueRetry(info)
    else metrics.count(info.page, info.kind)
  }
}
// Throwing inside the hook is swallowed — the send flow never breaks.
```

## Example 2

Retry-for-later: collect retryables, re-drive them from a job.

```typescript
class MyBot extends Gramstax {
  retryQueue: Array<{err: unknown, page: string, chatId?: number, at: number}> = []
  override hookSendError(err: unknown, info: ISendErrorInfo): void {
    if (info.kind === `retryable`) this.retryQueue.push({err, page: info.page, chatId: info.chatId, at: Date.now()})
  }
}
// NOTE: `retryable` still throws to your caller — the hook only observes.
// Drain `retryQueue` from a worker/job; do not retry inline (429 needs backoff).
```

## Example 3

Severity split: Sentry for retryables, logs for user-caused fallbacks.

```typescript
class MyBot extends Gramstax {
  override hookSendError(err: unknown, info: ISendErrorInfo): void {
    if (info.kind === `retryable`) Sentry.captureException(err, {tags: {page: info.page}})
    // `fallback-text` (403 blocked, file deleted) is a normal condition — log, don't alert.
  }
}
```

