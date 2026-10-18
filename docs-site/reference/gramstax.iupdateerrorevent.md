

[Home](./index.md) &gt; [gramstax](./gramstax.md) &gt; [IUpdateErrorEvent](./gramstax.iupdateerrorevent.md)

## IUpdateErrorEvent type

Structured error event emitted by `onUpdateError`.

**Signature:**

```typescript
type IUpdateErrorEvent = {
    traceId: string;
    listenerName: string;
    state: `error` | `timeout` | `blocked` | `no-handler` | `validation`;
    error: unknown;
    durationMs: number;
    isEdit: boolean;
};
```

## Remarks

Built by `_emitUpdateError` / `_onCatch` / `_onStartupError` and delivered to the `hookUpdateError` class hook (Sentry-style sink). Sibling hooks: `hookSendError` (per-send failures) and `hookTrace` (every routed update).

## Example


```typescript
class MyBot extends Gramstax {
  override hookUpdateError(event: IUpdateErrorEvent): void {
    Sentry.captureException(event.error, {tags: {listener: event.listenerName}})
  }
}
```

